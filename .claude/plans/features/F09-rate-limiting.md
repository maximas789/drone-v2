# F09 — Rate Limiting

**Wave:** 4 · **Depends on:** [F03](./F03-database-schema.md), [F05](./F05-auth-roles-access.md)

## Purpose

Stop abuse of the actions that cost something — booking a slot, submitting for review, uploading, and resolving Remote IDs — without punishing normal use of an app whose map fires a check on every click.

## Technical design

### Why two layers

**Better Auth's rate limiting is necessary but not sufficient.** It covers `/api/auth/*` only. Server actions are ordinary POSTs to the page route and are completely invisible to it. An attacker who skips the UI and posts directly to `createBooking` bypasses layer 1 entirely.

**Layer 1 — Better Auth**, in `src/lib/auth.ts`:

```ts
rateLimit: {
  enabled: true,
  storage: "database",
  customRules: {
    "/sign-up/email":            { window: 3600, max: 5 },
    "/sign-in/email":            { window: 60,   max: 10 },
    "/send-verification-email":  { window: 60,   max: 2 },
    "/forget-password":          { window: 60,   max: 3 },
    "/change-password":          { window: 60,   max: 5 },
    "/delete-user":              { window: 60,   max: 3 },
  },
}
```

Editing `auth.ts` means re-running the Better Auth CLI → `db:generate` → `db:migrate`. **Coordinate this with [F06](./F06-transactional-email.md)**, which edits the same file in the same wave.

**Layer 2 — app-level**, `src/lib/rate-limit.ts`, backed by `rate_limit_bucket`. One atomic statement, no read-then-write race:

```sql
insert into rate_limit_bucket (key, window_start, count)
values ($1, $2, 1)
on conflict (key, window_start)
  do update set count = rate_limit_bucket.count + 1
returning count;
```

No Redis — this works on serverless Neon with no extra service. Buckets are swept nightly by [F08](./F08-background-jobs.md).

### Contract

```ts
rateLimit({ key, window, max }): { ok: true } | { ok: false, retryAfterSeconds }
```

Key shape: `{action}:{scope}:{identifier}` — e.g. `booking.create:user:{userId}`, `rid.resolve:ip:{ipHash}`.

Called **immediately after the guard and before Zod parsing**, so a malformed flood is cheap to reject.

### Limits

| Action | Limit | Rationale |
|---|---|---|
| `createBooking` | 3/min **and** 20/day per user | Two windows: bursts and sustained hoarding are different attacks |
| `submitDroneForReview` | 5/hour per user | Stops queue flooding |
| `addDronePhoto` | 20/hour per user | Storage cost |
| `resolveRemoteId` | 30/min per IP hash | Anti-scraping (see below) |
| `checkAirspace` | 60/min per user | **Deliberately generous** — fires on map interaction |
| `revealIdentity` | 20/hour per reviewer | A reveal is a serious act; a burst is a signal |
| Admin lookup | 60/min per user | |
| `/api/upload` | 20/hour per user | Matches `addDronePhoto` |

`checkAirspace` is debounced client-side first (~250 ms). The server limit is a backstop, not the primary control — setting it tight would make the live map feel broken.

### Enumeration, honestly

40 bits of Remote ID entropy at 30 requests/minute is roughly 700 000 years to sweep the space, so the limit is **not** what makes codes unguessable — the entropy is. What the limit actually prevents is bulk scraping of codes an operator already holds, and it makes a scanning attempt visible in `remote_id_scan`.

### IP handling

The identifier for anonymous limits is `sha256(RATE_LIMIT_PEPPER + ip)`, never a raw address — the same treatment `audit_event.ipHash` gets. A raw IP in a rate-limit table is a privacy liability with no benefit.

### What the user sees

Never a 429 page and never a stack trace. The action returns a normal refusal:

```ts
{ ok: false, reasons: [{ code: 'rate_limited', params: { retryAfterSeconds } }] }
```

Rendered as a bilingual toast: *"حاولت كثيراً. جرّب مرة أخرى بعد ٤٥ ثانية"* / *"Too many attempts. Try again in 45 seconds."* — with the number formatted through `src/lib/format.ts` like every other number in the app.

Repeated limit hits on `revealIdentity` or `resolveRemoteId` write an audit event, so abuse is reviewable rather than merely blocked.

## Files

```
src/lib/rate-limit/rules.ts     PURE — limits, window arithmetic, key shapes
src/lib/rate-limit/index.ts     server-only — the counter, enforceLimit, sweep
src/lib/rate-limit/rules.test.ts
src/lib/ip-hash.ts              hashIp, clientIpFrom
src/lib/db/schema.ts            rate_limit_bucket (closes part of Open Thread 7)
src/lib/db/auth-schema.ts       + Better Auth's own `rate_limit` (CLI output)
src/lib/actions/result.ts       + refuseWith(code, params)
src/lib/actions/user.ts         first real caller
src/lib/auth.ts                 (extended — layer 1)
src/lib/auth-errors.ts          429 has no code; recognised by status
src/lib/format.ts               + formatSeconds
messages/{ar,en}.json           errors.rateLimited, auth.errorTooManyAttempts
src/components/admin/user-role-table.tsx   renders the countdown
```

**`rate-limit.ts` became a directory, and the split is the point.** The window
arithmetic and the limit table are **pure** — no `server-only`, no `db` — for
the same reason `src/lib/airspace/evaluate.ts` is: arithmetic that a database
connection string can veto is arithmetic nobody can unit-test, and this is the
half that can be silently wrong. `index.ts` re-exports it, so callers still
write `@/lib/rate-limit` and never see the split.

**The message key is `errors.rateLimited`, not `errors.rate_limited`** — every
other key in both catalogues is camelCase.

**The unit is formatted in `format.ts`, not as an ICU plural.** `formatSeconds`
gets Arabic's six plural categories from CLDR for free, and — the part that
matters — forces Latin numerals. A bare `{seconds}` in a message is formatted
by ICU itself, which under `ar` emits `٤٥`. That is rule 6 being broken through
a route the ESLint rule cannot see. It also sidesteps a real limitation in
`scripts/i18n-check.mts`, which cannot tell a plural branch body (`one {second}`)
from a placeholder (`{second}`) and reports the first as drift.

## Acceptance criteria

- [x] `rate_limit_bucket` has a unique index on `(key, window_start)`. *(`\d` on the table: `rate_limit_bucket_uniq UNIQUE, btree (key, window_start)`.)*
- [x] The increment is a single `insert … on conflict … returning` — no read-then-write.
- [x] 4 bookings inside a minute: the 4th returns `rate_limited` with a `retryAfterSeconds`. *(`1:ok 2:ok 3:ok 4:LIMITED retryAfter=23s`.)* **"No booking row is created" is not testable yet** — `createBooking` is F21's. What is proven is that the refusal happens before the domain call, which is where the action's only path to it runs.
- [x] 21 bookings across a day hits the daily limit even when spread out. *(21 calls ten minutes apart: call 21 limited, `retryAfter=73500s` ≈ 20 h — the rest of the day, so it is the daily rule that fired.)*
- [x] Both limits can be hit independently — the per-minute limit does not mask the daily one. *(And the reverse, which the spec does not ask for but matters more: after a burst refused by the minute rule, the daily bucket sits at **3, not 4**. A double-click storm cannot burn a pilot's whole day.)*
- [x] 31 anonymous Remote ID resolutions in a minute from one IP: the 31st is limited.
- [x] Two different IPs are limited independently.
- [x] `rate_limit_bucket` contains **no raw IP addresses** — inspected directly: 0 rows match an IPv4 shape; keys read `rid.resolve:ip:a49251b9…`. ⚠️ **Better Auth's own `rate_limit` table does store raw IPs** (`0000:0000:…:0000|/sign-up/email`). Its key format is not ours to choose. See Open Thread 21.
- [x] 60 `checkAirspace` calls in a minute all succeed; the 61st is limited.
- [ ] The limit is enforced when the server action is called **directly**, bypassing the UI. **Not run** — needs a signed-in admin account, and the owner has not signed up yet. The limit sits after the guard inside the action, which is reached identically by a direct POST; F05 proved that path for the guards.
- [ ] A limited response renders as a bilingual toast with a Latin-numeral countdown, not a 429 page. **Partly.** The code path is built and the countdown goes through `formatSeconds`, but it renders on `/admin`, which needs an admin account to see. There is **no toast component in this build** — it renders as the inline `role="alert"` notice the admin panel already used.
- [x] Better Auth: 6 sign-up attempts in an hour, the 6th is limited. *(Five → `PASSWORD_TOO_SHORT` 400, sixth and seventh → **HTTP 429**. Run with a 1-character password so no account was created — `user` still holds 0 rows — and the counters were deleted afterwards so the owner's real sign-up is not blocked.)*
- [x] `rate-limit-sweep` removes expired buckets and leaves live ones. *(The sweep function; F08 owns the cron that calls it.)*
- [x] Better Auth CLI regenerated + migrated after the `auth.ts` edit. *(`rate_limit` table added; SQL read in full — two `CREATE TABLE`s, two indexes, no drops — then `0002_odd_bullseye` applied.)*
- [x] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
