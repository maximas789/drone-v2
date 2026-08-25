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

## Re-verified after the fixes — 2026-08-25

Four defects were fixed after F31a's gate first passed, so the gate was re-run
in full against the current tree. **Everything below still holds, and two of the
scripts now check more than they did** because the walkthrough minted two more
Remote IDs and two more QR stickers.

| Gate | F31a | Re-run |
|---|---|---|
| `pnpm exec tsc --noEmit` | clean | **clean** |
| `pnpm db:generate` — schema drift | none | **none** — still 7 migrations |
| `pnpm verify:fresh-db` | 25 tables, 16 enums | **25 tables, 16 enums**, 7 migrations onto a scratch database |
| `pnpm build` | 63 routes | **clean** |
| `pnpm lint` | clean | **clean** |
| `pnpm test` | 1114 | **1114** |
| `pnpm i18n:check` | 2127 keys | **2129 keys**, ar/en in sync |
| `pnpm verify:routes` | 126/126 | **126/126** |
| `pnpm verify:two-accounts` | 25/25 | **25/25** |
| `pnpm verify:scan-page` | 46/46 | **64/64** — 7 Remote IDs × 3 anonymous surfaces, 12 forbidden strings each; **zero leaks on the two newly minted codes too** |
| `pnpm verify:qr` | 14/14 | **22/22** — five stickers, each byte-identical to a fresh render |
| `pnpm verify:no-keys` | 12/12 | **12/12** — including a real serial-less approval with both keys deleted before import |

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

**9 of 14 steps are now driven by hand, in Arabic, in Chrome, against a
production serve** (Session 46c). Steps **6 and 7** are blocked by a *correct
refusal* rather than by a missing tool, and step **13** by a second session.
The extension connected; two recorded blockers were not blockers.

- The browser was **already signed in as the admin**, and **that account owns
  all seven aircraft** — so the pilot half of the walkthrough needed no second
  sign-in. Steps 3, 4, 5, 8, 11 and 12 ran on the session that was there.
- The serve from the previous session was still answering **and had been up
  since the previous day**. It was killed by PID and restarted, and every
  result below is against a serve whose `Ready in` line was read.

**Steps 1 and 2 cannot be re-run and were not:** the accounts exist, and the
first-account-becomes-admin slot must never be disturbed. Only two accounts
exist — admin (`alshar044@gmail.com`) and reviewer (`alshar55@hotmail.com`).

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

### Step 10 (a) — the reveal audit trail, read from the database

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

### Step 7 — the QR actually on the sticker · `pnpm verify:qr` · **14/14**

CLAUDE.md names this trap by itself: *"QR codes embed `APP_URL` at render time.
If it still says `localhost` in production, every printed sticker is dead."* A
stored PNG is opaque — looking at it tells you it is a QR code and nothing about
where it points.

Decoding would need a decoder this project does not have, and **adding a
dependency to check a dependency is not a verification**. So each stored PNG was
compared against a fresh render of its payload URL through the app's own
`renderQrPng`. `qrcode` is deterministic for a given string, size, error
correction and margin, so a byte-identical file is proof the stored one encodes
that exact URL.

- All **3 stored QRs are byte-identical** to a fresh render of
  `{APP_URL}/ar/rid/{code}` — 4029, 4057 and 3950 bytes.
- Each is a real PNG by magic number and **512×512** read out of the IHDR chunk,
  which is what makes a 20 mm sticker readable.
- **The negative control passes**: a deliberately wrong code renders a
  *different* PNG. Without it, a renderer that ignored its argument would have
  passed every assertion above.

**Only 3 of the 5 Remote IDs have a QR file, and that is a seeding artefact, not
a defect.** The three are exactly the `approved` ones. The `expired` and
`revoked` rows were inserted directly by `probe-drone-states.mts`, which never
ran the render job. A missing QR degrades to a "pending" panel with a
Regenerate button (`src/components/remote-id/qr-display.tsx`), announced as
`role="status"` rather than an alert — so the demo shows a control, not a broken
image.

**Every sticker rendered so far points at `http://localhost:3001`.** Correct for
this machine and fatal in production. Re-render after `APP_URL` is a real
domain; F29a's system page carries the same check for the operator.

### Found, not yet fixed — demo polish (still true)

**All five registered aircraft are named `PROBE18B …`** in the database
(`PROBE18B معتمدة`, `PROBE18B منتهية`, `PROBE18B ملغاة`, …). They are seeded
demo content from F18b. The names are correctly **not** shown to an anonymous
scanner, so this is not a privacy finding — but every signed-in screen a
reviewer or pilot is shown during a demo prints developer jargon where an
aircraft nickname belongs. F31c's "looks like theirs" critic should be expected
to raise it; it is cheap to fix and it is not fixed yet.

---

### Steps 4 and 5 — the serial-less registration, on a live page

A self-built **FPV** named **صقر الرياض** — deliberately not `PROBE18B` —
850 g, camera, two photographs, registered by hand through all five panes in
Arabic.

- **The serial field is never rendered.** `showsSerial = serialRequiredFor(buildType)`,
  and switching the build type to *تجارية* flips the manufacturer hint from
  optional to required — so the conditional is **live**, not merely absent.
- **The review pane has no serial row at all.**
- **No validation error anywhere**, which is the acceptance criterion.
- Submitted → **`status = pending`**, `serial_number` NULL, **zero Remote IDs**.
  The card reads *قيد المراجعة*, dated *24 أغسطس 2026* — Gregorian, Latin
  numerals. **Not auto-approved.**

Cross-checked from the other side: on the booking wizard's aircraft pane,
صقر الرياض appears **disabled with *لم تُعتمد بعد***, and every other
ineligible aircraft states its own reason (*أُلغي تسجيلها*, *انتهى تسجيلها*)
rather than being hidden.

### Steps 6 and 7 — blocked by the four-eyes rule, which is the feature working

`/admin/drones/{id}` renders **لا يمكنك البتّ في طلبك أنت** — *"the owner of
this record is you; another reviewer decides it, and the system refuses the
operation even if this button is bypassed"* — and **no approve or reject
control exists at all**. Absent, not disabled.

The admin owns every aircraft, so **this account can never approve one**, and
because approval is the only door to issuance, **step 7 — Remote ID minted,
QR rendered, notification, email logged — is unreachable in a browser too.**
F31a minted `AJN-308N-1W5B` mechanically; that is not the same evidence.

The copy also promises a server-side refusal. `isOwnSubmission` is called in
**ten places inside `src/lib/workflow/`** — booking ×3, declaration ×2,
drone ×2, identity ×2 — with the three pages only choosing whether to show the
notice. **Verified by reading, not by driving.** Driving it needs the reviewer.

### Step 8 — the digital ID card

`AJN-7Q4M-31KD` in mono, *تسجيل ساري*, and a QR that is a **real 512×512
image** — `complete: true`, `naturalWidth: 512`, with the code in its alt text,
not a broken-image placeholder.

Registration window measured in the database: **1095 days = 3.00 years exactly**
(issued 2026-07-12, expires 2029-07-11).

**One thing that reads as a defect and is not.** The card's *تاريخ الإصدار*
(18 Aug 2026) is the **Remote ID row's** date, while *ساري حتى* runs from
**registration** (12 Jul 2026) — so the two dates printed side by side do not
span three years. A seeding artefact, like the missing QRs: in a real approval
both come from the same transaction.

**The 20 mm printed scan remains un-run** and is named below.

### Step 10 (b) — the reveal, driven live in the browser

The prompt states the rule itself: *يُحفظ السبب في سجل التدقيق باسمك **قبل عرض
أي بيان***.

- A **four-character** reason leaves the confirm button **disabled**; a real one
  enables it. The ten-character floor is enforced in the UI.
- Reveal audit events went **3 → 4**.
- The new row carries the typed reason **verbatim**, `actor_role admin`,
  `actor_is_system false`, a real actor id, a **64-character IP hash** and the
  user agent.
- The identity appeared **only afterwards**, in a red-bordered
  **الهوية المكشوفة** panel footed *سجّل هذا الكشف باسمك في سجل التدقيق*.

### Steps 11 and 12 — the map, and an unplanned proof of the re-check

**Every MapLibre trap avoided.** OpenFreeMap tiles drew, Arabic labels are
**joined and correctly ordered** (so `setRTLTextPlugin` ran exactly once and
before the first map), the KKIA no-fly ring and the permitted polygons render,
attribution is present, and there is no API key. The
*authored-not-official* disclaimer is on the surface.

Tapping الثمامة returns **مسموح** — ceiling 120 م, requested 120 م, capacity 6,
*ساعات الاثنين* 06:00–11:00 and 15:00–18:00 on a day that really was a Monday.

**The first confirmation was refused, and it was right.** *الفترة المطلوبة في
الماضي.* The slot grid had been rendered around 08:5x Riyadh and the
confirmation came at **15:50 Riyadh**, after a long gap — so the 15:00 slot had
already begun. The server re-validated exactly as the page promises
(*يُعاد التحقق من المجال الجوي عند التأكيد*), refused with a machine-readable
reason, and re-struck the slot as *انقضت*. **A stale client cannot buy a seat.**

Rebooked on 25 Aug:

- zone `auto_approve = t` → booking **`status = approved`**, matching the
  criterion that the state follow the zone's setting.
- `slot_start` stored as `12:00:00+00` = **15:00 Riyadh**, the +180 offset intact.
- notification written as **`type: bookingConfirmed`** — a code, not a rendered
  string, so a pilot who switches language sees it in the new one.
- Returning to that day, the slot is struck with **لديك حجز في هذا الوقت**:
  the app refuses to double-book and says why.

### Step 14 — traceable, and from the same log

The activity slice is drawn from the audit table itself — *لا سجل ثانٍ* — and
shows **مُوافق عليه تلقائياً** and **طُلب الحجز** at 15:53 beside
**كُشفت وثيقة الهوية** at 08:49 and **قُدِّم الطلب** at 08:44. Every photo
upload and delete performed during the session appears in the aircraft's own
trail, attributed and timestamped in Riyadh time.

Health checks: database 18 ms, **7 migrations applied** matching the 7 files on
disk, `APP_URL` and `BETTER_AUTH_URL` both *سليم*. The email log keeps
**«لم تُرسل — البريد غير مُهيّأ» distinct from «فشلت»**, which is the whole
point of that panel.

### The 375 px pass — done through an iframe, and it found something

**`resize_window` still lies**: it returns *"Successfully resized … to
375x812"* and `innerWidth` stays **1440**. The pass was done instead through a
**same-origin 375 px iframe**, measuring `scrollWidth` against `clientWidth`
inside it.

| Page | Result |
|---|---|
| `/ar` | clean — 356 / 356 |
| `/ar/zones` | clean — 356 / 356 |
| `/ar/dashboard` | **overflows — 409 / 356** |
| `/ar/drones` | **overflows — 409 / 356** |

The offender is the **signed-in header** `<nav class="flex items-center gap-2">`,
whose four children total **328 px**: notifications 36 + الإعدادات 69 +
**language switcher 122** + logout 101, plus the logo and `p-3`. Public pages
are clean because the public header is smaller. **Not fixed — the remedy
(collapse, hide labels, or wrap) is a design decision, not a mechanical repair.**

---

### Steps 6 and 7 — the reviewer, the four-eyes rule, and the whole issuance chain

**The user signed in as `alshar55@hotmail.com`; the assistant never handled the
password.** That unblocked everything below.

**The reviewer boundary, over HTTP.** `/admin/zones`, `/admin/audit`,
`/admin/reveals`, `/settings/system`, `/admin/cities` and `/admin/zones/new` all
answer **404**; `/admin`, `/admin/analytics`, `/admin/lookup`, `/admin/pilots`
and `/admin/bookings` answer **200**. **No stack trace on any of them**, and
`/en/admin/audit` 404s too — the guard is not locale-dependent. This was F31a's
last open acceptance criterion (thread 64).

**Step 6 — the four-eyes rule from both sides of the same URL.** The page that
showed the owner **لا يمكنك البتّ في طلبك أنت** and *no decision control at all*
renders **اعتماد / رفض** to the reviewer, with the **بدون رقم تسلسلي** badge and
its explanation in front of them. Nothing changed but the account.

**Step 7 — every consequence the approval panel promises, checked.**

| Promise | Result |
|---|---|
| Remote ID issued | `AJN-V56M-NAX6` and `AJN-Y74H-2740`, both `active` |
| Three-year validity | 2026-08-25 → 2029-08-25 = **1096 days** each (2028 is a leap year) |
| Audit trail | `drone.approved` **and** `remote_id.issued`, `actor_role: reviewer`, sharing a timestamp — one transaction |
| In-app notification | `droneApproved` × 2 |
| QR rendered | `qr/AJN-V56M-NAX6.png` (4051 B), `qr/AJN-Y74H-2740.png` (3981 B) |
| Email logged | `drone-approved`, `ar`, `status: skipped` — no Resend key, labelled honestly |
| Job runs | two `qr-render` rows, `completed`, no error, `trigger_event: drone/approved` |

**`pnpm verify:qr` now passes 22/22**, up from 14/14 — five stickers instead of
three, each byte-identical to a fresh render of `{APP_URL}/ar/rid/{code}` at
512×512, negative control included.

**How the render was invoked, stated plainly.** The two `drone/approved` events
were posted to the Inngest dev server directly, because triggering them through
the app needs the *owner's* session — Regenerate and the system page's
re-render are both admin-only and the browser held the reviewer. The approval
path that sends the event is the thing that was fixed, and it was exercised
twice; what was not re-driven in a single click is send-and-render together.

---

---

## Defects found by driving the app, and fixed

### A successful upload the pilot could not see

`src/components/upload/photo-grid.tsx` copied its `photos` prop into
`useState`, which reads its argument on the **first render only**. So the grid
kept its mount-time array for ever and discarded every payload that arrived
afterwards.

`step-photos.tsx` had the seam exactly right — `onUploaded={() => router.refresh()}`,
with a comment explaining that the grid must render database rows because the
upload response carries no row id. **The refresh fired, returned 200, and
carried the new rows. The grid threw them away one component down.**

| Link | Observation |
|---|---|
| Upload | `POST /api/upload` → **200** |
| Database | row count rose on every upload |
| Refresh payload | fetched the current RSC URL: **4 photo references** while the DOM held **2** |
| Cause | `const [photos, setPhotos] = useState(initial)` |

**Why it matters for the demo:** a first-time pilot uploads their one required
photograph, sees an empty grid and a *"at least one photo is required"*
warning, and concludes the upload failed. This is the happy path of step 4.

**Fixed with `useOptimistic`**, which derives from the prop instead of shadowing
it, and whose rollback story is free — a refused action simply stops being
applied, so the manual restore is gone. Reorder applies **by id, not index**, so
a payload arriving mid-transition reorders what exists.

Re-verified on the real page after a rebuild: **5 photos on load → 6 after
upload with no navigation**; delete **sticks**; reorder persists and **the
database agrees with the screen** (`sort_order` 0/1 matched the rendered
order); files on disk match rows exactly, so **no orphaned bytes**.

### Arabic-Indic digits in every numeric input — `<input type="number">`

On the Arabic booking form the planned-altitude field drew **`١٢٠`** while the
ceiling hint one line below drew **`120`**.

**`<input type="number">` renders its *display* value through the browser's
locale** — the same trap as the already-banned `<input type="date">`, in a
plainer coat. The DOM `value` stays ASCII (`31 32 30`) throughout, so
`innerText`, every one of the 1114 tests, and `i18n:check` all read `"120"`.
**Only a screenshot ever catches it.**

Proved by elimination on the live element, in this order: text direction
(flipping to rtl changed nothing), `lang`, the `locl` font feature
(`"locl" 0` changed nothing), and element type (a `type="text"` input with the
identical font renders Latin). Then decisively: **the same element, switched
from `type="number"` to `type="text"`, went from `١٢٠` to `120`.**

The blast radius was much larger than the field that revealed it — the admin
zone editor's shared `NumberField` meant **35 numeric inputs on
`/admin/zones/{id}` were all rendering Arabic-Indic digits.**

Fixed in both places by the pattern this codebase **already documented in three
comments** (`step-specs.tsx`, `step-identity.tsx`, `drone.ts`): `inputMode="numeric"`
with `dir="ltr"`, no `type="number"`. `min`/`max` went with it — inert on a text
input, and the ceiling was never theirs to enforce: `above_ceiling` comes back
from the server. `NumberField` now **ignores** an unparseable keystroke rather
than turning it into `null`, which is a real value meaning "no ceiling".

**And the rule is now enforced, not merely written down.** Three components
carried the warning in prose and two others shipped the bug anyway, so
`no-restricted-syntax` in `eslint.config.mjs` now bans both `type="number"` and
`type="date"` in JSX. **The rule was proved to fire** — re-introducing
`type="number"` produces the error — before it was kept.

Verified after rebuild: the altitude field and its hint both read `120`; all 35
zone-form inputs are `type="text"` and render Latin; letters are ignored and
digits accepted. `tsc` clean, `lint` clean, **1114/1114 tests pass**.

## Defects found by driving the app, and fixed (Session 46d)

### An approval that committed and reported a crash

Pressing **اعتماد** returned Next's error page. The registration had been
granted anyway: status `approved`, Remote ID minted, audit rows written. The
digest on screen matched the serve log exactly —

```
⨯ Error: Failed to send event … We couldn't find an event key … digest: '1800274008'
```

`approveDroneAction` sends `drone/approved` **after** the transaction commits,
which is the right ordering — but the send was **unguarded**. With no event key
it throws, the exception escapes the action, and Next renders a 500 over a
decision that succeeded.

**The guard already existed elsewhere.** `suspendZoneAction` has carried it
since thread 69, and its comment describes this incident almost word for word:
*"it threw, in a browser, over a suspension that had already been written … the
status changed and the person who changed it believes it did not."* It was never
applied to the drone decisions — the one action this product is a demo of.
`approveDroneAction` and `revokeDroneAction` were both bare; **all four
`inngest.send` call sites are now inside `try`.**

**The guard alone was not enough.** `stickerQueued: false` reaches the panel,
but the panel unmounts the moment the page re-renders as decided — a warning
nobody can read. The durable form of the same fact is a row: an approved
registration whose Remote ID has no `qrPathname`. The decided box now reads that
and says the sticker was not drawn and the pilot was not emailed. **Verified in
both directions**: it appeared on a fresh load after the failed send, and
**cleared itself** once the QR existed.

### A production serve could never run a job

`INNGEST_DEV=1` did nothing while the log kept printing *"set the INNGEST_DEV
env var"*. `src/lib/inngest/client.ts` passed
`isDev: process.env.NODE_ENV !== "production"` — and **passing `isDev` at all
disables the SDK's own documented switch.**

So under `next start` the app was permanently in cloud mode, answered
`/api/inngest` with 500, and no job could run against a local dev server. That
is why F23c's fan-out had to be driven under `pnpm dev`, and why Inngest has sat
on the un-runnable list since Wave 4.

`INNGEST_DEV` now wins when set, with the `NODE_ENV` derivation as the default
so a fresh clone still works with no env at all. On a **production serve**, for
the first time on this machine: `PUT /api/inngest` → **200**, app `ajniha`
**connected with 11 functions**. `.env` was not modified — the flag is passed
inline to `pnpm start`.

## Two instruments that lied

1. **The extension's network panel reported `503` on four requests that
   actually returned `200`.** After every upload it showed the router refresh
   and three header prefetches as 503. Nothing in this repo emits 503 and
   nothing in `next/dist/server` contains the literal. Patching `window.fetch`
   in the page — the app's own view of its own requests — showed **200 on all
   five**. A 503 in that panel is not evidence.
2. **`read_page` prints an input's `value`, not its accessible name.** The
   build-type radios listed as `commercial` / `self_built` / `fpv` and looked
   like untranslated enum codes shipped to users. They are not: each radio is
   wrapped in a real `<label>` carrying the Arabic text.

## Found, not fixed

1. **The signed-in header overflows at 375 px** — numbers above. A design
   decision.
2. **Copy the screen beneath it contradicts.** The masked-ID hint reads
   *لا تظهر الوثيقة كاملة في أي شاشة* — absolute — and the reveal panel two
   centimetres below shows exactly that. Either the sentence or the affordance
   should change; which one is the user's call.
3. **Refusal reasons outlive their cause.** After the past-slot refusal,
   *أسباب الرفض* stayed rendered through steps 2, 3, 5 and 6 even after a
   different, valid date was chosen. It reads as a standing objection to a
   booking the app then accepts.
4. **`PROBE18B` is still every seeded aircraft's name.** صقر الرياض now sits
   beside them, which sharpens the contrast on every signed-in screen.

---

## Named as un-runnable

Stated, never assumed.

| Not run | What it would need |
|---|---|
| **Step 13** — racing the last seat from two browsers. | A second signed-in **pilot**: the reviewer has no pilot profile and no aircraft, and الثمامة's capacity is 6, so there is no last seat. Cheapest route is a capacity-1 zone created from `/admin/zones/new`, raced, then archived. |
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
