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
src/lib/rate-limit.ts
src/lib/auth.ts                 (extended — coordinate with F06)
messages/{ar,en}.json           errors.rate_limited
```

## Acceptance criteria

- [ ] `rate_limit_bucket` has a unique index on `(key, window_start)`.
- [ ] The increment is a single `insert … on conflict … returning` — no read-then-write.
- [ ] 4 bookings inside a minute: the 4th returns `rate_limited` with a `retryAfterSeconds`, and **no booking row is created**.
- [ ] 21 bookings across a day hits the daily limit even when spread out.
- [ ] Both limits can be hit independently — the per-minute limit does not mask the daily one.
- [ ] 31 anonymous Remote ID resolutions in a minute from one IP: the 31st is limited.
- [ ] Two different IPs are limited independently.
- [ ] `rate_limit_bucket` contains **no raw IP addresses** — inspect the table directly.
- [ ] 60 `checkAirspace` calls in a minute all succeed; normal map panning never triggers a limit.
- [ ] The limit is enforced when the server action is called **directly**, bypassing the UI.
- [ ] A limited response renders as a bilingual toast with a Latin-numeral countdown, not a 429 page.
- [ ] Better Auth: 6 sign-up attempts in an hour, the 6th is limited.
- [ ] `rate-limit-sweep` removes expired buckets and leaves live ones.
- [ ] Better Auth CLI regenerated + migrated after the `auth.ts` edit.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
