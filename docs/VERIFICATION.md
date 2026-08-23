# Verification — F31

**What was actually run, with its output.** Written for the fresh-eyes critics
of F31c, who read this file rather than the running app: four agents cannot
share a port.

Every line here is a command that was executed and a number that came back. A
check that was not run is **named as not run** — that is the whole point of the
exercise, and it is CLAUDE.md rule 12.

Machine: Windows 11, Node 25.0.0, pnpm, Docker Postgres (`postgres:alpine`).
Origin under test: **`http://localhost:3001`** — port 3000 is occupied by an
unrelated app on this machine (BUILD-LOG thread 3), and `.env` sets both
`APP_URL` and `BETTER_AUTH_URL` to 3001 to match.

---

## F31a — the mechanical gate

Run 2026-08-23, in this order. **Schema before build**, because `pnpm build`
runs `db:migrate` first and reaching it with an ungenerated schema edit
outstanding would apply SQL nobody read.

| # | Check | Command | Result |
|---|---|---|---|
| 1 | Types | `pnpm typecheck` | ✅ zero errors. `next typegen` first — `tsc --noEmit` alone is not the check. |
| 2 | Schema drift | `pnpm db:generate` | ✅ **"No schema changes, nothing to migrate"**. 7 migration files before, 7 after; `git status` unchanged. |
| 3 | Migrations | `pnpm db:migrate` | ✅ applied. The two `NOTICE`s (`schema "drizzle" already exists`, `relation "__drizzle_migrations" already exists`) are `severity: NOTICE`, not errors. |
| 3b | Migrations against a **fresh** database | `pnpm verify:fresh-db` | ✅ **7 migrations → 25 tables, 16 enums** into an empty database, which is then dropped. The `app` database is never touched. |
| 4 | Build | `pnpm build` | ✅ compiled in 22.7 s, 85 static pages generated, **63 route entries**. Route table read — see below. |
| 5 | Lint | `pnpm lint` | ✅ zero errors, including the logical-property, locale-format and airspace-purity rules. It caught one unused import in a script written for this very gate. |
| 6 | Unit tests | `pnpm test` | ✅ **67 files, 1114 tests, 0 failures**, 6.87 s. |
| 7 | i18n parity | `pnpm i18n:check` | ✅ **2127 keys**, `ar` and `en` identical. |
| 8 | Production serve | `PORT=3001 pnpm start` | ✅ `Ready in 731ms`. **Every HTTP check below ran against this**, never against `next dev` — a dev-mode 404 embeds a stack trace naming the guard and a production one does not (thread 16). |
| 9 | Every route answers | `pnpm verify:routes` | ✅ **126/126**. Breakdown below. |
| 10 | Two accounts | `pnpm verify:two-accounts` | ✅ **25/25**. Breakdown below. |
| 11 | Keys removed | `pnpm verify:no-keys` | ✅ **12/12**, including a real approval. Breakdown below. |

### The route table, read

63 entries. Everything that reads a session builds **ƒ (Dynamic)**, which is
what it must do — a statically prerendered `/admin` would serve one reviewer's
page to the next.

Only nine pages are prerendered, and every one of them is session-free: `○`
`/_not-found`, `/robots.txt`, `/sitemap.xml`; `●` `/{ar,en}/sign-up`,
`/{ar,en}/forgot-password`, `/{ar,en}/dev/emails`. Nothing under `/admin`,
`/dashboard`, `/drones`, `/bookings`, `/notifications` or `/settings` is
static.

### Check 9 — `scripts/verify/routes.mts`, 126/126

| Pass | Count | What it asserts |
|---|---|---|
| Public, signed out | 39/39 | Every page in `PUBLIC_PAGES` in both locales returns 200 — the same list the sitemap reads, so a page that exists is a page that is checked. Plus `/sign-in`, `/sign-up`, `/forgot-password`, a real `/rid/{code}`, `robots.txt`, `sitemap.xml`, `llms.txt`, `/api/zones/geojson?bbox=…` and `/api/rid/{code}`. |
| Protected, signed out | 68/68 | 34 routes × 2 locales redirect to `/{locale}/sign-in`. Both locales, because the `next` parameter is locale-stripped and that is exactly the sort of thing that works in one and not the other. |
| Guard, past the proxy | 18/18 | A **fabricated** `better-auth.session_token` gets past `src/proxy.ts` — which is not the security boundary and says so — and lands on the layout guard. All 15 `/admin` routes answer **404**, and no body contains `requireAdmin`, `requireReviewer`, `requireUser`, `auth-guards`, `drone-2-demo`, `at async` or `webpack-internal`. The 16th is `/api/files/{a real photograph's pathname}`, signed out: **404**, so the URL is not the credential. The 17th and 18th are `/{ar,en}/dev/emails` — the email preview **prerenders as a 404 in a production build**, rather than being conditionally hidden. |
| Refusal | 1/1 | `/api/zones/geojson` with no `bbox` → **400 `invalid_bbox`**, a machine-readable body rather than an exception. |

Two expectations in the first draft of this script were wrong, and both were the
script's fault rather than the app's — recorded because a critic will otherwise
re-derive them:

- `/api/zones/geojson` needs a viewport. A bare GET is a 400 by design.
- `/ar/settings/system` with a junk cookie is **307 to sign-in, not 404**. It
  sits under the `(app)` group, whose layout runs `requireUser` before the
  admin-only filter, so an invalid cookie is simply "signed out" there. Correct
  — and it means the criterion *"a reviewer gets 404 on `/settings/system`"* is
  **not** covered by this script. It needs a real reviewer session. See below.

### Check 10 — `scripts/verify/two-accounts.mts`, 25/25

Ownership lives in `src/lib/data/*.ts` and every exported function there takes
the session first (CLAUDE.md rule 8), so each reader was asked directly with the
wrong session, **in both directions** — two throwaway pilots, A against B and B
against A. One direction alone would have passed on a reader that leaks only one
way.

- `getDroneById`, `getMyDroneDetail`, `getRemoteIdForDrone`, `getProfileByUserId`
  → `null`; `getDronePhotos` → `[]`; `markNotificationRead` → `false`.
  `listMyDrones` and `listMyNotifications` return only the caller's own rows.
- The same, against the **real** account's seeded drone and booking:
  `getDroneById`, `getBookingById` → `null`, `getBookingCopilots` → `[]`.
- Six staff-only readers asked with a pilot session return an **empty page**, not
  a partial one: `listPendingDrones`, `countPendingDrones` (0),
  `listPendingBookings`, `listPendingIdentityVerifications`, `listAuditEvents`,
  `listIdentityReveals`.

Both probe pilots and every row they owned were deleted; the script re-runs
cleanup on entry, so a crashed run leaves nothing behind either.

### Check 11 — `scripts/verify/no-keys.mts`, 12/12

`RESEND_API_KEY` and `BLOB_READ_WRITE_TOKEN` are deleted from the environment
**before any import**, because both are read into module-level constants
(`emailConfigured`, `blobConfigured`) at import time; deleting them afterwards
would have proved nothing.

With the keys gone, a throwaway pilot registered a **self-built drone with no
serial number**, submitted it, and the admin account approved it:

- `submitDrone` → `{ok:true, draft → pending}` — **no validation error for the
  missing serial**. That inversion is the product.
- `approveDrone` → `{ok:true, pending → approved, remoteIdCode:"AJN-308N-1W5B"}`.
- Registration window **3.001 years** (three calendar years measured against a
  365.2425-day year).
- `audit_event`: `drone.submitted`, `drone.approved`. `notification`:
  `droneApproved`. Both written.
- `email_log`: **0 rows `failed`, 82 rows `skipped`** across the whole table. A
  missing key has never once been recorded as an outage — which is exactly the
  distinction F29c styled apart.
- Storage fell through to the local driver and round-tripped a UTF-8 Arabic file
  through `putFile` → `readFile` → `deleteFile`.

Every row deleted afterwards, and the empty `uploads/probe-nokeys/` directory
removed by hand — `deleteFile` removes the file and leaves the folder, which is
right for the app and litter for a probe.

**`sendEmail` itself was not called, and that is a finding rather than a gap.**
It renders a react-email template through next-intl, and `use-intl`'s production
build is ESM shipped inside a package with no `"type": "module"`, so `tsx` loads
it through the CJS loader and `createContext` comes back undefined. The render
path runs under Next and under Vitest (`src/lib/email/templates.test.ts`, in the
1114); it does not run under `tsx`.

### The domain suite, mapped to the plan's table

Every area F31 names has a file, and the concurrency row — which cannot be a
unit test — has a live probe.

| Area | Where |
|---|---|
| Geometry | `src/lib/airspace/{geometry,precedence,evaluate}.test.ts`, `src/lib/geo/{bbox,winding,validate,project}.test.ts` |
| Slots | `src/lib/booking/slots.test.ts`, `src/lib/airspace/time.test.ts` |
| Concurrency | `scripts/probe-booking.mts` — **re-run for this gate**, all green (below) |
| Codec | `src/lib/remote-id/codec.test.ts` |
| Redaction | `src/lib/remote-id/{redact,privacy-fields}.test.ts` |
| Workflow | `src/lib/workflow/{transitions,rules,four-eyes}.test.ts` |
| Format | `src/lib/format.test.ts` — `RIYADH_OFFSET_MINUTES` in January and July |
| Saudi ID | `src/lib/validation/saudi-id.test.ts` |

`scripts/probe-booking.mts`, re-run 2026-08-23 against the live database:
capacity 1 with two simultaneous claims → **exactly one booking row**, the loser
refused with `slot_full` and handed three alternatives; capacity 3 with five
simultaneous claims → **seats 0, 1, 2, no gaps, no duplicates**; a cancelled seat
is reused at the same index; a failed booking writes **no audit event and no
notification** (88 → 88, 10 → 10).

### Integrity

- The `user` table holds **exactly two rows**: the user's own account
  (`admin`, created 2026-08-16 — the **first**, as the first account created
  becomes admin) and the second staff account (`reviewer`, 2026-08-21). **No
  probe account has ever occupied the first slot.**
- After every probe: **0 rows** matching `probe-%` in `user`, `drone` or
  `email_log`; **0 orphaned `audit_event` rows** pointing at a deleted drone or
  booking; 77 audit events, all resolving to live entities.
- `git status` clean apart from this session's intended files; `.env` is not
  committed and is git-ignored.

---

## F31b — the walkthrough

**Blocked on the Chrome extension**, which is not connected. Steps 1–8 and
10–14 need a browser and a signed-in session, and the 375 px pass needs the
same-origin iframe technique (thread 44). What follows is the part of F31b that
a browser would have done *worse*.

### Step 9 — the signed-out scan page, read as source · `pnpm verify:scan-page` · **46/46**

The criterion says *"verified by reading the HTML source, not just the visible
page"*. A value can sit in the markup, in an RSC flight payload, in a `<meta>`
tag or in a JSON-LD block while being invisible on screen — `display:none` is
not redaction, and a screenshot cannot tell the two apart.

All **5 real Remote IDs** (statuses `approved`, `expired`, `revoked`) were
fetched signed out across **3 surfaces each** — `/ar/rid/{code}`,
`/en/rid/{code}` and the `/api/rid/{code}` JSON twin — and every response body
searched whole for **12 forbidden strings**: the owner's Arabic and English
name, the national ID number, its last four digits, the mobile in four
spellings including Arabic-Indic digits, both account email addresses and their
local parts.

- **Zero leaks**, across ~136 kB of Arabic HTML and ~148 kB of English per page.
- Each page still renders its own code, so this is not a pass earned by
  rendering nothing.
- The drone's nickname does **not** appear on the anonymous page either.

**Two false positives worth recording, because they will recur.**

1. `0501234567` and `2345` were reported as leaks on every HTML page. They are
   not. The seeded pilot's mobile is `+966501234567`, and `messages/{ar,en}.json`
   uses `0501234567` as the worked example under `mobileHint` and
   `mobile_format` — twice in each catalogue, and the catalogue ships inside the
   page. The script now excludes any forbidden value that also appears in the
   catalogue and **reports the exclusion by name** rather than dropping it
   silently. The residue is a real finding: **the demo data reuses the
   documentation's example number, so that one field cannot be checked this
   way.**
2. A `429` on the last request. That is `rid.resolve`'s limiter — **30 requests
   a minute per IP** (F09) — and the script makes 15, so a second run inside the
   same minute trips it. The fetch now waits the window out, and the limiter got
   an assertion of its own: hammering `/api/rid/` **does** produce a 429.

### Step 10 — the reveal audit trail

The *ordering* claim is structural rather than observed, and reads cleanly:
`revealIdentityAction` opens a transaction, writes
`remote_id.identity_revealed`, marks the scan, and **returns the identity only
after the commit** — any failure logs loudly and returns `reveal_not_logged`
with no data. Driving it live still needs a reviewer session.

What was checked against the database: **3 reveal events, every one carrying an
actor, a role, a reason and an IP hash**; 1 scan marked `revealed_identity`,
matching the single `remote_id` reveal.

One row has a 5-character reason, `"owner"`, below the 10-character floor the
reviewer path enforces. **Not a defect** — it is F28a's self-reveal, where the
owner reveals their *own* number; `revealOwnIdentityAction` takes no argument at
all and writes that literal marker deliberately, on the same action name so an
admin auditing reveals has one query. The actor on the row is what separates the
two.

### Found, not yet fixed — demo polish

**All five registered aircraft are named `PROBE18B …`** in the database
(`PROBE18B معتمدة`, `PROBE18B منتهية`, `PROBE18B ملغاة`, …). They are seeded
demo content from F18b. The names are correctly **not** shown to an anonymous
scanner, so this is not a privacy finding — but every signed-in screen a
reviewer or pilot is shown during a demo prints developer jargon where an
aircraft nickname belongs. F31c's "looks like theirs" critic should be expected
to raise it; it is cheap to fix and it is not fixed yet.

---

## Named as un-runnable

Stated, never assumed.

| Not run | What it would need |
|---|---|
| A **second reviewer deciding the first account's submission in a browser** — the four-eyes rule over HTTP. Proved against the database 22/22 by `probe-four-eyes.mts`; the browser half is unrun. | The user signing in as `alshar55@hotmail.com`. The assistant may not enter a password. BUILD-LOG thread 64. |
| A **reviewer** 404ing on `/admin/zones`, `/admin/audit`, `/admin/reveals` and `/settings/system` while reaching `/admin/analytics`. | The same reviewer session. The fabricated-cookie pass covers the *unauthenticated* case only. |
| Sending email to any address other than the account owner's. | A verified sending domain in DNS. |
| Vercel Blob uploads. | A deployed store and `BLOB_READ_WRITE_TOKEN`. The local driver is exercised instead, and both drivers are reached through the same `/api/files` ownership check. |
| The OG preview card as a third party sees it. | A public domain. |
| QR codes encoding a production URL. | `APP_URL` set to a real domain. `.env` sets it to `http://localhost:3001`; the system page has an `APP_URL` check for exactly this (F29a), not re-opened in this session. |
| Printed-QR scanning at 20 mm. | A printer and a phone. |
| Inngest production sync. | A first deploy. |
| `sendEmail` under `tsx`. | Nothing — it is a loader limitation, not an app one. Covered by Vitest and by the running app. |

## Open product decision, not a bug

**The 120 m altitude claim.** The airspace panel states a national 120 m limit
as fact in both languages. No GACA document naming 120 m has ever been fetched
and read; 120 m is the highest ceiling *authored* for the Riyadh zones. The
documentation deliberately omits the claim and F26b's screenshot is cropped
above the slider so a picture cannot smuggle it back in. Either the string is
sourced, or it is softened. BUILD-LOG thread 77 — the honesty rule's exact
subject matter, and the user's call.
