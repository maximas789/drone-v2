# Build Log

**What actually exists**, session by session. The [implementation plan](./implementation%20plan.md) is the spec; this file is the truth. Where they disagree, this file wins — then go and correct the plan.

Written for a **cleared context**. Assume the next session knows nothing except what's here.

---

## How to use this

**At the start of a session:** read this file top to bottom before touching code. The Pinned Versions table and the Open Threads section are the two that will bite you if skipped.

**At the end of a session, before `/clear`:** append an entry using the template at the bottom. Non-negotiable — an unwritten session is a session the next one will contradict.

**Rules for entries:**

- Record **deviations, not successes.** "Built F03 as specified" is one line. The column you added that isn't in the spec is five.
- Every deviation gets a **why**. A future session will otherwise "fix" it back.
- If you couldn't verify something, say so and say what it would need. Never write "works" for something you didn't run.
- Update the plan or the feature file when you deviate, and note here that you did.

---

## Status

| Wave | Features | Status |
|---|---|---|
| 0 — Groundwork | F01 | ⚠️ Done with deviations (Session 1) |
| 1 — Shell | F02 | ⚠️ Done with deviations (Session 2) |
| 2 — Database | F03, F04 | ⚠️ Done with deviations (Sessions 3–4) |
| 3 — Auth | F05 | ⚠️ Done with deviations (Session 5). **All acceptance criteria verified**, including against a production build. |
| 4 — Platform services | F06, F07, F08, F09 | ⚠️ **Complete, with deviations (Sessions 6–9).** Vercel Blob and real email delivery are the two paths never executed. |
| 5 — Domain core | F10–F15 | ⚠️ **Complete, with deviations (Sessions 10–13).** |
| 6 — Pilot experience | F16–F21 | 🟨 **In progress (Session 14).** F17 done with deviations; F16, F18–F21 not started. |
| 7 — Admin | F22–F25 | ⬜ Not started |
| 8 — Close-out | F26–F30 | ⬜ Not started |
| 9 — Prove it | F31 | ⬜ Not started |

Legend: ⬜ not started · 🟨 in progress · ✅ done · ⚠️ done with deviations (see entry)

---

## Pinned versions — from Wave 0 research

**Filled in by F01 and never guessed afterwards.** No version number goes anywhere in the codebase; this table exists so later waves don't re-research or invent one. Record what was verified against a primary source (the package's own docs, changelog, or the registry) versus what was inferred.

**Method:** `npm view <pkg> version` against the public registry on 2026-08-15 — the registry is the primary source for "what is current stable". Rows marked *installed* are what the lockfile actually resolved; rows marked *latest only* were researched for a later wave and are **not yet installed**.

| Package | Version found | Source | Notes / deprecations |
|---|---|---|---|
| next | 16.3.1 | registry · installed | Turbopack is the **default** bundler; `--turbopack` is no longer a `create-next-app` flag (`--rspack` is the opt-out). Ships `next typegen`. |
| react / react-dom | 19.2.8 | registry · installed | |
| typescript | 7.0.2 latest; **5.9.3 installed** | registry | `create-next-app` pins `^5`. TS 7 is the native port — deliberately not forced ahead of the framework. Revisit only if a wave needs it. |
| tailwindcss | 4.3.3 | registry · installed | v4, CSS-first config. No `tailwind.config.ts`. |
| eslint | 10.8.1 latest; **9.39.5 installed** | registry | `eslint-config-next@16.3.1` declares `eslint ^9`. Flat config either way. Do not force 10 until the Next config supports it. |
| eslint-config-next | 16.3.1 | registry · installed | Exports `eslint-config-next/core-web-vitals` and `/typescript` as flat-config arrays. |
| shadcn | 4.18.0 | registry · via `dlx` | CLI only, not a dependency. Detected Next.js + Tailwind v4 unaided. |
| vitest | 4.1.10 | registry · installed | |
| drizzle-orm | 0.45.2 | registry · installed | F03 |
| drizzle-kit | 0.31.10 | registry · installed | F03 |
| better-auth | 1.6.29 | registry · installed | F05. Pulls `better-call`, which peer-wants zod ^4 and **resolved zod 4.4.3 into its own tree** — the pnpm warning is about the root, where drizzle-kit's zod 3.25.76 sits. Runtime is unaffected. |
| next-intl | 4.13.6 | registry · installed | F02. `createNavigation` (not the old `createSharedPathnamesNavigation`); `requestLocale` is deprecated in favour of `next/root-params`. |
| @base-ui/react | 1.7.0 | registry · installed | Pulled in by shadcn. Composition prop is **`render`**, not Radix's `asChild`. |
| maplibre-gl | 6.3.0 | registry · latest only | F20 |
| terra-draw | 1.32.3 | registry · latest only | F23 |
| resend | 6.20.0 | registry · installed | F06. `emails.send()` returns `{ data, error }` and does **not** throw on an API error; `idempotencyKey` is the *second* argument, not a payload field. |
| react-email | 6.9.2 | registry · installed | F06. One package: components **and** `render`/`toPlainText` (it re-exports `@react-email/render`, which resolves to 2.1.0). Not `@react-email/components`, which still installs and still resolves. **`render()` is async.** |
| @vercel/blob | 2.8.0 | registry · installed | F07. `put(pathname, body, { access, addRandomSuffix, allowOverwrite, contentType })`, plus `head` and `del`. **Never executed** — no token, no store. |
| inngest | 4.18.1 | registry · installed | F08. **v4, and the v3 API is wrong in every detail that matters**: `createFunction(options, handler)` — two args, `triggers` inside options; middleware is a class extending `Middleware.BaseMiddleware`; typed events via `eventType` + `staticSchema`; `ClientOptions` has no `schemas`. `isDev` is not inferred from `NODE_ENV`. |
| zod | 4.4.3 | registry · latest only | Action input parsing |
| postgres (postgres.js) | 3.4.9 | registry · installed | **The chosen driver.** Works unchanged against Docker locally and Neon over TCP, so one code path covers both. `pg` was not installed. |
| server-only | 0.0.1 | registry · installed | Runtime dependency, not dev — `src/lib/db/index.ts` imports it. |
| tsx | 4.23.12 | registry · installed (dev) | Runs `db:seed`. Resolves the `@/*` alias from tsconfig, which plain `node` does not. |
| qrcode | 1.5.4 | registry · installed | F19's renderer, installed early by F08 — the QR is rendered as a job. `@types/qrcode` is a dev dependency. |

### Deprecations & API changes found

Anything a skill reference file got wrong, so it can be corrected and so no later wave repeats the mistake.

| Reference file | What it says | What's current | Action taken |
|---|---|---|---|
| `features/F01-project-shell.md` | `create-next-app … --turbopack` | Flag removed — Turbopack is the default in Next 16 | Dropped the flag. Feature file updated. |
| `features/F01-project-shell.md` | Scaffold into `.scaffold-tmp` | npm rejects a package name starting with `.` | Used `scaffold-tmp`. Feature file and `CLAUDE.md` updated. |
| `features/F01-project-shell.md` | `"dev": "next dev --turbopack"` | Turbopack is default; scaffold writes plain `next dev` | Left as the scaffold wrote it. Feature file updated. |
| `features/F01-project-shell.md` | `"typecheck": "tsc --noEmit"` | Next 16 generates `LayoutProps`/`PageProps` into `.next/types`; bare `tsc` fails on a clean tree | Script is `next typegen && tsc --noEmit`. Feature file updated. |
| `features/F02-i18n-rtl-foundation.md` | `src/middleware.ts` | Next 16 **deprecates** the `middleware` filename and the `middleware` named export; it is `proxy.ts` exporting `proxy`, nodejs runtime only, no edge | Built as `src/proxy.ts`. Feature file, plan and `CLAUDE.md` updated. |
| `features/F03-database-schema.md` | volume at `/var/lib/postgresql/data` | Postgres 18+ wants the mount one level **up**, at `/var/lib/postgresql`, and restart-loops on the old path | `docker-compose.yml` mounts `/var/lib/postgresql`. Feature file updated. |
| Drizzle setup | (implicit) enums live in `enums.ts` | drizzle-kit reads **only** the file named in `drizzle.config.ts`, so the enums produced no `CREATE TYPE` at all | `schema.ts` now does `export * from "./enums"`. Caught by reading the SQL — see the session entry. |
| `features/F02-i18n-rtl-foundation.md` | next-intl's `requestLocale` in `i18n/request.ts` | Deprecated by next-intl in favour of `next/root-params` (introduced in Next **16.3.0** — the exact version installed) | Used `next/root-params`. Carries a Server-Action caveat, see Decisions. |
| shadcn `Button` usage | Radix-style `asChild` | shadcn is on Base UI now; the composition prop is `render` | Corrected again in F05 — see the row below. |
| `CLAUDE.md` traps + F02's home page | `<Button render={<Link href="…" />}>` for a link-styled button | Base UI's `Button` **logs a console error** when `render` yields a non-`<button>`, and its named escape hatch `nativeButton={false}` sets `role="button"` on the `<a>` — so a screen reader announces a navigation control as a button | Added `src/components/ui/button-link.tsx`, which styles a genuine anchor from the same `buttonVariants`. All 8 call sites converted, including the 2 on F02's home page that had been emitting the error since Wave 1. `CLAUDE.md` and the F05 feature file updated. **Reported by the user, not found by any check we run** — see Open Thread 11. |
| `features/F05-auth-roles-access.md` | `pnpm dlx @better-auth/cli generate --config src/lib/auth.ts` | The CLI loads the config outside React and **refuses** any config that reaches `server-only`, however transitively: *"Please remove import 'server-only' from your auth config file."* `src/lib/db/index.ts` carried it | Pool moved to `src/lib/db/client.ts` (no `server-only`); `index.ts` is now `import "server-only"; export * from "./client"`. ESLint rule 6 confines `@/lib/db/client` to `src/lib/auth.ts`. Feature file updated. |
| `skills/.../references/email.md` | `pnpm add -D @react-email/ui` and `email dev --dir src/emails` for previews | The preview surface F06 specifies is a route in **this** app (`/[locale]/dev/emails`), which renders through the same `renderEmail` that sends. `email dev` expects default-exported components with its own prop conventions and would have been a second, divergent renderer | Neither package nor script installed. Feature file updated. |
| `skills/.../references/email.md` | `email_log.status` reaches `logged` when there is no key | F06's own table says `skipped` | `skipped`. Statuses are `queued → skipped \| sent \| failed`. |
| `skills/.../references/email.md` | `sendEmail({ …, react })` — hand the React element to Resend | Works, but then the terminal fallback and the preview page would each need their own renderer, and what you preview would not be what is sent | We render **once** to `html` + `text` and send those. The plain-text render is also what prints to the terminal. |
| Better Auth generated schema | (implicit) timestamptz everywhere | The CLI emits `timestamp` **without** time zone on all four tables | Left exactly as generated — the rule to not edit CLI output wins. Drizzle writes `toISOString()` and reads back with `+0000`, so instants round-trip correctly; the column just doesn't carry the zone. Feature file updated. |

---

## Open threads

Things left unresolved that a later session must pick up. **Delete a row when it's closed** — a stale thread is worse than none.

| # | Thread | Raised in | Blocks |
|---|---|---|---|
| 1 | `.env` values the user must supply: `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`, Inngest keys. All optional — the app must work without them, and as of F07/F08 it demonstrably does: local storage driver, terminal email, `isDev` Inngest. The cost is that the **production** driver of each is unexecuted code. | Planning | Nothing; degraded paths are specified and exercised |
| 2 | ~~`ID_HASH_PEPPER`~~ and ~~`RATE_LIMIT_PEPPER`~~ — **both generated, both in `.env`** (F09 and Session 14). Kept as a standing warning, not a task: **neither can ever be rotated.** `RATE_LIMIT_PEPPER` orphans every `audit_event.ipHash`; `ID_HASH_PEPPER` orphans every `pilot_profile.id_document_hash`, and since that column is UNIQUE, "one person, one profile" silently stops holding for everybody who registered before the change. | Planning | Nothing — but never regenerate |
| 3 | Something else on this machine already occupies **port 3000** (it serves a next-intl app that 307s to `/ar` — not this project). `pnpm dev` fell through to 3001. Any URL, QR or `APP_URL` written assuming 3000 will point at the wrong app. | F01 | F19, F29 |
| 4 | **`next/root-params` does not work in Server Actions or Route Handlers.** `src/i18n/request.ts` honours an explicit `locale` first, so any action needing translated text must call `getTranslations({ locale, ... })` with the locale passed in (e.g. bound into the action). An action that calls bare `getTranslations()` will throw at runtime, not at build. | F02 | F14, F18, F21, F22 — every wave with server actions |
| 11 | **Nothing in `pnpm lint` / `typecheck` / `build` / `test` catches a rendering defect.** F15 is the second proof: a duplicated locale switcher and sign-out button rendered on `/dashboard` with all five checks green, and was found by opening the page. Earlier: Base UI's `nativeButton` warning had been firing on F02's home page since Wave 1 and every check stayed green; the user found it by opening the page. **F06 opened three pages in Chrome and found them clean**, so the thread is no longer untouched — but it is still a manual pass with no automation behind it, and every other route is unopened. F31's gate needs a real browser pass, and F20/F23 (MapLibre, terra-draw) are the likeliest to hit this again. | F05 | F31, and every UI wave |
| 12 | **`BETTER_AUTH_URL` must equal the origin the app is actually served from**, or every auth POST is refused with `INVALID_ORIGIN` — sign-in included. Found by serving the production build on a different port. It is the same class of failure as the `APP_URL` QR trap and fails just as silently in a browser. F29's system page should check it. | F05 | Deployment, F29 |
| 16 | **A dev-mode 404 embeds a stack trace naming the guard** (`requireReviewer`, absolute file path) in its RSC payload; the production build does not. So the "404, not a stack trace" criterion is **only meaningful against `next start`**. F31 must run its route checks against a production serve, never `next dev`. | F05 | F31 |
| 14 | **`drone.owner_user_id` and `booking.pilot_user_id` are `ON DELETE RESTRICT`**, so deleting an account that holds registered aircraft or bookings is refused by the database — while `deleteUser` is enabled in `src/lib/auth.ts`. Deliberate: a registration record is not personal data to take away. **F28 owns the consequence** and must offer a real path (revoke, or transfer) instead of a raw delete that errors. | F05 | F28 |
| 35 | **`drone_report` has no triage columns and no reviewer queue.** Reports are written, audited and listed on `/admin` newest-first, but there is no "handled" state, no assignment and no way to close one. Deliberate — an enum member nothing writes is a lie about what the app does — so **F22 owns adding whatever its queue needs**. | F11 | F22 |
| 36 | **`viewerLevelFor` was never exercised with a reviewer who is also the drone's owner.** Staff wins by the order of the checks, so such a person sees the staff branch and their own reveal control; no row like that has ever existed. Worth a deliberate case when F22 gives reviewers aircraft. | F11 | F22, F31 |
| 15 | **`role` reaches the app as `string \| null`, not a union.** Better Auth types an `additionalField` declared as a list of literals as a plain `string`. `roleOf()` in `src/lib/session.ts` narrows it and **fails closed** — anything unrecognised is treated as `pilot`. Never read `session.user.role` directly; use `roleOf` / `isReviewer` / `isAdmin`. | F05 | Every wave that branches on role |
| 10 | **Nothing has checked the seeded polygons for self-intersection**, and no one has seen them on a map. F20 is the first render. | F04 | F20 |
| 17 | **`emailConfigured` is baked in at build time on the SSG auth pages.** `/[locale]/forgot-password` and `/verify-email` are prerendered, so the "no provider configured" notice reflects `RESEND_API_KEY` as it was during `next build`, not as it is at runtime. Setting the key on the host without rebuilding leaves the wrong sentence on the page. Same class as the `APP_URL` QR trap. | F06 | F29 (should check it), deployment |
| 18 | **Nothing consumes `email_log` in the UI yet.** The rows are written and are the answer to "why didn't that email arrive?", but there is no screen that shows them. F29's system/ops page owes that. No Resend **webhook** was built either, so `delivered`/`bounced`/`complained` never arrive — deliberate: the endpoint needs a public URL and a signing secret. | F06 | F29 |
| 19 | **`/dev/emails` sample links always carry the `ar` prefix.** Each template's `sample` is a static object built at module load with `localeUrl(path)`, whose default locale is Arabic, so the *English* preview shows `/en`-less URLs. A preview-data artefact only — real sends get the recipient's locale from the caller. | F06 | Nothing; cosmetic |
| 21 | **Better Auth's own `rate_limit` table stores raw IP addresses** in its key (`0000:0000:…:0000\|/sign-up/email`). Ours does not — `rate_limit_bucket` keys on `sha256(pepper + ip)` — but the framework's key format is not ours to choose and there is no hook to hash it. F27's privacy page must therefore **not** claim the app never stores an IP address. Rows are short-lived but not swept by us. | F09 | F27, F29 |
| 22 | **Any bare numeric argument in an ICU message renders Arabic-Indic digits.** next-intl formats `{count}` itself using the page locale, so `ar` gives `٣`. `messages/ar.json` already carries two such messages — `booking.slotsRemaining` (`#` in the plural branches) and `admin.pendingCount` — neither of which is rendered yet. The rule is: **numbers reaching a message go through `src/lib/format.ts` first** and arrive as strings. ESLint cannot see this route. | F09 | F21, F22, F25 |
| 23 | **`scripts/i18n-check.mts` cannot tell a plural branch body from a placeholder.** `one {second}` is reported as a placeholder named `second` and fails the check as drift. Worked around in F09 by formatting the unit in `format.ts` instead — which was the better answer anyway — but the next person to write an English plural whose branch body is a single word will hit it. | F09 | any wave writing plurals |
| 24 | **Anything Better Auth calls back into runs *inside* its transaction.** F06's email send did, and the `email_log` insert failed on a foreign key onto a `user` row that was written but not yet committed — over a different pooled connection, which could not see it. Fixed with Next's `after()`. **Every later callback into Better Auth has the same hazard**, and so does anything F14 does in a `databaseHooks` hook. | F09 session | F14, F17, F28 |
| 25 | **A raw `sql` expression in a drizzle select returns a string, not a `Date`.** Drizzle has no column type to map through a raw `sql` expression and postgres.js hands back text; the first thing that formats it throws `Invalid time value`. In F08 it threw inside `sendEmail`'s `try` **before** the `email_log` insert, so the failure wrote **no row at all** and the job reported success. Select the column and narrow in code. The latent half — `sendEmail` rendering before it logs — is untouched and would swallow the next one the same way. | F08 | F29 (the log is the answer to "why didn't that email arrive?"), anything selecting a timestamp expression |
| 26 | **`export *` from `src/lib/db/schema.ts` does not re-export `user` under plain Node ESM**, because `schema.ts` also imports the name locally. Next's bundler papers over it — the app is fine — but any `tsx` script must import from `@/lib/db/auth-schema`. | F08 | any future script or seed |
| 27 | **No cron has ever fired on its own schedule.** Every F08 run so far was triggered by hand from the dev dashboard. Whether Inngest honours `TZ=Asia/Riyadh` as intended rests on the server accepting the expression, not on anyone having watched 03:00 Riyadh arrive. | F08 | F31 |
| 28 | **`job.rerunOfRunId` and the `cancelling` status are never written.** The SDK supplies neither: F29 must write `cancelling` when it sends a cancel, and `rerunOfRunId` on the new run when it initiates a re-run. `cancelled` *is* written, by `run-cancelled.ts`. | F08 | F29 |
| 30 | **The Vercel Blob driver has never run.** No token and no store on this machine, so `src/lib/storage/blob.ts` is unexecuted: the `put`/`head`/`del` calls were written from the installed `.d.ts`. The first deploy with a token is the first execution, and `addRandomSuffix: false` + `allowOverwrite: true` are the two options a wrong guess would show up in (a mismatched pathname makes `deleteFile` miss, which is an orphaned blob, which is a privacy leak). | F07 | Deployment, F29 |
| 31 | **Blob objects are stored `access: 'public'`.** Nothing in the app emits a blob URL — `fileUrlFor` returns `/api/files/…` and that route checks ownership — but a URL that escaped by other means would resolve, for ever, including after the row is deleted. `access: 'private'` is the fix; it was not taken because there is no store to prove it against. **F27's privacy page must not claim otherwise**, and it only matters once a token is set. | F07 | F27, deployment |
| 32 | **The upload delete/reorder *actions* were never driven over HTTP** — only their data layer was, plus the reviewer refusal path in the browser. The guard-then-rate-limit prologue is the same three lines F09 verified elsewhere, but this specific pair has not been posted at directly. Same gap as F09's own "direct action POST". | F07 | F31 |
| 33 | **HEIC is rejected, and iPhones shoot HEIC by default.** The kind table accepts JPEG, PNG and WebP only; a pilot photographing their drone on an iPhone with default settings gets `upload_type_rejected` and no explanation of why their photo app produced a file the site will not take. Nothing has been uploaded from a real phone. Either the table grows a sniffer for it or the copy has to say so. | F07 | F18, F31 |
| 37 | **A booking has no launch point, so no-fly overlays are not resolved at booking time.** `createBookingAction` evaluates with `AirspaceQuery.zoneId` because the booking form picks a zone, not a coordinate, and `booking` has no lat/lng column. A permitted zone overlapping a no-fly zone would therefore be bookable at the overlap — the *map* resolves it (point query), the booking does not. The seeded `RUH-P-01` and `RUH-NF-KKIA` touch in a ~50 m sliver, so this is not hypothetical. **Either F23 refuses to publish an overlapping permitted zone, or F21 sends the launch point and the schema grows a column for it.** | F12/F13 | F21, F23 |
| 38 | **The seeded zones open at 06:00 and Riyadh sunrise is 06:34 in December.** A zone with `nightAllowed: false` therefore refuses its own first slot for part of the year — the engine is right (you may not fly before sunrise) but the hours and the rule disagree, and F21's picker will show slots that are always refused. `slotStates` has no `night` state to grey them with, deliberately: F13's state table has five members and inventing a sixth here would put sun maths in the slot grid. **F21 or F23 owns the reconciliation.** | F12/F13 | F21, F23 |
| 40 | **Most server actions have still never been driven over HTTP** — 21 exist. **Session 14 broke the drought**: F17's two were driven from a real browser session *and* POSTed at directly with no cookie (both refused `unauthorized`). The other 19 remain untouched — F18 owns registration, F20 the map, F21 booking, F22 the queues. Still the largest standing gap. | F12/F13/F14 | F18, F20, F21, F22, F31 |
| 41 | **"A reviewer approves and the pilot gets an email with a QR" has never run as one flow.** `approveDroneAction` sends `drone/approved`; F08's `qr-render` job renders and mails. Both halves are proven — the job against hand-triggered events, the action against the database — but Inngest was not running during F14's probe and no Resend key exists, so the seam between them is structural. | F14 | F31 |
| 42 | **An admin can approve their own drone.** Staff hold `owner` and `admin` at once, deliberately, so that staff can use the app as pilots; the cost is no segregation of duties on a decision. It also cannot be blocked in this build, where the only admin is the only account. **F22 owns a four-eyes rule** if it wants one. | F14 | F22 |
| 43 | **`notification.emailLogId` is wired on the approval path only.** `linkNotificationEmail` matches on `(userId, entityId)` and `qr-render` calls it after sending. The expiry sweep, the booking reminders and the closure fan-out all send email beside a notification and do not link it, so F29's "why didn't that email arrive?" answers for approvals and shrugs for the rest. | F15 | F29 |
| 44 | **375 px works through a same-origin iframe, and only that way.** `resize_window` reports success and leaves the viewport at 1440 — six attempts across five sessions. The technique that works: inject an `iframe` 375 px wide pointing at the page, whose media queries evaluate at its own width, then measure `scrollWidth` vs `clientWidth` inside it. **F31's gate must use this**, not the tool. | F15 | F31, every UI wave |
| 45 | **A reviewer has no way to reveal a pilot's identity document.** F11's `revealIdentityAction` keys on a **Remote ID code** and resolves through `getRemoteIdRecordByCode`, so a reviewer opening a *pilot profile* — which need not have a drone at all — has nothing to call. F17 built no reviewer surface by design. **F22 must either widen that action to take a profile id or add a sibling**, and whichever it does, the audit event must still be written *before* the value is returned. | F17 | F22 |
| 46 | **`<input type="date">` is unusable in this app.** Chrome renders it from the **browser's** locale and ignores `lang` on the element and on `<html>` — proven by setting both. Under an Arabic Chrome it prints `٠٤/٠٥/٢٠١٢` and a reversed `ةنس/رهش/موي` placeholder, which is rule 6 broken through a surface `format.ts` cannot reach. `DateOfBirthInput` (three selects) is the pattern. **Native `required` is banned for the same class of reason**: it cancels the submit and speaks the browser's language, so the app's bilingual refusal never runs. Both found by opening the page. | F17 | F18, F21, F23, F31 |
| 5 | The `[locale]` segment is a catch-all for unknown paths, so `/anything.txt` reaches the layout. `hasLocale` + `notFound()` handles it, but F30 must still confirm `robots.txt` and `sitemap.xml` resolve as real routes rather than being swallowed. | F02 | F30 |

---

## Decisions made mid-build

Choices not in the plan, or that changed it. Each needs a reason a future session will accept.

| Date | Decision | Why | Plan updated? |
|---|---|---|---|
| 2026-08-17 | **The `zoneAr`/`zoneEn` pair is collapsed in the renderer**, not by the writer and not in the catalogue. | `notify()` demands both variants so rendering needs no join; `i18n:check` forbids a catalogue that carries both. The renderer is the first point that knows which language the reader chose — it is the only place the collapse can happen. | Feature file updated |
| 2026-08-17 | **`src/lib/data/notification.ts` is exempt from rule 11.** | Read/unread is not a domain status: no transitions, no actor, nothing to notify, nothing to audit. Same call as `jobs-table.ts`. The exemption is that one file — F15's own probe had to use raw SQL to reset rows. | n/a |
| 2026-08-17 | **Notification preferences live on the notifications page**, not on a settings page. | F28 owns account settings and does not exist. A Settings section holding a single panel would be a claim about a page the app does not have. | Feature file updated |
| 2026-08-17 | **`localeHref` was deleted after being written and tested.** | `Link` from `@/i18n/navigation` already prefixes the locale, so the helper was dead on arrival, and a dead export is a lie about what the app does. Replaced by a test asserting no writer *stores* a locale-prefixed href — the thing that actually matters. | n/a |
| 2026-08-17 | **An actor holds several `ActorKind`s at once**, and an edge needs one of them to match. | A reviewer cancelling their own booking is both `reviewer` and `owner`. A single "highest" kind would stop staff using the app as pilots — the exact population this product exists for. An admin implicitly holds `reviewer`, so no edge lists both. | Feature file updated |
| 2026-08-17 | **An admin may approve their own drone.** | The kinds overlap by design, and in this build the only admin is the only account — blocking it would deadlock the app. Stated rather than hidden; F22 owns a four-eyes rule if it wants one. Open Thread 42. | Feature file updated |
| 2026-08-17 | **The written-reason check runs before the edge-legality check.** | A reviewer who typed "no" must be told to write a reason, not told the transition is invalid. Two different things, and only one of them is true. | Feature file updated |
| 2026-08-17 | **`registrationExpiryFrom` and `pilotMayCancel` live in a pure `src/lib/workflow/rules.ts`.** | The first version sat behind `server-only` in `drone.ts` and no unit test could import it — the same trap F09 hit with the rate-limit rules. Arithmetic that decides when a registration lapses is exactly what must be testable without a database. `actorKindsFor` moved to `transitions.ts` for the same reason. | Feature file updated |
| 2026-08-17 | **Auto-approval is a real transition inside the creation transaction**, not an `approved` value in the insert. | An automatic approval is still a decision, and a status that appeared with nothing recording who decided it is what `src/lib/workflow/` exists to prevent. | Feature file updated |
| 2026-08-17 | **The approval re-check passes no availability and no busy slots.** | The booking already holds its seat; feeding its own row back to the engine would have it refuse itself with `slot_full` and `duplicate_booking`. Capacity was decided by the unique index at claim time. | Feature file updated |
| 2026-08-17 | **`time.ts` does Riyadh civil time as arithmetic, not through `Intl`** — and `time.test.ts` cross-checks it against `format.ts` on every day of a year. | A slot start must be byte-identical in a browser and on the server, or `booking_seat_uniq` protects nothing. `Intl` is the right answer for what a person reads and the wrong one for what an index compares. The cross-check is what turns "Saudi Arabia has no DST" from an assumption into a test. | Feature file updated |
| 2026-08-17 | **Real sunrise/sunset by the solar equation**, rather than a fixed night window. | Riyadh sunset runs from 17:07 in December to 18:44 in June. A fixed window is wrong by over an hour twice a year, and a zone that forbids night flight has to mean the actual sky. Verified to ±10 minutes against published times. | Feature file updated |
| 2026-08-17 | **The engine speaks ISO strings, never `Date`.** | The map fetches its context as JSON; the server builds it from rows. A `Date` survives one of those round trips and not the other, and the entire point of the module is that the two cannot disagree. | Feature file updated |
| 2026-08-17 | **`AirspaceQuery.zoneId`** — evaluate against a named zone, not only by containment. | The booking form picks a zone, a date and a slot. It does not pick a coordinate, and `booking` has no column for one. `point` still wins when both are given. The cost is that overlays are unresolved at booking time — Open Thread 37. | Feature file updated |
| 2026-08-17 | **Closures decide a slot's state, not whether it exists** — so `deriveSlots` does not take them and `slotStates` does. | A closed slot must still render, greyed. Dropping it from derivation would make the picker silently lose hours with nothing to explain the gap. | Feature file updated |
| 2026-08-17 | **`blocked` outranks `full` in the slot-state table.** | Telling a pilot a slot is full when the real obstacle is their own existing booking sends them hunting for another zone instead of looking at their own diary. | Feature file updated |
| 2026-08-17 | **No notification when a booking is created.** | The pilot is looking at the answer on screen. A row telling somebody what they have just done is the noise F08 already refused for `booking-closeout`; F14's decision is the news. | Feature file updated |
| 2026-08-17 | **`identity_unverified` added as a 27th reason code.** | `requirePilotProfile` already promised it by name. Merging it into `pilot_profile_incomplete` would tell somebody who filled in every field correctly to go back and complete the form. | Feature file updated |
| 2026-08-17 | `issueRemoteId` retries inside a **savepoint**, and the 23505 check **walks the error's cause chain**. | A unique violation aborts the whole Postgres transaction, so a bare retry answers "current transaction is aborted" instead of a second code. And drizzle wraps the driver error: `DrizzleQueryError.code` is undefined, the `PostgresError` is its `cause`. The first version read `code` off the top level, matched nothing and rethrew every collision — the retry loop never ran. Both found by forcing a collision. | Feature file updated |
| 2026-08-17 | `networkCapable: true` is written **at issue**, while the column default stays `false`. | Ajniha implements Network Remote ID itself, so an issued row has earned the claim — but a row created by any other route has not, and a capability the app cannot deliver is a lie in a regulator-facing record. | Feature file updated |
| 2026-08-17 | `getRemoteIdRecordByCode` returns the **whole** record to any caller, signed out included. | The one deliberate exception to what rule 8 usually means, and it is why F11 works: scoping in the data layer would put a second masking rule beside `redactRemoteId`, and two places deciding what a bystander may see is precisely the drift the single function exists to prevent. Bookings and the scan log *are* scoped there, because those are questions the redactor cannot answer. | Feature file updated |
| 2026-08-17 | `isIdentified()` is a **type predicate** rather than an inline `level !== "anonymous"` test. | TypeScript will not narrow a union away on the negative side of a disjunction when the member's own discriminant is a union — the public branch survives, and the compiler only *appears* to enforce the masking table. The `@ts-expect-error` test in `redact.test.ts` is what pins it. | Feature file updated |
| 2026-08-17 | A `drone_report` table, and an interim reports list on `/admin`. | F11 and F24 both file reports and no feature file names a table. Written with no triage columns — F22 owns the queue and should add what it needs rather than inherit an enum nothing writes. The list exists because "visible to reviewers" is otherwise a claim about a table nobody can read; same call as F05's role panel. | Feature file updated |
| 2026-08-16 | `/api/files/[...path]` **streams** stored bytes rather than redirecting to them, in both drivers. | A redirect hands the caller the blob's own URL, which then resolves for anyone they pass it to and long after the row is deleted — the ownership check would hold for the first request only. Streaming also means the local and blob paths behave identically, so what is tested locally is what runs. | Feature file updated |
| 2026-08-16 | The response `Content-Type` is **re-sniffed from the bytes on the way out**, with `nosniff`. | Trusting a stored column would mean a file that somehow got past the upload check is served as whatever the row claims. The bytes are the only thing that cannot have drifted. | Feature file updated |
| 2026-08-16 | Photo reordering is **buttons**, not drag-and-drop. | Drag has no keyboard path and no screen-reader story. And the directions are *earlier*/*later*, which are physically opposite in Arabic — naming by position is the only version that reads correctly in both languages. | Feature file updated |
| 2026-08-16 | A reviewer may **read** any stored file and **write** none. | Deciding on a registration means looking at the photographs; adding photographs to somebody else's aircraft is not part of that job, and `getDroneForUpload` therefore checks ownership only. | Feature file updated |
| 2026-08-16 | Job reads live in `src/lib/inngest/queries.ts`, not `src/lib/data/*.ts`. | Rule 8's session-first signature is how ownership stays legible; a cron has no session and must read every user's rows. A fabricated session in `src/lib/data/` would be an unauthenticated door in the exact module the rule exists to protect. Reads only — every write still goes through `src/lib/workflow/`. | Feature file updated |
| 2026-08-16 | The digest's "already sent" check reads `email_log`, not the `job` table. | A run that found an empty queue sent nothing; suppressing on "the function ran" would silence the run half an hour later that finds three pending items. `email_log` has a row only when a digest actually went out. `audit_event` could not answer it — `entityType` has no `system` member, and adding one for a mail marker would put a non-entity in the regulator's trail. | Feature file updated |
| 2026-08-16 | `isDev` is derived from `NODE_ENV` on the Inngest client. | v4 does not infer it. Without it the SDK is in cloud mode with no signing key and 500s every request to `/api/inngest`, including the introspection the dev CLI uses — so the symptom is an empty dashboard that names nothing. A fresh clone now works with no env at all, and production still demands a real key. | Feature file updated |
| 2026-08-16 | `drone/revoked` reuses the `booking.cancelled_by_closure` edge. | From the pilot's side it is the same fact: the authority took the slot away. Two names for one thing in the regulator's trail is worse than one that covers both; `reason` carries which it was. | Feature file updated |
| 2026-08-16 | A tenth function, `run-cancelled`, beyond F08's nine. | A cancelled run never reaches `onRunComplete` or `onRunError`, so its row would sit at `running` for ever and two `job_status` members would be unreachable. An enum value nothing can write is a lie about what the app does. | Feature file updated |
| 2026-08-16 | `src/lib/rate-limit.ts` became a **directory**: `rules.ts` pure, `index.ts` server-only, index re-exporting rules. | The first attempt put the window arithmetic behind `server-only`, and the test suite could not import it — first the `server-only` throw, then a missing `POSTGRES_URL`. Arithmetic that a connection string can veto is arithmetic nobody can unit-test. Same shape as `airspace/evaluate.ts` vs `airspace/query.ts`, and as `geo/`. `@/lib/rate-limit` still resolves. | Feature file updated |
| 2026-08-16 | Rules are evaluated **shortest window first, stopping at the first refusal** — a burst refused by the per-minute rule does not increment the daily bucket. | Evaluating every rule would let one accidental double-click storm burn a pilot's entire 20-per-day booking allowance, locking them out until midnight. F09's stated purpose is to stop abuse *without punishing normal use*; the spec does not say which way to resolve this, and this is the only reading consistent with that sentence. Proven: after a 4-in-a-minute burst the daily bucket sits at 3. | Feature file updated |
| 2026-08-16 | The counter **fails open** if the database errors. | The action behind the limit needs the same database, so a failure here means it is about to fail anyway; refusing would replace a real error with a misleading "too many attempts". Logged loudly — a limiter that is quietly off is worse than one that is off. | Feature file updated |
| 2026-08-16 | The retry countdown is built by `formatSeconds` in `format.ts`, not by an ICU plural in the catalogue. | A bare `{seconds}` is formatted by ICU itself and emits `٤٥` under `ar` — rule 6 broken through a route ESLint cannot see. CLDR also supplies Arabic's six plural categories for free. Opened Threads 22 and 23. | Feature file updated |
| 2026-08-16 | `authErrorKey` gained a `status` parameter and a `429` branch. | Better Auth's rate limiter answers **429 with no `code`**, so every auth form fell through to the generic "that didn't go through, please try again" — the single worst thing to tell someone who has just been rate limited. | Feature file updated |
| 2026-08-16 | A `user.role_set` limit was added beyond F09's table. | It is the only server action that exists today. Without it the whole of layer 2 would have shipped with no caller, and an unenforced limiter is an untested one. | Feature file updated |
| 2026-08-16 | Email copy lives in `messages/{ar,en}.json` under an `email` namespace, read through **`createTranslator`** rather than `getTranslations`. | One catalogue, so `i18n:check` covers email copy too and Arabic is still authored first. `getTranslations` was not an option: mail is sent from a Route Handler (root-params throws), from Inngest (F08, no request), and from the preview page. `createTranslator` is next-intl's own request-free core and takes full ICU, including the six Arabic plural categories. | Feature file updated |
| 2026-08-16 | The email translator is given **`ar-SA-u-ca-gregory-nu-latn`**, not `ar`, via a new `intlLocaleTag` export from `format.ts`. | ICU formats its own numbers for `{days, plural, … #}`. A bare `ar` puts `٣` in an email — the exact defect rule 6 exists to prevent, arriving through a route the ESLint rule cannot see. The forced tag still selects the Arabic plural category. | Feature file updated |
| 2026-08-16 | `sendEmail` is **dynamically imported** inside the Better Auth callbacks. | It reaches `@/lib/db` → `server-only`, and the CLI refuses any config that reaches it. A dynamic import inside a callback body is never evaluated at config-load time. Proven: the CLI ran and emitted a byte-identical `auth-schema.ts`. | Feature file updated |
| 2026-08-16 | `email_log` writes live in `src/lib/email/send.ts`, not behind a `src/lib/data/*.ts` function. | Rule 8 binds pages and server actions; `send.ts` is a service, has no session to take as a first argument, and the feature file puts the write there. **The read side is different** — when F29 lists email logs it must go through `src/lib/data/`, session first. | n/a |
| 2026-08-16 | The dev preview page carries **no message keys**; its chrome is hardcoded English. | It is a tool for whoever is building the app, not a surface of it. Dev-tool strings in the shipped catalogues would be a lie about what the app has, and `i18n:check` would then enforce translating them. | Feature file updated |
| 2026-08-16 | FK delete actions vary by meaning: `cascade` for the account's own data, `set null` for records of an action, **`restrict`** for `drone.owner_user_id` and `booking.pilot_user_id`. | A registration record is not personal data a pilot takes with them when they close an account — an airframe may be flying with an Ajniha sticker on it. Deleting such an account is refused at the database rather than silently erasing the registry. The cost is that `deleteUser` now fails for any pilot with aircraft, which F28 must handle properly (Open Thread 14). | Feature file updated |
| 2026-08-16 | The two `no-restricted-imports` blocks are composed from shared constants rather than written as one block per rule. | Flat config **replaces** a rule when a later block names it again. Adding rule 6 as its own block switched rule 5 off across the whole app, and nothing failed — `lint` stayed green. Both were re-proven on probes afterwards. | n/a |
| 2026-08-16 | `roleOf()` narrows `role` and **fails closed** to `pilot`. | Better Auth types a literal-list `additionalField` as plain `string`, and the column is nullable. A typo or a hand-edited row must never widen access; the only direction an unrecognised value can fall is downward. | Feature file updated |
| 2026-08-16 | `/admin` ships with a working role-assignment panel rather than an empty layout. | F05 names `setUserRole` as the only role path, and two of its acceptance criteria need a reviewer-guarded action and an `/admin` URL to 404 against. A layout with no page would have been dead weight that verified nothing. F22–F25 replace it. | Feature file updated |
| 2026-08-16 | `setUserRoleAction` skips `rateLimit()` and zod. | F09 owns rate limiting and doesn't exist yet; the input is one id and one enum, and `isRole` is already the app's narrowing function. Recorded in the file so it reads as deferred, not forgotten. | n/a |
| 2026-08-15 | Version research done inline against the npm registry, not by parallel sub-agents as F01 §"Version research" describes. | The session's operating rules forbid dispatching agents unless the user asks. The registry is the primary source the research was meant to reach, so the output is the same; only the mechanism differs. What was *not* done is the per-branch API/deprecation sweep — later waves must check current docs for their own package before writing against it. | Feature file updated |
| 2026-08-15 | Rule 1 also lints class strings inside `cva()`/`cn()`/`clsx()`/`twMerge()`, not only `className` attributes. | shadcn keeps its class strings in `cva()`. Restricting the rule to the attribute meant `button.tsx` and `badge.tsx` shipped `pr-`/`pl-` on day one, unflagged — in the components every future page reuses. | Feature file updated |
| 2026-08-15 | Kept the scaffold's generated `AGENTS.md`; our `CLAUDE.md` now ends with `@AGENTS.md`. | `next dev` rewrites `AGENTS.md` on every run — deleting it only produces a recurring uncommitted diff. The scaffold's own `CLAUDE.md` (a one-line `@AGENTS.md`) was deleted so the project's real one survived the move. | `CLAUDE.md` updated |
| 2026-08-15 | The seed's preflight checks are duplicated in the test suite. | Two different jobs. The seed must **refuse to write** a reversed coordinate; the suite must fail `pnpm test` so the mistake is caught without anyone re-seeding. Neither substitutes for the other. | Feature file updated |
| 2026-08-15 | Only permitted zones get `zone_hour` rows. | A restricted or no-fly zone is never "open". Giving it opening hours would state, in data, that there is a time when you may fly there. | Feature file updated |
| 2026-08-15 | `src/lib/geo.ts` → `src/lib/geo/index.ts`. | F04's spec puts `bbox.ts` under `src/lib/geo/`, and a path cannot be both a file and a directory. `@/lib/geo` resolves unchanged. | n/a |
| 2026-08-15 | Driver is **postgres.js**, not `pg`. | One driver reaches both Docker locally and Neon over TCP, so there is no second code path to keep working and no build-time/runtime split. Drizzle's `postgres-js` adapter is first-class. | Feature file updated |
| 2026-08-15 | `casing: "snake_case"` set in **both** `drizzle.config.ts` and `drizzle()`. | camelCase in TypeScript, snake_case in Postgres, without an explicit name on 200-odd columns. It must be set in both places or generated SQL and runtime queries disagree about column names — a failure that only shows up at query time. | n/a |
| 2026-08-15 | `mobileE164` carries an explicit column name `mobile_e164`. | The snake_case converter produced `mobile_e_164`, splitting the name of the E.164 standard in half. | n/a |
| 2026-08-15 | Geometry types live in `src/lib/geo.ts`, not under `src/lib/airspace/`. | The schema needs `Polygon`/`MultiPolygon` too, and `src/lib/airspace/` is under the purity rule — the map imports from it. A shared leaf module keeps `Position` in one place for both. | Feature file updated |
| 2026-08-15 | Two enums added beyond the spec's list: `notification_category` and `drone_photo_kind`. | The spec gave their values in prose (`booking_reminder | registration_expiry | zone_closure`, `overall | serial_plate | …`) but did not list them as `pgEnum`s. Storing them as free text would have lost the constraint the prose describes. | Feature file updated |
| 2026-08-15 | ESLint `no-unused-vars` now ignores a leading underscore. | `src/lib/data/*.ts` takes the session first **without exception**, including for genuinely public reads. Uniformity is the point — an exception is a thing to remember, and ownership checks get missed exactly where someone decided the rule didn't apply. | n/a |
| 2026-08-15 | `i18n/request.ts` reads the locale from `next/root-params`, not `requestLocale`. | next-intl marks `requestLocale` deprecated and points at `next/root-params`, which Next introduced in 16.3.0 — the version installed. Rule 3 of the plan says use the replacement. **Cost:** root-params throws in Server Actions and Route Handlers, so the config honours an explicit `locale` first and Open Thread 4 records what every later wave must do. | Feature file updated |
| 2026-08-15 | `src/middleware.ts` → `src/proxy.ts`, exporting `proxy`. | Next 16 deprecates both the `middleware` filename and the named export. `proxy` is nodejs-runtime only, which suits us — F05 will want database access in the optimistic redirect, and the edge runtime would have blocked it. | Feature file, plan §5 and `CLAUDE.md` updated |
| 2026-08-15 | The locale switcher reads the query string from `window.location.search` on click, not `useSearchParams()`. | `useSearchParams` triggers a CSR bailout: it broke `pnpm build` outright, and the fix Next suggests is a Suspense boundary on **every page** that renders the switcher — which is every page. The query is only needed at click time, and by then `window.location` is authoritative. | Feature file updated |
| 2026-08-15 | `i18n:check` also compares ICU placeholders per key, beyond the key-set diff the spec asked for. | `{count}` in Arabic and `{total}` in English passes a key-set diff and throws at render, in the locale nobody on the team reads. Same script, one extra pass. | Feature file updated |
| 2026-08-15 | `src/lib/format.test.ts` is exempt from the no-bare-`Intl` rule alongside `format.ts`. | The offset test's whole job is to check the wrapper against raw `Intl`. A test that used the wrapper to verify the wrapper would assert nothing. | n/a |
| 2026-08-15 | `vitest.config.ts` → `vitest.config.mts`. | Vite's incoming native config loader warns on ESM syntax in a file it treats as CJS. `.mts` is the fix that doesn't require `"type": "module"`, which would disturb the Next config files. | n/a |

---

## Verification status

What has actually been **run**, not what was written. F31 reads this.

| Check | Last run | Result |
|---|---|---|
| `pnpm exec tsc --noEmit` | 2026-08-17 (F17) | ✅ clean — **requires `next typegen` first** on a clean tree; use `pnpm typecheck`. Also runs F11's `@ts-expect-error` masking assertion |
| `pnpm lint` | 2026-08-17 (F17) | ✅ clean. Both rules probed rather than assumed: the **airspace purity** bans all fire on `evaluate.ts` (F12), and **rule 11** fires on a `.set({ status: … })` written into `src/lib/data/` while the four workflow files stay clean (F14) |
| `pnpm build` | 2026-08-17 (F17) | ✅ `/api/zones/geojson` builds as a dynamic route; `/[locale]/rid/[code]` and `/api/rid/[code]` build as dynamic routes, `/robots.txt` static; `/api/upload`, `/api/files/[...path]` and `/api/inngest` too; migrates first; `/[locale]/dev/emails` still prerenders as a **404** in a production build; F17's `/[locale]/profile/complete` and `/[locale]/settings/profile` build **dynamic** |
| `pnpm i18n:check` | 2026-08-17 (F17) | ✅ **632 keys**, ar/en in sync (556 at F15) |
| `pnpm db:up` + `db:migrate` | 2026-08-17 (F11) | ✅ `0004_broken_the_initiative` applied — `remote_id_scan`, `drone_report`, `remote_id_viewer_level`. **SQL read in full**: one enum, two tables, four FKs, five indexes, no drops. **24 tables.** |
| Remote ID codec, issuance, declarations | 2026-08-17 (F10) | ✅ against the live database — 100 000-code alphabet and duplicate checks, forced collision, five-collision throw, renewal keeping the code, suspension/reactivation, the module-claim transfer. See the session entry |
| Scan page + JSON twin at four viewer levels | 2026-08-17 (F11) | ✅ over HTTP — anonymous **12 keys**, owner 28, reviewer 29; the full national ID appears in no payload at any level |
| Airspace engine, against the live database | 2026-08-17 (F12) | ✅ bbox pre-filter over the real Riyadh polygons, carve-out beating the restricted base, a no-fly point, an over-ceiling refusal and the daily cap. The **KKIA annulus containment assertion** (thread 9) and the **declaration-window broadcast check** (thread 34) are unit-tested against the seeded geometry and rows |
| Booking concurrency, against the live database | 2026-08-17 (F13) | ✅ `scripts/probe-booking.mts`, **18/18**, run twice: capacity 1 with two simultaneous claims → one row; capacity 3 with five → seats 0,1,2; both `duplicate_booking` indexes; a cancelled seat reused; `capacity + 1` forced conflicts → `slot_full`; a failed booking leaving **no** audit event. Every probe row deleted |
| A booking driven over HTTP | — | ❌ **not run.** No page calls the actions yet — F20 owns the map, F21 the booking flow |
| Both lifecycles, against the live database | 2026-08-17 (F14) | ✅ `scripts/probe-workflow.mts`, **34/34**: every drone edge in order with one audit event each, a **self-built airframe with no serial number approved end to end**, renewal keeping the code, revocation suspending the Remote ID, and approval **refused** for a booking whose zone closed after the request. `actorRole` survived promoting the reviewer to admin. Every probe row deleted |
| A decision driven over HTTP | — | ❌ **not run.** 19 server actions now exist and no page calls any of them |
| Approval → QR → email, as one flow | — | ❌ **never run as one.** The action sends the event and F08's job was proven separately; Inngest was not running during F14's probe |
| Identity reveal | 2026-08-17 (F11) | ✅ in Chrome — audit event with reason written **before** the value returned; forcing the audit write to fail refused the reveal and showed nothing |
| `pnpm test` | 2026-08-17 (F17) | ✅ **568 passed, 25 files** (48 new: the Saudi ID checksum, the mobile normaliser, the profile validators, the open-redirect guard, and a **source scan** asserting the mask exists in one file and no page renders a raw document number; **12 mutations run, all 12 caught** — one initially "survived" and turned out to be a mis-aimed mutation, not a gap). Earlier: **520 passed, 20 files** (11 new: the bilingual collapse and the catalogue/source cross-checks). Earlier: **509 passed, 19 files** (30 new: the transition table and the workflow's arithmetic; **seven mutations run, all caught**). Earlier: **479 passed, 17 files** (106 new: geometry, Riyadh time, evaluate, precedence, reason catalogues, slots; **eight mutations run, all caught**). Earlier: **373 passed, 11 files** (32 new: codec and redaction; **six mutations run, all caught**). Earlier: **341 passed, 9 files** (22 new for the upload validator; four mutations run, one initially survived and the claim it tested was corrected). Earlier: **319 passed, 8 files** (31 new for the job rules; four mutations run, one initially survived). Earlier: **288 passed, 7 files** — 24 new for the rate-limit rules and the 429 branch. Four mutations run; **two initially passed**, and the tests were rewritten until they failed. See the session entry. |
| `pnpm db:up` + `db:migrate` | 2026-08-16 (F08) | ✅ `0003_closed_toro` applied — the `job` table and `job_status`. **SQL read in full**: one enum, one table, two indexes, no drops. **22 tables.** |
| Inngest dev server | 2026-08-16 (F08) | ✅ `npx inngest-cli dev` connected to `/api/inngest`; app `ajniha`, **10 functions**, no error. Every cron registered with `TZ=Asia/Riyadh`. |
| Every F08 job, end to end | 2026-08-16 (F08) | ✅ all ten triggered against the live database, including the twice-run idempotency checks, the forced fan-out failure, cancel and re-run. See the session entry's table. Probe rows all deleted. |
| QR PNG payload | 2026-08-16 (F08) | ✅ byte-identical to a fresh encode of `${APP_URL}/ar/rid/{code}`. **Not** a camera scan. |
| A cron firing on its own schedule | — | ❌ **never observed.** Every run so far was triggered by hand. |
| `pnpm db:up` + `db:migrate` (F09) | 2026-08-16 (F09) | ✅ `0002_odd_bullseye` applied — `rate_limit_bucket` (ours) and `rate_limit` (Better Auth's). **SQL read in full first**: two creates, two indexes, no drops. **21 tables.** |
| Email — no key | 2026-08-16 (F06) | ✅ printed in full to the terminal, `email_log` row `skipped`, caller continued. Rows deleted after. |
| Email — forced failure | 2026-08-16 (F06) | ✅ invalid key → `status: 'failed'`, `error: 'API key is invalid'` (Resend's own words), caller continued |
| Email — real delivery | — | ❌ **not run.** Needs a Resend account; `providerMessageId` has never held a real value. |
| Rate limiting — layer 2 | 2026-08-16 (F09) | ✅ against the live database: burst, daily, two-scope isolation, IP independence, no raw IPs, the generous map limit, and the sweep. Every probe row deleted after. |
| Rate limiting — layer 1 | 2026-08-16 (F09) | ✅ 5 sign-up attempts through, **6th and 7th HTTP 429**. Run with a 1-char password so no account was created (`user` still 0), counters deleted afterwards. |
| Rate limiting — direct action POST | — | ❌ **still not run.** F17 proved a *signed-out* direct POST is refused, but tripping a limit through one still needs the owner's session cookie, which is not something to lift out of their browser. |
| Sign-up sends its verification email | 2026-08-16 (F09 session) | ✅ **after a fix.** It did not, until the owner's real sign-up exposed it — see the Session 7 addendum. |
| Owner account | 2026-08-17 | ✅ one user, `admin`, `preferred_locale = ar`. Three probe accounts were created and deleted while chasing the bug above; `user` is back to that one row, `email_log` and `rate_limit` emptied, the 12 seeded zones untouched. **Re-confirmed after F10/F11:** every probe row from that session deleted too — `drone`, `remote_id`, `remote_id_scan`, `drone_report`, `pilot_profile`, `audit_event` and `email_log` all back to 0. |
| F17 profile flow, in Chrome + against the live database | 2026-08-17 (F17) | ✅ wizard end to end in Arabic, the `?next=` return journey, the duplicate-document refusal against a probe account, `verifiedAt` cleared by an identity change, the rejection banner, the owner seeing `•••••4967`, and the audit trail carrying only the mask. Console clean. Every probe row deleted |
| **A server action POSTed directly, no session** | 2026-08-17 (F17) | ✅ **first time in this build.** Both F17 actions answered `{"ok":false, reasons:[{code:"unauthorized"}]}`. Closes half of thread 40 and the whole of F09's "direct action POST" gap for these two |
| 375 px, Arabic, via the iframe | 2026-08-17 (F17) | ✅ `scrollWidth === clientWidth`, no overflowing element, the three date selects on one row. `resize_window` not used — thread 44 |
| `pnpm db:seed` | 2026-08-15 (F04) | ✅ 6 cities, 12 zones, 98 hour rows, 2 closures. Second run inserted 0 of everything and left every `updated_at` byte-identical (md5 compared). |
| Signed-out route protection | 2026-08-16 (F05) | ✅ over HTTP — see entry. Includes the **forged-cookie** probe that proves the proxy is not the boundary. |
| Two-account ownership | 2026-08-16 (F05) | ✅ two probe accounts created, **every F05 criterion exercised**, then both deleted — `user`, `session`, `account`, `audit_event` all back to **0**, seed's 12 zones untouched. Details in the session entry. |
| Production serve (`next start`) | 2026-08-16 (F06) | ✅ on port **3210** — `/ar` 200, auth pages 200, `/ar/dev/emails` and `/en/dev/emails` **404** with no stack trace. (F05's guard checks were the earlier run.) |
| Uploads, end to end | 2026-08-16 (F07) | ✅ over HTTP with three probe accounts: type sniffing, size ceiling, cross-pilot 404, locked target, delete removing row **and** bytes, traversal refused. See the session entry. |
| Vercel Blob driver | — | ❌ **never executed.** No token, no store. |
| Browser console clean | 2026-08-17 (F15) | ⚠️ **partial, but less so.** `/ar/notifications`, `/en/notifications`, `/ar/dashboard` and a 375 px iframe: **22 messages, all React DevTools / HMR / Fast Refresh, zero errors, zero warnings.** `src/components/airspace/decision-reasons.tsx` is still unopened. Earlier (F11): `/ar/rid/{code}` and `/ar/admin` join them: zero errors, zero warnings, through a reveal and a report submission. Earlier (F07): the dropzone page joined F06's three: zero errors, zero warnings. Every other route is still unopened. Earlier (F06): `/ar/dev/emails`, `/ar/forgot-password`, `/ar/verify-email` opened in Chrome: zero errors, zero warnings — only React DevTools' notice and `[HMR] connected`. Every other route is still unopened. |
| **375 px, Arabic RTL** | 2026-08-17 (F15) | ✅ **first time in this build**, closing open thread 20 after five failures. Via a same-origin 375 px iframe, not `resize_window` (which failed a sixth time): no horizontal overflow, header on one row, items wrapping, preference rows intact |
| Notifications, end to end | 2026-08-17 (F15) | ✅ `scripts/probe-notifications.mts` **15/15** — ownership, idempotent mark-read, preferences honoured, **a rejection arriving with every preference off**, and the email link. Plus the same rows rendered in Arabic and then in English in Chrome |
| Rendered Arabic, in a browser | 2026-08-16 (F06) | ✅ first time in this build. All 11 email templates × 2 locales seen. Letter joins correct, right-aligned, `AJN-4F2K-91XZ` reads LTR under its Arabic label, `15 مارس 2029` / `30 يوماً` Gregorian and Latin. |
| App with keys removed | — | — |
| End-to-end walkthrough (Arabic) | — | — |

### Known un-runnable

Named, never assumed. Add as discovered.

- Sending email to any address other than the account owner's — needs a verified domain in DNS.
- **Any real Resend send at all** — needs an account and a key. `status: 'sent'` and `providerMessageId` are the only two `email_log` states never observed. The failure path *was* exercised, with an invalid key.
- Resend delivery webhooks (`delivered` / `bounced` / `complained`) — need a public URL and a signing secret. Not built.
- Vercel Blob uploads — needs a deployed store; the local driver is exercised instead.
- OG preview card as a third party sees it — needs a public domain.
- QR codes encoding a production URL — needs `APP_URL` on a real domain.
- Printed-QR scanning at 20 mm — needs a printer and a phone.
- Inngest production sync — needs a first deploy.

---

## Session entries

Newest at the top.

---

### Session 14 — Wave 6 · F17 Pilot Profile

**Date:** 2026-08-17
**Status:** ⚠️ done with deviations · **Open thread 13 is closed** — `/profile/complete` exists.

**The session that finally posted at a server action.** Four real defects were found by opening the page, three of them invisible to every check this repo runs, and two of them were caused by the *browser* rendering something the app does not control.

**Built:**
- `src/lib/validation/` — `saudi-id.ts`, `mobile.ts`, `profile.ts`. **All three pure**, same split as `airspace/evaluate.ts` and `rate-limit/rules.ts`, so the wizard runs the identical checks the server runs. Tests: `saudi-id.test.ts`, `mobile.test.ts`, `profile.test.ts`, `id-exposure.test.ts`, plus `src/lib/url.test.ts`. Suite now **568 across 25 files**.
- `src/lib/id-hash.ts` — `sha256(ID_HASH_PEPPER + number)`, mirroring `ip-hash.ts` and throwing rather than falling back.
- `src/lib/actions/profile.ts` — `saveIdentityAction`, `saveContactAction`. `profile.save` added to `LIMITS`.
- `src/lib/url.ts` grew `isInternalPath`; `requirePilotProfile(locale, next?)` now builds `?next=`.
- `/[locale]/(app)/profile/complete` and `/[locale]/(app)/settings/profile`.
- `src/components/profile/` — `wizard`, `step-name`, `step-identity`, `step-contact`, `field`, `masked-id`, `verification-status`, `profile-editor`, `date-of-birth-input`. Plus `src/components/ui/select.tsx` (a native `<select>`).
- `format.ts` grew `formatMonthName` and `formatYear`. Catalogue **632 keys** (+76).
- The dashboard links to the profile and shows the incomplete banner.

**`ID_HASH_PEPPER` is generated and in `.env`** — thread 2's F17 half is closed. `.env.example` already held the placeholder. **It can never be rotated.**

**Deviations, each with its reason:**
- **Steps 1 and 2 are saved as one write.** `id_document_number` and `id_document_hash` are NOT NULL, so a row holding a name and no document cannot exist — and loosening those columns so a wizard could save half an identity would weaken a regulator-facing record for the sake of a form. Three panes, two writes. The UI only claims a step is saved where it is.
- **`0501234567` is normalised, not rejected.** F17's criterion lists it as rejected; the criterion is about the *stored* format, which is still `+9665…`. Refusing the way almost every Saudi pilot writes their own number would fail them for being right. `+14155551234` is still refused and is **never** rewritten into a Saudi number. Feature file corrected.
- **The identity number is normalised from Arabic-Indic and Persian digits.** An Arabic-first app whose ID field refuses `٠١٢` would be absurd. Load-bearing, not cosmetic: `id_document_hash` is UNIQUE over the normaliser's output, so two spellings that normalised differently would be two profiles for one person.
- **The document type is checked against the number, not derived from it.** A mistyped first digit would otherwise silently rewrite the claim the pilot made about their own document.
- **`gcc_id` gets a shape check and no checksum.** The app does not know another state's check digit and inventing one would refuse real documents on a guess.
- **The stored document number is never sent to the browser** — the wizard and the edit form both open empty. That is what makes "no screen displays a full national ID" a property rather than a promise, and it is why the wizard has no Back button into pane 2 for a returning pilot.
- **The audit trail stores the number masked**, in `before` and `after` alike. `audit.ts` says never a full national ID, and a trail carrying one would be a second copy with no reveal control in front of it and no delete path behind it.
- **Writes live in the action, reads in `src/lib/data/pilot.ts`.** Same split F11's `revealIdentityAction` already made — the row and its audit event must commit together, and `audit()` takes the executor.
- **Tests are colocated** (`src/lib/validation/saudi-id.test.ts`), not in `__tests__/` as the feature file says. Every other test in the repo is colocated; the log wins.
- **No memorised "real" ID numbers in the tests.** Vectors are built by `saudiIdCheckDigit` and the *properties* are asserted — unique check digit, any single mistyped digit caught, adjacent transpositions caught. A pasted number is either a wrong recollection that pins the bug, or a real person's identity in the repo for ever. One case is worked longhand so the algorithm is pinned by something other than itself.
- **`id-exposure.test.ts` scans the source**, the way F15's `render.test.ts` does: `•••••` must appear in exactly one file, and `idDocumentNumber` may appear under `src/app` only as `""` or as a `MaskedId` argument. F17 asked for a grep; a grep somebody ran once is a claim about that day.
- **The rejection loop is split** — F17 renders the pilot's side (banner, reviewer's reason, and correcting the identity clears `rejectedAt` and re-queues), F22 writes it. Decided up front with the user rather than discovered half-built.

**Four defects found by opening the page. None was caught by `typecheck`, `lint`, `build` or 568 tests:**
1. **The native date input rendered `٠٤/٠٥/٢٠١٢`** — Arabic-Indic digits in the one field that becomes part of an identity record, and a reversed `ةنس/رهش/موي` placeholder. **Chrome renders `type="date"` from the browser's own locale and ignores `lang` on the element and on `<html>` alike** — proven by setting both and watching nothing change. Replaced with `DateOfBirthInput`, three native selects whose numerals go through `formatYear`/`formatNumber` and whose months go through `formatMonthName`. **This is a browser surface `format.ts` cannot reach; F18 and F21 must not reintroduce `type="date"`.**
2. **The date component forgot its own selections.** It derived its three parts from the composed `YYYY-MM-DD`, and a partial date is the empty string — so choosing a day cleared it, choosing a month cleared it again, and the year could never complete a date. The selects looked filled and the form insisted the field was empty. Now held in local state.
3. **Native `required` cancelled the submit** and showed the browser's own popup in the browser's language, so the app's bilingual refusals never ran. Every field now carries `aria-required`.
4. **A dead `_RETIRED_NATIVE_DATE_INPUT` constant** left by a clumsy edit — caught by lint, unlike the other three.

**Verified — over HTTP, in Chrome, against the live database:**

| Criterion | Result |
|---|---|
| Wrong checksum | OK — `id_checksum`, distinct from a format problem |
| A `1` number declared as an Iqama | OK — `id_type_mismatch` |
| Nine and eleven digits | OK — `id_format` (unit) |
| An Arabic-Indic ID and mobile | OK — `٠٥٠١٢٣٤٥٦٧` stored as `+966501234567` |
| Under 18 | OK — refused, and 18 today is accepted (unit) |
| Latin name in the Arabic field, and the reverse | OK — both flagged at once |
| `+14155551234` | OK — refused, not rewritten |
| **The duplicate document** | OK — a probe account held it; the owner got *"هذه الوثيقة مسجّلة مسبقاً"* and **nothing about who holds it**. Row unchanged, audit count unchanged — the transaction rolled back |
| The mask, for the **owner** | OK — `•••••4967`, with the hint saying "including to you" |
| The mask in the **audit trail** | OK — `•••••0008` in `before` and `after` |
| `completedAt` | OK — set only when the contact half landed; trail reads created → contact_updated → completed |
| Changing the ID number | OK — warned first, gated behind an acknowledgement, `verifiedAt` **and** `verifiedByUserId` cleared, `verification_cleared` written with reason `identity_document_changed` |
| Changing it while **rejected** | OK — `rejectedAt` and `rejectionReason` cleared, back in the queue |
| The rejection banner | OK — badge, date, the reviewer's own words, and the way back in |
| `?next=` | OK — dashboard → wizard → **back to `/settings/profile`** |
| Already complete at `/profile/complete` | OK — redirected rather than re-asking |
| A returning half-finished pilot | OK — lands on pane 3, not pane 1 |
| **Both actions POSTed directly, no cookie** | OK — `{"ok":false,…"unauthorized"}` from both. **The first server action in this build ever driven over raw HTTP** |
| Arabic RTL and English LTR | OK — Arabic name RTL and English name LTR inside both pages |
| Dates | OK — `12 أبريل 1995`, `17 أغسطس 2026`: Gregorian, Latin numerals, Arabic month names |
| **375 px, Arabic** | OK — via the iframe (thread 44), `scrollWidth === clientWidth`, no overflowing element, the three date selects on one row. Screenshotted |
| **Console** | OK — 3 messages, all React DevTools / `[HMR]`. Zero errors, zero warnings |

- **12 mutations run, 12 caught** — including a checksum that doubles the wrong positions, a dropped tens-carry, the Arabic-Indic fold removed, the Riyadh cutoff read from the server's timezone, an exclusive age check, completeness dropping a field, `validateIdentity` returning only the first problem, the open-redirect guard losing its `//` check, a page rendering the raw number, and a second masker. One mutation initially "survived" and was **wrong**: it patched a branch the input never reaches. Re-aimed, it was caught.
- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (632), `pnpm test` (568), `pnpm build` — all green; both routes build dynamic.
- **Every probe row deleted.** `pilot_profile`, `audit_event` and `rate_limit_bucket` back to **0**; the probe account gone; the owner account and the 12 seeded zones untouched. **No migration was needed** — F03 already created the table.

**Not verified:**
- **`/drones/new` does not exist** (F18), so that exact criterion could not be run. The mechanism was proven against `/settings/profile`, which is a real shipped caller of `requirePilotProfile(locale, next)` — F18 gets the second.
- **"Pilot B cannot read pilot A's profile (404)" was not staged as a request.** There is no route that names another pilot's profile and no action that takes a user id — both act on the session's own row — so the isolation is structural rather than a check that ran. **F22 builds the surface where a reviewer reads somebody else's profile, and that is where this needs a real test.**
- **The reveal control is not built.** F11's `revealIdentityAction` keys on a **Remote ID code**, not a profile id, so a reviewer opening a pilot profile has nothing to call — see the new thread 45. F17 has no reviewer surface at all, by the scoping decision.
- **`verifiedAt` and `rejectedAt` were seeded by hand.** No reviewer wrote either; F22 owns that.
- **The owner's profile was deleted after testing**, so the app has no pilot profile at all right now. It was filled with a *fabricated* identity number and leaving that on their real account would be a lie in the one record this feature exists to keep honest.
- **No screen reader**, and **English at 375 px** was not checked — only Arabic, the harder direction.

**Next session should know:**
- **Never use `<input type="date">`.** Chrome renders it from the browser's locale and ignores every language hint the page can give. `DateOfBirthInput` is the pattern; `formatMonthName` and `formatYear` are in `format.ts` for it.
- **Never use the native `required` on a form field.** It cancels the submit and speaks the browser's language, not the reader's.
- **F18 calls `requirePilotProfile(locale, "/drones/new")`** and gets the return journey for free.
- **`maskIdDocument` is still the only masker**, and `id-exposure.test.ts` now fails if a second one appears or if a page renders the raw column.
- **The wizard and the settings page share `StepName`/`StepIdentity`/`StepContact`.** A field added to one appears in both, which is the point.

---

### Session 13 — Wave 5 · F15 Notifications

**Date:** 2026-08-17
**Status:** ⚠️ done with deviations · **Wave 5 is complete.** Ran in the same context as Sessions 11–12, no `/clear` between.

**The first rendered UI in four sessions**, and it paid for itself immediately: opening the page found a duplicated header that no check in this repo would ever have caught, and the 375 px viewport finally rendered after five failed attempts.

**Built:**
- `src/lib/notifications/render.ts` — **pure**: `NOTIFICATION_TYPES`, `collapseParams`, `isNotificationType`. Plus `render.test.ts` (11). Suite now **520 across 20 files**.
- `src/lib/data/notification.ts` — the read surfaces, `markNotificationRead`, `markAllNotificationsRead`, `setMyPreference`, `linkNotificationEmail`. **Strictly per-user, with no `isReviewer` escape hatch anywhere** — unlike every other file in that folder.
- `src/lib/actions/notification.ts` — mark one, mark all, set a preference. `notification.read` added to `LIMITS`.
- `/[locale]/(app)/notifications` and four components: `notification-bell` (server), `notification-list`, `notification-item`, `notification-preferences`.
- **A shell header in `(app)/layout.tsx`** — the bell needed somewhere to live, and an unread count that appears on one page is not a notification system.
- `qr-render` now links the notification to the email that carried it.
- Ten catalogue keys (**556**).
- `scripts/probe-notifications.mts` — seeds a realistic spread **for the owner's own account** so the list can be opened signed in, and `clean` removes it.

**Deviations, each with its reason:**
- **The type keys are camelCase under `notifications.*`** (`droneApproved`), not the dotted `notification.drone.approved` F15's file describes. The catalogue and every writer have used this shape since F08; the log wins and the feature file is corrected.
- **`collapseParams` is where the `zoneAr`/`zoneEn` pair becomes `{zone}`.** F08 left this seam open on purpose: `notify()` demands both variants so rendering needs no join, while `i18n:check` forbids a catalogue that carries both. The renderer is the first point that knows which language the reader chose, so it is the only place the collapse can happen. A pair collapses **only when both halves are present**, so a param merely ending in `En` is left alone.
- **`localeHref` was written, tested, and then deleted.** `Link` from `@/i18n/navigation` already prefixes the reader's locale, so the helper was dead the moment the component was written. Replaced with a source-scanning test asserting **no writer stores a locale-prefixed `href`**, which is the thing that actually matters.
- **`render.test.ts` reads the source** to assert every `type:` literal handed to `notify()` is a known type. A catalogue check cannot see a writer that invents a type; that failure renders the raw key `notifications.whatever` to the one person it was written for. The first version of the scan matched `type: "png"` and `type: "Polygon"` — it now requires a `userId:` in the neighbourhood.
- **`src/lib/data/notification.ts` is exempt from ESLint rule 11**, for the `jobs-table.ts` reason and not the workflow one: **read/unread is not a domain status.** No transitions, no actor, nothing to notify, nothing a regulator would audit. Writing "a pilot opened their bell menu" into the approval trail would bury the trail the rule exists to keep readable. The exemption is that file alone — the probe had to use raw SQL to reset rows, which is the rule working correctly.
- **Preferences live on the notifications page, not on a settings page.** F28 owns account settings and does not exist; a Settings section holding one panel would be a claim about a page the app does not have. F28 can move it.
- **`markNotificationRead` is idempotent and returns `true` for an already-read row.** Re-reading must not move `readAt` — that column is the record of when they actually saw it — but "already read" is a success to the caller, and only "not yours or not there" is a refusal.
- **The bell is a server component, counted on navigation.** No polling, no websockets: nothing this app sends needs to arrive within seconds, and a socket would be complexity with no user benefit.
- **The unread count goes through `formatNumber`.** A bare number handed to ICU renders `٣` under `ar` (open thread 22) — a bell in Arabic-Indic digits beside a Latin-numeral date is the exact inconsistency `format.ts` exists to prevent.
- **`emailLogId` is wired on the approval path only.** `linkNotificationEmail` matches on `(userId, entityId)` — both sides are set by the code that wrote them, so it is a join and not a guess — and `qr-render` calls it after the send. The other senders (expiry sweep, reminders, closure fan-out) do not link yet; recorded as thread 43 rather than claimed.

**One real defect, found by opening the page:**
- **The locale switcher and the sign-out button rendered twice** on `/dashboard` — once in the new shell header, once in the dashboard's own. `typecheck`, `lint`, `build` and 520 tests were all green with it on screen. Removed from the page, which is where they stopped belonging the moment the shell grew a header. **This is open thread 11's whole point**, and it is the second time the thread has caught something the moment somebody looked.

**Verified — against the live database and in Chrome.** `scripts/probe-notifications.mts`, **15/15**, plus four page loads:

| Criterion | Result |
|---|---|
| Five notifications written, all unread | OK |
| No stored rendered sentence | OK — every param is a value, not prose |
| Every stored `href` is locale-less | OK — `/drones/probe`, never `/ar/drones/probe` |
| The same row in both languages, **no join** | OK — `وادي نمار` / `Wadi Namar` from the one stored pair |
| The catalogue never sees `zoneAr`/`zoneEn` | OK — collapsed to `zone` before `t()` |
| Another account marking it read | OK — refused, row untouched, and their own list is empty |
| Marking one read | OK — unread 5 → 4, `readAt` stamped |
| Marking it again | OK — `readAt` unmoved |
| Switching off booking reminders | OK — **the in-app row is not written**, and the email half is off |
| A **rejection** with every preference off | OK — **still arrives.** It carries no category, so there is nothing to suppress |
| A category with no stored row | OK — defaults to on |
| `notification.emailLogId` | OK — linked to the right `email_log` row |
| Mark-all | OK — count reaches zero |
| **Arabic RTL, in Chrome** | OK — heading and items right-aligned, unread dots on the start edge, `17 أغسطس 2026` Gregorian with Latin numerals, `خلال 30 يوماً` Latin, the Latin drone name reading correctly inside the Arabic sentence |
| **The English switch** | OK — the identical rows, written while the locale was `ar`, read in English including the zone names |
| Mark-read in the browser | OK — dot cleared and badge 6 → 5 **in place**, no reload |
| The preferences panel | OK — stored state reflected, and the notice *"قرارات التسجيل والحجز تصلك دائماً ولا يمكن إيقافها"* in plain words |
| **Console** | OK — 22 messages across four page loads, **all** React DevTools / `[HMR]` / `[Fast Refresh]`. Zero errors, zero warnings |

**Open thread 20 is closed — 375 px finally rendered.** `resize_window` failed for the **sixth** time (reports success, viewport stays 1440). What worked: a **same-origin iframe 375 px wide**, whose media queries evaluate at its own width. `innerWidth: 375`, `dir: rtl`, `lang: ar`, `scrollWidth === clientWidth` — **no horizontal overflow**, header on one row, list items wrapping correctly, and the three preference rows holding their layout. Screenshotted. **Every future wave should use the iframe, not `resize_window`.**

- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (556), `pnpm test` (520), `pnpm build` — all green; `/[locale]/notifications` builds dynamic.
- **Every probe row deleted.** `notification`, `notification_preference`, `email_log` and `audit_event` all back to **0**; the owner account and the 12 seeded zones untouched.

**Not verified:**
- **No email was actually sent**, so `linkNotificationEmail` was exercised against a hand-written `email_log` row rather than a real send. The join is proven; the send is still thread 41.
- **The three types F14 added have no writer that has run in anger** — `droneRevoked`, `droneReinstated` and `bookingRejected` were rendered from seeded rows, not from a real decision.
- **Mark-read was driven from the browser, not posted at directly.** Same standing gap as every other action (thread 40).
- **English at 375 px** was not checked — only Arabic, which is the harder direction and the one that matters here.
- **No screen reader.** The bell's accessible name and the preference checkboxes were written for one and never heard by one.

**Next session should know (Wave 6 begins):**
- **F17 is the unblocker.** `requirePilotProfile` still redirects to `/profile/complete`, which does not exist (thread 13), and nothing else in Wave 6 works for a real pilot until it does.
- **The shell header exists now** in `(app)/layout.tsx` and holds the bell, the locale switcher and sign-out. Wave 6 pages should not grow their own — that is what produced this session's one defect.
- **Use the iframe technique for 375 px.** It is the only thing that has ever worked, and F31's gate needs it.
- **`DecisionReasons` (F12) has still never been rendered.** F20 and F21 are its first callers.

---

### Session 12 — Wave 5 · F14 Workflow State Machines & Audit Trail

**Date:** 2026-08-17
**Status:** ⚠️ done with deviations · **Wave 5 is now F15 alone.** Ran in the same context as Session 11, no `/clear` between.

**The app now does something end to end.** A self-built drone with no serial number can be submitted, reviewed, approved, issued a Remote ID and a QR, expired, renewed with the same code, revoked and reinstated — and every one of those is a row, an audit event and a notification that commit together or not at all.

**Built:**
- `src/lib/workflow/transitions.ts` — **the table is complete**: 9 drone edges and 8 booking edges, the four system ones unchanged. Plus `actorKindsFor`, `actorMayDrive` and `reasonIsSufficient`, all pure.
- `src/lib/workflow/apply.ts` — **the role branch F08 left as `null`**. `lockRow` now returns the owner alongside the status, so `owner` is resolved from the locked row rather than from anything the caller says about itself.
- `src/lib/workflow/drone.ts` — submit / resubmit / renew / approve / reject / revoke / reinstate, with the guards a table cannot express.
- `src/lib/workflow/booking.ts` — approve (which **re-runs `evaluateAirspace`**) / auto-approve / reject / cancel-by-pilot / cancel-by-authority / check-in.
- `src/lib/workflow/rules.ts` — **pure**: `registrationExpiryFrom`, `pilotMayCancel`. Plus `rules.test.ts` (9) and `transitions.test.ts` (21). Suite now **509 across 19 files**.
- `src/lib/actions/drone.ts` (7 actions) and six more in `src/lib/actions/booking.ts`, closing Open Thread 39.
- `src/lib/airspace/query.ts` grew `buildContextForBooking(tx, bookingId)` — the approval re-check, read **through the approving transaction**.
- `countRecentNoShows` / `autoApproveEligible` in `src/lib/data/pilot.ts`; `review.decide` in `LIMITS`; three notification keys (catalogue **546**).
- `scripts/probe-workflow.mts` — the throwaway that drove all of it against the live database. Kept and re-runnable.

**Deviations, each with its reason:**
- **An actor holds several kinds at once**, and an edge needs only one of them to match. F14's spec implies a single "who"; a reviewer cancelling **their own** booking is both `reviewer` and `owner`, and collapsing to a single highest kind would lock staff out of using the app as pilots — which is the population this product is for. An admin implicitly holds `reviewer` too, so no edge has to list both.
- **`reasonMinLength` is declared on the edge, not checked at the call site.** A rejection reason that slipped through unvalidated is a blank line in the regulator's trail, and there are five edges that need one.
- **The reason check runs *before* the edge-legality check**, so a reviewer who typed "no" is told to write a reason rather than told the transition is invalid. Two very different things to be told, and only one of them true.
- **An admin may approve their own drone.** Staff-as-pilot means the kinds overlap; blocking self-approval would deadlock this build outright, where the only admin is also the only account. Recorded as a decision, not an oversight — **F22 should add the four-eyes rule** if it wants one.
- **`autoApproveBooking` is a real transition inside the creation transaction**, not an `approved` value handed to the insert. An automatic approval is still a decision and belongs in the trail with an actor and a timestamp.
- **The auto-approve test is two conditions**: the zone's `autoApprove` **and** the pilot's no-show record. F14's table lists them on one row; they are read from different places, so the action composes them.
- **`checkInBooking` is not a transition and does not pretend to be one.** It writes `checkedInAt` and an audit event, and changes no status — which is what leaves `booking-closeout` (F08) something to decide hours later.
- **No notification on `booking.cancelled_by_pilot`.** The pilot cancelled it and is looking at the result.
- **`registrationExpiryFrom` and `pilotMayCancel` live in a pure `rules.ts`**, not in `drone.ts`/`booking.ts`. Found the same way F09 found it: the first version sat behind `server-only` and no unit test could import the arithmetic that decides when a registration lapses. Same split as `rate-limit/rules.ts` and `airspace/evaluate.ts`.
- **`actorKindsFor` moved from `apply.ts` to `transitions.ts`** for exactly that reason — it decides who may do what, which makes it the half that most needs testing without a database.
- **Actions open their own transaction** (`db.transaction(...)`) to compose several workflow writes. Consistent with F11's `revealIdentityAction`, which already did this; the *queries* still go through `src/lib/data/*`.
- **`buildContextForBooking` takes an executor, not a session.** A reviewer approving somebody else's booking has no session that owns those rows, and fabricating one would be an unauthenticated door in the module rule 8 protects — the same call F08 made for `src/lib/inngest/queries.ts`. It also has to read *inside* the approving transaction, or the re-check races the write it guards.
- **The approval re-check feeds in no availability and no busy slots.** The booking already holds its seat; handing its own row back to the engine would have it refuse itself with `slot_full` and `duplicate_booking`. Capacity was decided by the unique index at claim time and no later decision can take it away.
- **No zod, still.** Recorded as deferred rather than forgotten for the third session running: the inputs here are ids and two bounded strings, and `reasonMinLength` is enforced in the table where every edge can see it.

**Verified — against the live database.** `scripts/probe-workflow.mts`, **34/34**, with a probe pilot, reviewer and admin, the seeded `RUH-P-03` (auto-approve) and `RUH-P-07` (not), and a real published closure:

| Criterion | Result |
|---|---|
| Submitting with no profile / no photograph | OK — `profile_incomplete`, `photo_required` |
| A **commercial** airframe with no serial | OK — `serial_required` |
| A **self-built** airframe with no serial | OK — **submits**. This is the product, and it is now tested end to end |
| A pilot approving their own drone | OK — `invalid_transition` |
| Rejecting with a 2-character reason | OK — `reason_required` |
| Every refusal above | OK — status still `pending`, **1** audit event total, nothing written |
| A 20+ character rejection, then resubmission | OK — `rejectionCount` 0→1, row's reason cleared, **the old reason still in the trail** |
| Approving | OK — Remote ID `AJN-PZJA-JTS3` issued, `registrationIssuedAt` set, expiry **exactly three years on** |
| Expire → renew → re-approve | OK — **the same code**, back to `active` |
| A reviewer revoking | OK — refused. An admin revoking | OK — Remote ID `suspended`, code unchanged |
| Reinstating | OK — `active`, same code, suspension reason cleared |
| The whole trail | OK — **9 audit events, one per transition, in order**: submitted → rejected → resubmitted → approved → expired → renewal_submitted → approved → revoked → reinstated |
| The system edge | OK — `actorIsSystem: true`, `actorUserId: null` |
| `actorRole` at the time | OK — and **promoting the reviewer to admin afterwards did not rewrite their old event**, which still says `reviewer` |
| No secrets in the trail | OK — no document number, no token, in any `before`/`after`/`reason` |
| A booking in an auto-approve zone | OK — lands `approved`, trail reads `booking.requested → booking.auto_approved` |
| A booking in a normal zone | OK — lands `pending` |
| **Approving a booking whose zone closed after the request** | OK — **refused** with `zone_closed_window`. Withdraw the closure and the same approval succeeds |
| `decisionSnapshot` at approval | OK — stored, with `geometryVersion` |
| Check-in | OK — `checkedInAt` set, status still `approved`; somebody else checking in is refused |
| A pilot cancelling inside two hours | OK — `cancel_too_late`; an **authority** cancelling the same booking succeeds; the pilot cancelling two days out succeeds |
| A refused decision | OK — no status change, **no audit event, no notification** |
| Three no-shows in 90 days | OK — auto-approve off; at **91 days it is back on** with nothing reset |
| `audit.ts` update/delete path | OK — the module has neither |

- **Rule 11 was probed, not assumed**: a `.set({ status: … })` in `src/lib/data/` errors, and the four workflow files lint clean.
- **Seven mutations run, all seven caught**: an admin no longer inheriting `reviewer`; a null actor id matching a null owner; the reason not being trimmed; a reviewer allowed to revoke; the registration counted in 365-day years; the cancel window becoming exclusive; and the system being handed the `owner` kind.
- **The three-year check in the probe is self-referential** — it compares the stored column against the same function that wrote it. `rules.test.ts` is what actually pins the meaning, against written-out dates: 2026-08-17 → 2029-08-17, and the naive `3 × 365 × 86_400_000` lands on 2029-08-**16**, one leap day short.
- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (546), `pnpm test` (509), `pnpm build` — all green.
- **Every probe row deleted afterwards.** `audit_event` and `notification` are back to **0**; the owner account and the 12 seeded zones are untouched.

**Not verified:**
- **No page calls any of this.** Thirteen new server actions, none driven over HTTP — F18 owns the registration UI and F22 the review queues. Same standing gap as F07's, F09's, F11's and F13's actions, and it is now the largest one in the build.
- **No email was sent by any of it.** `approveDroneAction` sends `drone/approved` and the F08 job renders the QR and mails the pilot, but Inngest was not running during this probe and no key exists — so "a reviewer approves and the pilot gets an email with a QR" is proven in two halves that have never been run as one.
- **`droneApprovedEvent` and `droneRevokedEvent` are sent from the actions, and the actions were never called.** The event payloads are typed, and the jobs were exercised by F08 against hand-triggered events; the seam between them is structural.
- **Nothing rendered.** No Arabic, no browser, no console check. Open threads 11 and 20 stand untouched.
- **Concurrency on a decision.** Two reviewers approving the same drone simultaneously was not staged; the argument is `select … for update` plus `already_applied`, the same one F08 made.

**Next session should know (F15, and Wave 6):**
- **F15 owns the notification read surfaces.** Every writer already exists and every row stores `type` + `params` — including `zoneAr`/`zoneEn` pairs, which the renderer must collapse to the catalogue's single `{zone}`.
- **Three notification types have no read surface yet**: `droneRevoked`, `droneReinstated`, `bookingRejected` were added this session.
- **F18 calls `submitDroneAction`**, and must call `deleteDroneFiles` before deleting a drone (F07's note still stands).
- **F22 calls the six decision actions** and should decide whether it wants a four-eyes rule — an admin can currently approve their own registration, which is deliberate and documented.
- **`booking.auto_approved` fires inside `createBookingWithSeat`.** If F21 wants a "your booking is confirmed" screen, `createBookingAction` already returns `approved: boolean`.

---

### Session 11 — Wave 5 · F12 Airspace Authorization Engine · F13 Slot Derivation & Booking Concurrency

**Date:** 2026-08-17
**Status:** ⚠️ done with deviations · **Wave 5 is now F14–F15.** Built as a pair, as instructed — and the pairing paid for itself twice: `evaluate.ts` calls `findAlternativeSlots` for `zone_closed_now`, and `createBookingAction` calls `evaluateAirspace` for everything except capacity. Built apart, those two seams would have been two different notions of "is this bookable".

**Built:**
- `src/lib/airspace/` — `types.ts`, `geometry.ts`, `time.ts`, `evaluate.ts` (**all four pure**), `query.ts` (server-only), `index.ts`. Tests: `geometry.test.ts` (15), `time.test.ts` (15), `evaluate.test.ts` (40), `precedence.test.ts` (12), `reasons.test.ts` (5).
- `src/lib/booking/` — `slots.ts` (**pure**: `deriveSlots`, `slotStates`, `findAlternativeSlots`, `isOnGrid`, `isClosed`) and `create.ts` (the transactional seat claim). `slots.test.ts` (19).
- `src/lib/actions/airspace.ts` (`checkAirspaceAction`) and `src/lib/actions/booking.ts` (`listSlotsAction`, `createBookingAction`).
- `src/app/api/zones/geojson/route.ts` — bbox-filtered, publicly cached, returns **the exact `ZoneRule[]` the engine consumes**.
- `src/components/airspace/decision-reasons.tsx` — the one place a refusal becomes a sentence, plus `formatReasonParams`.
- Data layer: `listZonesContainingPoint`, `listHoursForZones`, `listClosuresForZones` (zone); `listSlotUsage`, `listMyBookedSlotStarts` (booking).
- **Two catalogue keys**, `airspace.reasons.identity_unverified` and its fix (catalogue **543**).
- `scripts/probe-booking.mts` — the throwaway that drove F13's concurrency against the live database. Kept and **re-runnable**; it deletes its own rows on the way in and on the way out.

**Suite: 479 across 17 files** (was 373 across 11).

**Deviations, each with its reason:**
- **`identity_unverified` is a 27th reason code**, beyond F12's list. `requirePilotProfile` already promised it in a comment ("that refusal is F12's `identity_unverified`"). Folding it into `pilot_profile_incomplete` would tell somebody who filled in every field correctly that their profile is incomplete, and send them back to a form with nothing left to do.
- **Every instant in the engine is an ISO string, never a `Date`.** The map fetches its context as JSON and the server builds it from rows; a `Date` survives one of those and not the other. Conversion happens at the edges only.
- **`AirspaceQuery` gained `zoneId`** — evaluate against a named zone rather than by containment. The booking form picks a zone, a date and a slot; it does not pick a coordinate, and `booking` has no lat/lng column to put one in. `point` still wins when both are given. **The cost is real and is Open Thread 37.**
- **`time.ts` does Riyadh as arithmetic**, not through `Intl`, so it is byte-identical in a browser and on a server — which is what makes `booking_seat_uniq` mean anything. `time.test.ts` cross-checks it against `format.ts` (the real IANA zone) on **every day of a year**, so the fixed-offset assumption fails loudly rather than silently.
- **Real sunrise/sunset, by the standard solar equation**, rather than a fixed night window. Riyadh sunset runs 17:07 in December to 18:44 in June; a fixed window would be wrong by over an hour twice a year, and a zone that forbids night flight has to mean the actual sky. Verified against published times to ±10 minutes.
- **`deriveSlots(zone, hours, ymd)` — closures are not a parameter.** They decide a slot's *state*, not whether it exists. A closed slot still has to render, greyed, or the picker silently loses hours and nobody can tell why. F13's spec signature had them on derivation.
- **Slot-state precedence is `past > closed > blocked > full`.** `blocked` above `full` on purpose: telling a pilot a slot is full when the obstacle is their own existing booking sends them hunting for another zone instead of looking at their own diary.
- **`createBookingWithSeat` takes an injectable `pickSeat`.** Same precedent and same reason as F10's injectable `generate`: the `capacity + 1` exit is unreachable by staging a race, and a retry ceiling nobody has executed is a ceiling that does not work. Every caller in the app uses the default.
- **No notification on booking creation.** The pilot is looking at the answer on screen; a row telling somebody what they have just done is the noise F08 already refused for closeout. F14's decision is the news. **This weakens F13's "a failed booking leaves no notification" to a half-check** — see Not verified.
- **`cancelBooking` and `checkInBooking` were not built.** Both are status changes; rule 11 puts every one behind `applyTransition`, and `transitions.ts` holds only the four *system* edges while `apply.ts` maps only the `"system"` actor. Adding the human edges and the role branch is **F14's central deliverable**, and half-building it here is exactly the drift that would leave the app with two state machines. Cancelling still frees a seat the instant the status changes — that is the partial index, not the missing action, and the probe proves it with raw SQL.
- **Tests are colocated (`evaluate.test.ts`), not in `__tests__/`.** All eleven existing suites are colocated; `vitest.config.mts` includes `src/**/*.test.ts` either way.
- **`query.ts` contains no SQL.** The ESLint rule exempts it from the db ban, but every read still goes through `src/lib/data/*`, session first — so rule 8's "ownership is answerable by reading one folder" survives. The exemption is now unused, which is the right kind of unused.
- **`reasons.test.ts` asserts the catalogues against the code, in both directions.** `i18n:check` compares `ar` to `en`; it cannot know which codes the engine actually emits. A reason with no message renders as a raw `airspace.reasons.slot_full` to somebody who has just been refused.

**Two corrections to F12's acceptance criteria — the spec was wrong, not the code:**
- **"A point in central Riyadh outside every permitted zone → `outside_permitted_zone`" is wrong for the seeded airspace.** `RUH-R-CITY` is a default-deny base covering greater Riyadh (F04's own design note says so), so a city point in no carve-out is `inside_restricted_zone` — a more specific and more useful answer. `outside_permitted_zone` is what you get *beyond* the base. Both are now tested, and the feature file is corrected.
- **"Swapping a coordinate pair to `[lat, lng]` is a type error" is not achievable** with `Position = readonly [lng: number, lat: number]`. Tuple element labels do not affect assignability, so `[24.7113, 46.6753]` is a perfectly good `Position` to the compiler. Branding it would mean casting every frozen literal in the F04 seed. The working defences are `assertWithinSaudiArabia` (F04's reversal detector) and a test asserting a reversed Riyadh pair lands in no zone — both now present. Feature file corrected to say what is actually enforced.

**Verified — against the live database.** `scripts/probe-booking.mts`, six probe pilots with a profile and one airframe each, real seeded zones `RUH-P-03` and `RUH-P-07`, run **twice** (it is idempotent):

| Criterion | Result |
|---|---|
| `booking_seat_uniq` exists, partial | OK — `(zone_id, slot_start, seat_index) WHERE status = ANY (ARRAY['pending','approved'])`, read from `pg_indexes` |
| Capacity 1 · **two simultaneous** claims | OK — exactly **one** booking row, one winner |
| The loser | OK — `slot_full` as a **value**, no exception thrown |
| The loser's alternatives | OK — **3** slots, all `available`, none of them the slot that just filled |
| Cancelling frees the seat | OK — status flipped, seat **0** reused by the next booking |
| Capacity 3 · **five simultaneous** claims | OK — **3** rows, seats `[0,1,2]`, no gaps, no duplicates; the other two `slot_full` |
| Same pilot, same instant, another zone | OK — `duplicate_booking`, **not** retried (`booking_pilot_slot_uniq`) |
| Same drone, same instant, another pilot | OK — `duplicate_booking` (`booking_drone_slot_uniq`) |
| A **failed** booking's trail | OK — `audit_event` 17→17, `notification` 0→0 |
| `capacity + 1` consecutive conflicts | OK — **4 attempts**, then `slot_full`. Forced with an injected seat picker that always returns a held seat |
| `buildDayContext` against live rows | OK — 14 windows and 0 closures hydrated from `zone_hour` / `zone_closure` |
| The day grid reflects a real seat | OK — 8 slots, the booked one reads `taken=1` |
| A clean booking into seeded `RUH-P-03` | OK — `allowed`, `geometryVersion > 0`, no reasons |
| 500 m over an 80 m ceiling | OK — `above_ceiling` |
| The bbox pre-filter over real polygons | OK — 2 candidates for King Salman Park, and the **carve-out wins**: `RUH-P-04` |
| A point over the Ministry of Defence | OK — `inside_no_fly_zone`, `RUH-NF-MOD` |
| A pilot at `maxSlotsPerPilotPerDay` | OK — `max_slots_per_day` |

- **The ESLint purity rule was probed, not assumed.** All four bans (`@/lib/db`, `server-only`, `next-intl`, `react`) fire on `evaluate.ts` and the file is clean again after reverting.
- **Eight mutations run, all eight caught**: the half-open ray cast made inclusive (breaks the shared-edge test), interior rings ignored (breaks the KKIA annulus), the slot grid emitting a partial tail, a superseded declaration still counting as broadcast-capable, the Riyadh offset applied the wrong way (9 failures), `full` outranking `blocked`, the registration checked at booking time instead of at flight end, and `no_fly` no longer terminal (4 failures).
- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (**543**), `pnpm test` (**479**), `pnpm build` — all green. `/api/zones/geojson` builds as a dynamic route.
- **Every probe row deleted afterwards**, and the database is back to baseline: `user` 1 (the owner), `zone` 12, `zone_closure` 2, and `drone` / `remote_id` / `booking` / `audit_event` / `notification` / `pilot_profile` / `email_log` all **0**.

**Two open threads closed:**
- **Thread 9 — the KKIA annulus.** `geometry.test.ts` now asserts against the real seeded polygon that the excluded core is **not** contained, and `precedence.test.ts` asserts that a point in the core falls through to the restricted base rather than to `inside_no_fly_zone`. F04 deferred this rather than write a second `pointInPolygon`; there is now exactly one, and this is it.
- **Thread 34 — `broadcastCapable` is a write-time snapshot.** The engine never reads the boolean. `AircraftContext` carries the **declaration rows**, and `broadcastCapableAt(declarations, slotStart)` evaluates each one's own window against the instant of the flight. Tested both ways: a module valid today and expiring tonight is capable now and **not** capable for tomorrow's slot.

**Not verified:**
- **No page calls any of this.** F20 owns the map and F21 the booking flow, so `checkAirspaceAction`, `listSlotsAction` and `createBookingAction` have been driven only from tests and the probe — never over HTTP, and never with a real session cookie. Same standing gap as F07's and F11's actions.
- **`decision-reasons.tsx` has never been rendered in a browser.** It is the component both F20 and F21 will use, and its Arabic has not been seen. Open Thread 11's territory.
- **F13's UI criteria** — the date strip and slot picker in Arabic RTL, the losing booking greying the slot in place — belong to a picker that does not exist yet. They are F21's to satisfy, not claimed here.
- **"A failed booking leaves no notification" is only half a check**, because the success path writes none either. The audit half *is* meaningful and passed.
- **A point the map shows green being accepted by `createBooking`** is structural, not observed: both call `evaluateAirspace` and there is no second implementation, but no map exists to show anything yet.
- **375 px, a sixth time.** Nothing was rendered this session, so the thread stands untouched rather than retried.

**Next session should know (F14, F15):**
- **F14 owns the human edges.** Add them to `src/lib/workflow/transitions.ts` and add the role branch in `apply.ts` where `actorKind` is currently `actor.isSystem ? "system" : null`. `booking.cancelled` and `booking.checked_in` are among them, and `src/lib/actions/booking.ts` has a comment marking where the two missing actions go.
- **`createBookingAction` writes `booking.requested` to the audit trail and creates a `pending` row.** F14's approval is what turns `autoApprove` into an actual decision — the engine returns `needs_review` but nothing acts on it yet.
- **`decisionSnapshot` is already populated** with the full `AirspaceDecision`, `geometryVersion` included. F14 should not rewrite it at approval; it is the record of what was true when the pilot asked.
- **`evaluateAirspace` is the only implementation of "is this bookable".** F20's map must import it directly and evaluate locally against `/api/zones/geojson`; do not add a second check, and do not have the map call the server on every click.
- **Numbers in reason params are raw numbers.** Render them through `formatReasonParams` (or `DecisionReasons`), never straight into `t()` — ICU formats a bare numeric argument itself and emits Arabic-Indic digits under `ar` (Open Thread 22).

---

### Session 10 — Wave 5 · F10 Remote ID Issuance & Codec · F11 Redaction & Public Resolution

**Date:** 2026-08-17
**Status:** ⚠️ done with deviations · **Wave 5 is now F12–F15.** Built as a pair, as instructed — they share the code format and the `/rid/{code}` surface.

**Built:**
- `src/lib/remote-id/` — `codec.ts` (**pure**), `issue.ts`, `declaration.ts`, `redact.ts` (**pure**), `resolve.ts`, `index.ts`, plus `codec.test.ts` (**14**) and `redact.test.ts` (**18**). Suite now **373 across 11 files**.
- `reactivateRemoteIdForDrone` in `src/lib/workflow/remote-id.ts` — renewal, beside suspension.
- **Two new tables**, closing Open Thread 7: `remote_id_scan` (+ enum `remote_id_viewer_level`) and `drone_report`. Migration `0004_broken_the_initiative` — **SQL read in full first**: one enum, two tables, four FKs, five indexes, no drops. **24 tables.**
- `src/lib/actions/remote-id.ts` — `revealIdentityAction`, `reportDroneAction`. `rid.report` added to `LIMITS`.
- `src/lib/data/remote-id.ts` grew `getRemoteIdRecordByCode`, `listBookingsForRemoteId`, `listScansForRemoteId`, `listDroneReports`.
- `/[locale]/rid/[code]` (noindex), `/api/rid/[code]`, `src/app/robots.ts`, four `src/components/remote-id/*` components, a reports list on `/admin`, and **72 new message keys** (catalogue **541**).
- `scripts/probe-remote-id.mts` — the throwaway that drove all of F10 against the live database. Kept, and re-runnable; it deletes its own rows on the way in.

**Deviations, each with its reason:**
- **`issueRemoteId` takes an injectable `generate`.** A retry loop nobody has executed is a retry loop that does not work, and at ~9 × 10⁻⁸ per insert the only way to run it is to hand it a generator that repeats. Every caller in the app uses the default.
- **Each insert attempt is a savepoint** (`tx.transaction` inside the caller's transaction). A unique violation aborts the whole Postgres transaction, so a bare retry fails with "current transaction is aborted" instead of minting a second code.
- **`networkCapable: true` is set at issue, not as the column default** (which stays `false`). A row created by any other route has not earned the claim.
- **Renewal reactivation lives in `src/lib/workflow/`**, not in `issue.ts` — `remote_id.status` is a status, and rule 11 owns every status write.
- **`remote_id_scan` carries `scannedCode` and a nullable `remoteIdId`**, beyond the five columns F11 named. An unknown or malformed code is still a resolution, and a run of them is the enumeration attempt the table exists to expose. F09's own file says so.
- **A `drone_report` table exists that no feature file specified.** "Files a report visible to reviewers" needs somewhere to put it; F24's *report unregistered drone* files the same shape, which is why `remoteIdId` is nullable. No status column and no triage columns — F22 owns the queue and can add what it needs rather than inheriting an enum nothing writes.
- **The interim reports list sits on `/admin`.** Same call as F05's role panel: a table nobody can read makes the criterion a claim about a database. `listDroneReports` returns `[]` to a non-reviewer, so the scoping is in the data layer.
- **`report-dialog.tsx` is an inline panel, not a modal**, and there is a fourth component (`identity-reveal.tsx`). No dialog primitive is installed; a hand-rolled modal with no focus trap is worse for a screen reader than none, on the one page most likely to be read by a stranger on a phone.
- **`resolveRemoteId` is not a server action** — the page and the route handler both call it directly. That is what makes "the JSON twin has the same field set" a property of the code.
- **`/api/rid/[code]` answers 200 with `{ ok: false, reason }`** for unknown and malformed codes, mirroring the page's "not a 404". 429 is the only status it varies.
- **`getRemoteIdRecordByCode` returns the whole record to any caller, signed out included** — the one deliberate exception to what rule 8 usually means, documented in the file. Scoping it there would put a second masking rule beside `redactRemoteId`. Bookings and the scan log *are* session-scoped in the data layer, because those are questions the redactor cannot answer.
- **No zod.** Still not installed, and the inputs are one code plus two bounded strings. Recorded as deferred rather than forgotten: F12/F14 should introduce it.

**Two real bugs, both found by running it:**
- **Drizzle wraps the driver's error.** `DrizzleQueryError.code` is undefined and the `PostgresError` is its `cause`, so the original 23505 check matched nothing, rethrew every collision, and the retry loop never ran. Found by forcing a collision. `uniqueViolationConstraint` now walks the cause chain, and `declaration.ts` uses the same function.
- **`isIdentified()` had to become a type predicate.** TypeScript will not narrow a union *away* on the negative side of `level === "anonymous" || level === "pilot"` — the public member's own discriminant is a union, so excluding one literal leaves the member in place. Without it the compiler only appeared to enforce the masking table; the `@ts-expect-error` test is what pins it.

**Verified — against the live database and over HTTP.** A probe pilot, a probe drone with **no serial number**, three airframes, two HTTP-signed-up accounts (one promoted to reviewer), and the owner's admin session in Chrome.

| Criterion | Result |
|---|---|
| Alphabet and duplicates across 100 000 generated codes | OK — no `I`/`L`/`O`/`U`, no duplicates, every symbol used |
| `normalizeCode` on spaced/lowercase/undashed/misread input | OK — six spellings, one canonical code; `O→0 I→1 L→1 U→V` |
| A code is not derivable from a row id | OK — `generateCode.length === 0`; asserted structurally |
| Forced collision | OK — regenerated, inserted, **one `remote_id.collision` audit event** |
| Five collisions in a row | OK — **threw**, no row written |
| Approving issues one active row | OK — `networkCapable=true`, `broadcastCapable=false`, `remote_id.issued` logged |
| Expiry → renewal leaves the code unchanged | OK — same string before and after, `created: false` |
| Revocation suspends, code retained | OK — `suspended`, same code; reactivation restores `active` and clears the reason |
| Unverified declaration → `broadcastCapable` false; verified → true | OK, both directions |
| Two airframes claiming one module serial | OK — `module_already_claimed`; after supersession the second **succeeds**, and capability follows the row |
| **Signed out** `/ar/rid/{code}` | OK — code, status, valid-until, build type, weight class, city. **The HTML source contains none** of the owner name, national ID, mobile, nickname or masked ID |
| `/api/rid/{code}` signed out | OK — **12 keys, identical to the anonymous page's field set** |
| Signed in as a **different pilot** | OK — `level=pilot`, same 12 keys, no identity |
| Signed in as the **owner** | OK — 28 keys, full record, national ID `•••••5432`, **the whole number nowhere in the payload** |
| Signed in as a **reviewer** | OK — 29 keys (+ scan log), `canReveal: true`; ID still masked until a reveal |
| Reveal with a reason | OK — identity returned **and** `remote_id.identity_revealed` written with the reason, `actorRole: admin`, hashed IP; exactly one scan row flipped |
| **Forcing the audit write to fail** | OK — mutation applied to `audit()`, reveal refused in Arabic with "the reveal could not be logged", **no identity shown, no event, no flag**. Reverted after. |
| Every resolution writes a scan row and increments `resolveCount` | OK — 0 → 1, `lastResolvedAt` stamped, level recorded |
| `remote_id_scan` holds no raw IP | OK — 27 rows hashed (64 hex), 3 null where no header existed; the address appears nowhere |
| Unknown code | OK — **200 page**, "not registered", reporting still offered; scan row written |
| Malformed code | OK — 200 page, "not a valid code"; logged too. *(Note: `not-a-code` normalises to a valid-looking `N0TAC0DE` — the ambiguity mapping doing its job.)* |
| "Report this drone" | OK — filed from the page, row written with hashed IP, `remote_id.reported` audited, **visible to reviewers on `/admin`** |
| `robots.txt` | OK — `Disallow: /*/rid/` served; the page also carries `noindex, nofollow` |
| Arabic RTL, in Chrome | OK — code reads LTR under its Arabic label, `16 أغسطس 2029` Gregorian and Latin, scan-log viewer levels translated (`زائر` / `طيّار` / `المالك`), report and reveal forms mirror correctly. **Console clean** — React DevTools notice and `[HMR] connected`, nothing else |
| Mutation testing | **Six mutations, all caught**: dropping the ambiguity map, standard base32, dropping the prefix strip, expiring on the sweep instead of the clock, leaking `ownerNameAr` onto the anonymous branch, and masking two digits fewer |

- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (541), `pnpm test` (373), `pnpm build` — all green. Both routes build dynamic; `/robots.txt` static.
- **Every probe row deleted afterwards.** `user` is back to the single owner account, `drone`/`remote_id`/`remote_id_scan`/`drone_report`/`audit_event`/`pilot_profile`/`email_log` all **0**, the 12 seeded zones untouched.

**Not verified:**
- **375 px, a fifth time.** `resize_window` reported success and the rendered viewport stayed 1440 (`read_page` confirms). The scan page is the *most* phone-first surface in the app and it is the one still unchecked at phone width. Open Thread 20.
- **No QR was scanned into this page.** F08 proved the PNG's payload byte-for-byte; a camera has still never resolved one.
- **The reveal and report actions were driven from the browser, not posted at directly.** Same gap as F07's and F09's — a direct action POST needs a session cookie lifted from the owner's browser.
- **`viewerLevelFor` was never exercised with a reviewer who is *also* the owner.** Staff wins by construction (the check order), and no such row existed.
- **Concurrency on issuance.** The `remote_id_droneId_unique` race path returns the winner's code, but two simultaneous issues were never staged; the argument is structural.

**Next session should know (F12–F15):**
- **F14 calls `issueRemoteId(tx, { droneId, actor })` inside the approval transaction**, then sends `droneApprovedEvent` after it commits. Renewal calls `reactivateRemoteIdForDrone`, **never** `issueRemoteId` for a second code.
- **`booking.remoteIdId` is already `NOT NULL`** in the schema — F13 must resolve the drone's Remote ID when creating a booking, and a drone with no `remote_id` row cannot be booked at all. That is the intended coupling.
- **`broadcastCapable` is a snapshot taken at write time.** A declaration whose `validUntil` passes overnight leaves it stale until the next write, and nothing sweeps it. **F12 must check the declaration's own window** rather than trusting the boolean for a future slot.
- **F22 owns declaration verification in the UI**; `verifyDeclaration` / `rejectDeclaration` / `supersedeDeclaration` already exist and already move `broadcastCapable`.
- **F24 reuses `redactRemoteId` and `drone_report`.** Do not write a second projection for the admin lookup — the grep criterion in F11 is the point.
- **F30 inherits `src/app/robots.ts`.** It has the `/*/rid/` disallow and nothing else it will eventually need.

---

### Session 9 — Wave 4 · F07 File Uploads & Document Storage

**Date:** 2026-08-16
**Status:** ⚠️ done with deviations · **Wave 4 is complete.** Ran in the same context as Session 8, no `/clear` between.

**Built:**
- `src/lib/storage/validate.ts` — **pure**: the kind table (accepts + ceiling), magic-byte sniffing, the key builder, and `acceptsUploads`. Plus `validate.test.ts`, **22 tests**; suite now **341 across 9 files**.
- `src/lib/storage/blob.ts` and a completed `index.ts`: `putFile`, `deleteFile`, `readFile`, driver chosen by **dynamic import**.
- `src/lib/data/upload.ts` — ownership, session first. `src/lib/actions/upload.ts` — delete, reorder, and `deleteDroneFiles` for F18.
- `/api/upload` and `/api/files/[...path]`.
- `FileDropzone` and `PhotoGrid`, a new `upload` message namespace and four `errors` keys (catalogue **469**), and `formatBytes` in `format.ts`.

**Deviated from spec:**
- **`readFile` is a third member of the storage interface**, and the blob driver **fetches through the app** rather than redirecting. A redirect hands out the blob's own URL, which then works for anyone the caller passes it to and after the row is gone — the ownership check would hold only for the first request.
- **Blob access is `public`, stated rather than hidden.** Nothing in the app emits a blob URL (`fileUrlFor` returns our route), but one that leaked would resolve. `access: 'private'` is the stronger answer; it is not taken because there is no Blob store here to prove it against, and an unverifiable privacy claim is worse than a stated limitation.
- **Two files the spec did not name**: `src/lib/data/upload.ts`, because rule 8 binds a route handler exactly as it binds an action; and `src/lib/actions/upload.ts`, because delete and reorder are mutations from a client component and only the upload itself needs to be a route.
- **`/api/files` re-sniffs the bytes on the way out** and sets `Content-Type` from what it finds, plus `nosniff` and `private` caching. Whatever got stored, the browser is told what it actually is.
- **Reordering is buttons, not drag-and-drop.** Drag has no keyboard path and no screen-reader story, and *earlier*/*later* are physically opposite in Arabic — naming them by position is the only version that reads right in both.
- **A reviewer may read any file but write none.** Deciding on a registration means seeing the photographs; adding to someone's aircraft is not part of the job.
- **A `declaration_doc` upload deletes the PDF it replaces.** A superseded document nobody deletes stays readable to anyone holding its pathname.
- **The prop is `targetId`, not `entityId`** — it is a drone for a photo and a declaration for a PDF.
- **`formatBytes` added to `format.ts`** rather than a bare number in an ICU message: `{max}` would be formatted by next-intl in the page locale and come out in Arabic-Indic digits (Open Thread 22).

**Verified — over HTTP, against the live database.** Three probe accounts (pilot A, pilot B, a reviewer), a draft drone, a pending drone, a drone belonging to B, and a declaration. Every row and file deleted afterwards.

| Criterion | Result |
|---|---|
| Upload with no token writes into `./uploads` | OK — and the returned URL **renders in the browser**, the coloured squares coming back through `/api/files` |
| `.svg` renamed `.png` | OK — **415** `upload_type_rejected` |
| 20 MB file | OK — **413** `upload_too_large`, `maxBytes: 8388608`, no truncated write |
| Non-PDF as `declaration_doc` | OK — 415; a real PDF gets 200 |
| Pilot B uploading to pilot A's drone | OK — **404**, identical to a drone that does not exist |
| Upload to a `pending` drone | OK — **409** `upload_target_locked` |
| Deleting a photo | OK — row gone, file gone from disk, URL went **200 → 404** in the same run |
| Deleting a drone's files | OK — all four pathnames named and swept; `[]` for a non-owner |
| Declaration PDF: signed out / owner / reviewer / other pilot | OK — **404 / 200 / 200 / 404** |
| Photo: signed out / owner / reviewer / other pilot | OK — **404 / 200 / 200 / 404** |
| Path traversal | OK — four attempts including `%2e%2e` and `..%2f`, all 404 |
| Five photos uploaded and reordered | OK — `sortOrder` 0–4, reversed order persisted, refused for another pilot |
| `uploads/` gitignored | OK — `git check-ignore` names `.gitignore:38` |
| Arabic RTL | OK — **seen in Chrome.** Grid flows right-to-left (first photo rightmost), the disabled "move earlier" sits on the correct card, `8 م.ب` in Latin numerals, the Latin `JPEG أو PNG أو WebP` run reads correctly inside the Arabic sentence, declaration dropzone says PDF only. **Console clean** — React DevTools notice and `[HMR] connected`, nothing else. |
| The same filename uploaded twice | OK — two distinct uuid keys; nothing the uploader typed reaches the storage key |

- **Four mutations run on the validator. One initially survived:** reversing the size/type check order changed nothing, because the 20 MB sample was a valid JPEG and both orders answer identically. The comment claiming the order mattered was **overstated**; it was corrected, and a test now pins the only case the order actually decides — a 20 MB PDF sent as a photograph answers on size. The other three (WebP by `RIFF` alone, `pending` accepting uploads, declarations accepting images) each failed a test immediately.
- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (469), `pnpm test` (341), `pnpm build` — all green; both routes build as dynamic.

**Not verified:**
- **Vercel Blob has never run.** No token, no store, so `blob.ts` is unexecuted code — "the same code path writes to Blob with no source change" is structural, not observed. `put`, `head` and `del` were read from the installed `.d.ts`, not exercised.
- **The delete and reorder *actions* were driven through the data layer, not over HTTP.** The browser was signed in as the owner's admin account, and signing that session out to swap accounts was not worth doing to the user's own browser. The refusal path *was* seen end to end, by accident and worth keeping: as a reviewer the grid renders (reviewers may read) and reordering answers `not_found` (reviewers may not write), which is exactly the design.
- **375 px, again.** `resize_window` reported success and the rendered viewport stayed 1440. Open Thread 20's fourth wave running.
- **Nothing has uploaded from a real phone camera** — no large real JPEG, no EXIF orientation, and no HEIC, which iPhones produce by default and which this rejects.

**Next session should know (Wave 5, F10–F15):**
- **`deleteDroneFiles` in `src/lib/actions/upload.ts` must be called by F18's drone-delete action**, before the row goes. Cascade removes the `drone_photo` rows; the bytes are nobody's job but the caller's.
- **F10 owns declarations.** `remote_id_declaration.docPath` is already written by `/api/upload`, and the `kind` enum is `faa_broadcast_module | gaca_dri | gaca_nri | other` — there is no `standard`.
- **The upload limit is `upload.request`, 20/hour, and refused uploads count too.** A run of rejection tests will exhaust it.
- **`/api/files` is the only way to read a stored file.** Never hand a blob URL to a template or a page.

---

### Session 8 — Wave 4 · F08 Background Jobs (and F07's storage seam)

**Date:** 2026-08-16
**Status:** ⚠️ done with deviations · **Wave 4 is now F06, F08, F09; F07 remains.** Resumed mid-session from an uncommitted tree — the earlier half of this session had built the pure and seam modules and stopped.

**Found already built, uncommitted, when the session resumed:** `src/lib/inngest/rules.ts`, `src/lib/qr/render.ts`, `src/lib/storage/{index,local}.ts`, `src/lib/audit.ts`, `src/lib/notify.ts`, `src/lib/workflow/{apply,transitions,remote-id,index}.ts`, the `job` table + `job_status` enum, and migration `0003_closed_toro` (already applied — 22 tables). No tests, no client, no functions, no route.

**Built this half:**
- `src/lib/inngest/client.ts`, `events.ts`, `jobs-table.ts`, `queries.ts`, `functions/*` (**ten** functions) and `functions/index.ts`.
- `src/app/api/inngest/route.ts` — `export const { GET, POST, PUT } = serve({ client, functions })`.
- `src/lib/inngest/rules.test.ts` — **31 tests**; suite now **319 across 8 files**.
- **ESLint rule 11 now exists.** `src/lib/workflow/index.ts` claimed an ESLint rule banned `.set({ status:` elsewhere. **It did not.** Added as `STATUS_WRITE_SELECTOR`, proven to fire on a probe outside `src/lib/workflow/`.
- `notifications.bookingReminder` in both catalogues (450 keys).
- `.env.example` now says why neither Inngest key is needed locally.

**Deviations, each with its reason:**
- **`isDev: process.env.NODE_ENV !== "production"` on the client.** Without it the SDK is in cloud mode, has no signing key, and **500s every request to `/api/inngest`** — including introspection, so the dev CLI just shows no functions. Found by getting the 500.
- **This is Inngest v4, and the v3 API in training data is wrong.** `createFunction(options, handler)` takes **two** arguments with `triggers` inside options (not three); middleware is a **class** extending `Middleware.BaseMiddleware` with `onRunStart` / `onRunComplete` / `onRunError` (not `new InngestMiddleware({ init })`); typed events come from `eventType` + `staticSchema`, and `ClientOptions` has **no `schemas`** field. All read out of `node_modules/inngest/**/*.d.ts` before writing anything.
- **`queries.ts` rather than `src/lib/data/*.ts`** — rule 8's session-first signature has no meaning for a cron, and a fabricated session would be worse than a separate, named module. Reads only; every write still goes through `src/lib/workflow/`.
- **Digest suppression reads `email_log`.** "Did the function run" is the wrong question — an empty-queue run sends nothing and must not suppress the next one. `audit_event` could not answer it: `entityType` has no `system` member.
- **`run-cancelled.ts` beyond the spec's nine functions.** Without it a cancelled run sits at `running` for ever and two enum values are unreachable — an enum member nothing can write is a lie about what the app does.
- **`drone/revoked` reuses `booking.cancelled_by_closure`** rather than minting a second near-identical edge.
- **`booking-closeout` sends no email and no notification.** Neither `completed` nor `no_show` is news to the pilot, and a message an hour later trains people to ignore the ones that matter.
- **Two ESLint exemptions from rule 11**, both named in the config: `jobs-table.ts` and `run-cancelled.ts` write `job.status`, which mirrors Inngest's run state and has no transitions, no actor and nothing to notify.
- **Notification params carry `zoneAr` *and* `zoneEn`.** `notify.ts` requires both variants; the catalogue keys take a single `{zone}`. F15's renderer picks the variant — `i18n:check` compares placeholders across locales, so a catalogue where `ar` says `{zoneAr}` and `en` says `{zoneEn}` fails the check by design.

**Two real bugs, both found by running it:**
- **`sql<Date>\`${column}\`` in a select hands back a *string*.** Drizzle has no column type to map through a raw `sql` expression, postgres.js returns the timestamp as text, and the first thing that formats it throws `Invalid time value`. It threw inside `sendEmail`'s `try` **before** the `email_log` insert, so the failure produced **no row at all** — the sweep reported success and the email simply did not exist. Fixed by selecting the column (`Date | null`) and narrowing at the two call sites. *`sendEmail` writing its log row after `renderEmail` rather than before is a latent F06 weakness this exposed; not changed, but it is why the failure was silent.*
- **`export *` from `schema.ts` does not re-export `user` under plain Node ESM**, because `schema.ts` also imports the name locally. Next's bundler papers over it, so the app is fine — any `tsx` script must import from `@/lib/db/auth-schema`.

**Verified — against the real Inngest dev server and the live database.** `npx inngest-cli dev` running, app `ajniha` **connected, 10 functions, no error**; all six crons registered with `TZ=Asia/Riyadh …` accepted. A throwaway probe (deleted) seeded six drones, nine bookings, Remote IDs and a published closure, all owned by the one existing account:

| Criterion | Result |
|---|---|
| Expired drone moves through the state machine | `drone.expired`, `actorIsSystem: true`, status `expired` |
| Sweep run twice | **one** audit event, **one** notification, **one** email; second run `{found: 0, expired: 0}` |
| 29 days out gets the 30-day reminder, once | marker `{threshold: 30, daysRemaining: 29}`; second run `reminded: 0` |
| 00:30 Riyadh expiry not swept the previous Riyadh day | unit-tested, and **the test fails** against both a UTC-date and a Riyadh-day-key comparison |
| Closeout | checked-in → `completed`, past grace → `no_show`, **inside grace left `approved`** |
| Closure over 3 bookings | 3 cancelled, 3 notifications, 3 audit events; the 4th booking outside the window untouched |
| One booking of a fan-out forced to fail | other two stayed cancelled, **only the failed step retried**, run completed, no duplicate audit events |
| Digest on an empty queue | `{sent: 0, reason: "queue-empty"}`, zero emails; a second run inside 45 min → `"sent-recently"` |
| Approval renders a QR | `qr/AJN-….png` stored, `qrPathname` set, `drone-approved` email sent |
| The PNG's payload | **byte-identical** to a fresh encode of `${APP_URL}/ar/rid/{code}` — not a camera scan, which stays un-runnable |
| Revocation | Remote ID `suspended`, **code unchanged**, 1 future booking cancelled |
| Every run in the `job` table | 15 rows across all ten functions, with status, duration and output |
| Cancel | `cancelRun` mid-retry → row flips to `cancelled` with a duration, via `run-cancelled` |
| Re-run | `rerun` returned a **new** run id and wrote a **new** row |

- **Four mutations run on `rules.ts`, all caught** — `threshold >` for `>=` (3 failures), dropping the no-show grace (1), opening the reminder window at `now + 23h` (1), and the two date-comparison variants (1 and 2). The Riyadh-day-key variant initially **survived**; a test was added for "an expiry later today is not expired yet", and it now fails.
- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (450), `pnpm test` (319), `pnpm build` — all green.
- **Every probe row deleted afterwards.** `drone`, `booking`, `remote_id`, `notification`, `email_log`, `job` and `audit_event` are all back to **0**; the 12 seeded zones, 2 seeded closures and the single owner account are untouched. `uploads/` removed. `email_log` had one leftover `verify-email` row from the owner's sign-up, which went with it.

**Not verified:**
- **Nothing ran on its own schedule.** Every run was triggered by hand; no cron has fired at 03:00 Riyadh, and whether Inngest interprets `TZ=Asia/Riyadh` the way we mean is taken on the server accepting it, not on having watched one fire.
- **No email has still ever been sent** — every one of these is an `email_log` row with `status: 'skipped'` and a terminal print.
- **The system page does not exist**, so "every run appears on the system page" is half-verified: the rows are there, the page is F29's.
- **`rerunOfRunId` is never written.** The SDK gets no such data; F29 sets it when *it* initiates the re-run. Until then the column is always null.
- **`cancelling` is never written by anything yet** — same reason. F29 writes it when it sends the cancel.
- **Concurrency.** Two simultaneous runs of the same sweep were never staged. The argument is structural: `applyTransition` takes `select … for update` and the second reads the new status and refuses with `already_applied`.
- **The QR at 20 mm on paper**, and the `/ar/rid/{code}` page the QR points at (F24) — neither exists to scan into.

**Next session should know:**
- **F07 is what remains of Wave 4.** Its seam is already in `src/lib/storage/`: `putFile` and the local driver exist and are exercised by the QR job. F07 owes `blob.ts`, `deleteFile`, `validate.ts`, `/api/upload` (its limit is already `upload.request` in `LIMITS`) and `/api/files/[...path]` — **built on top of that seam, not beside it**. Until the files route exists, `fileUrlFor()` URLs 404: the QR is stored but not servable.
- **F14 sends the events.** `droneApprovedEvent`, `droneRevokedEvent`, `zoneClosurePublishedEvent` in `src/lib/inngest/events.ts` — `inngest.send(droneApprovedEvent.create({ droneId }))`, **after** the decision transaction commits. It also owns every human edge in `transitions.ts` and the role branch in `apply.ts`, which today maps only `"system"`.
- **F29 reads the `job` table** and owns Cancel (write `cancelling`, then call Inngest) and Re-run (send it, then write `rerunOfRunId` on the new run).
- **Do not put `sql<Date>\`…\`` in a select.** See the bug above.
- Still **one user account**, `admin`. Nothing else in the database but the seed.

---

### Session 7 — Wave 4 · F09 Rate Limiting

**Date:** 2026-08-16
**Status:** ⚠️ done with deviations · **Wave 4 is now F06 + F09; F07 and F08 remain.** Ran in the same context as Session 6, no `/clear` between.

**Built:**
- `src/lib/rate-limit/rules.ts` — **pure**: `LIMITS`, `windowBounds`, `retryAfterSeconds`, `rateLimitKey`, `bucketKey`, `rulesFor`.
- `src/lib/rate-limit/index.ts` — `server-only`: the atomic counter, `enforceLimit`, `sweepRateLimitBuckets`. Re-exports `rules`, so `@/lib/rate-limit` is still the one import path.
- `src/lib/ip-hash.ts` — `hashIp` (sha256 + `RATE_LIMIT_PEPPER`) and `clientIpFrom`. **F14 must import this, not grow its own** — two hashers with two peppers stop matching.
- `rate_limit_bucket` in the schema (part of Open Thread 7 closed), migration `0002_odd_bullseye`.
- Layer 1 in `src/lib/auth.ts`: `rateLimit` with `storage: "database"` and the six custom rules. The CLI generated Better Auth's own `rate_limit` table.
- `refuseWith(code, params)` in `src/lib/actions/result.ts` — the first refusal that carries data.
- `setUserRoleAction` now calls `enforceLimit` after the guard, before parsing.
- `formatSeconds` in `format.ts`; `errors.rateLimited` and `auth.errorTooManyAttempts`; the admin panel renders the countdown.
- `authErrorKey(code, status?)` — a 429 branch, wired into all four auth forms.
- `src/lib/rate-limit/rules.test.ts` — 20 tests; suite now **288 across 7 files**.
- `.env` gained `RATE_LIMIT_PEPPER`, generated once (Open Thread 2 half closed — `ID_HASH_PEPPER` is still F17's).

**Deviated from spec:**
- **`rate-limit.ts` became a directory.** Forced by a real failure, not taste: with the arithmetic behind `server-only` the test suite could not import it at all. See Decisions.
- **Rules stop at the first refusal, shortest window first.** The spec does not say how two windows interact. Evaluating both would let a double-click storm burn a pilot's whole daily allowance — the opposite of the feature's stated purpose.
- **The counter fails open on a database error**, loudly.
- **`errors.rateLimited`, not `errors.rate_limited`** — every other key in both catalogues is camelCase.
- **The countdown is built by `formatSeconds`, not an ICU plural.** Opened Threads 22 and 23; the second is a genuine bug in our own `i18n:check`.
- **`authErrorKey` gained a `status` parameter.** Not in the spec, but without it every auth form told a rate-limited user to "try again", which is the one thing that cannot work.
- **A `user.role_set` limit beyond F09's table** — the only server action that exists, so otherwise layer 2 would have shipped with no caller.
- **There is no toast component in this build.** The refusal renders as the inline `role="alert"` notice the admin panel already had. Nothing in Waves 0–9 owns a toast system; F21/F22 should decide.

**Verified:**
- **The SQL was read in full before applying** — two `CREATE TABLE`s, the unique index on `(key, window_start)`, the expiry index, no drops and no alters to existing tables. `\d rate_limit_bucket` confirms the unique index by name.
- **Against the live database**, with a fixed `now` so windows could be crossed without waiting:
  - 4 bookings in a minute → `1:ok 2:ok 3:ok 4:LIMITED retryAfter=23s`.
  - **The daily bucket sat at 3, not 4** — the burst refused by the minute rule did not burn the daily allowance. This is the design decision above, proven rather than asserted.
  - 21 bookings ten minutes apart → the 21st limited with `retryAfter=73500s` (≈20 h), which is the *rest of the day* and therefore unambiguously the daily rule firing, not the per-minute one.
  - 31 Remote ID resolutions from one hashed IP → the 31st limited; a second IP in the same minute → still `ok`.
  - **Zero rows matching an IPv4 shape.** A key reads `rid.resolve:ip:a49251b9425c…#60`.
  - 60 airspace checks in a minute → **0 refused**; the 61st limited.
  - Sweep at 12:00:30 removed the 11:01 bucket and left the 12:01 one.
  - Every probe row deleted; `rate_limit_bucket` back to 0.
- **Layer 1, over HTTP:** five sign-up attempts → `PASSWORD_TOO_SHORT` 400, **sixth and seventh → HTTP 429**. A 1-character password was used deliberately so no account could be created — `user` still holds **0 rows** — and `rate_limit` was emptied afterwards so the owner's real sign-up is not blocked for an hour.
- **Four mutations run. Two of them initially passed, and that is the useful part:**
  - dropping the `Math.max(1, …)` floor → 1 failure. ✅
  - dropping the `#window` suffix from the bucket key → **0 failures.** The subtlest bug in the feature — two rules sharing a bucket at midnight — had no test. Added one; it now fails.
  - dropping the 429 branch → 2 failures. ✅
  - sorting `LIMITS` in place → **0 failures.** The test named "does not hand out the array the table is built from" did not test that: it reordered and re-read, and a second `rulesFor` call sorted it back. Rewritten to assert identity; it now fails.
- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (449 keys), `pnpm test` (288), `pnpm build` — all green.

**Not verified:**
- **The direct server-action POST.** Needs a signed-in admin and the owner has not signed up yet. The limit sits after the guard inside the action, on the only path to the domain call, and F05 proved that path is reachable directly — but this specific criterion has not been run.
- **The refusal has never been seen rendered.** It renders on `/admin`, which needs an admin account. The countdown's Latin numerals are proven by `formatSeconds`'s own tests, not by looking at the page.
- **"No booking row is created"** — `createBooking` is F21's; there is nothing to create.
- **Concurrency.** The single-statement upsert is what makes the counter race-free, and it was never exercised by two simultaneous requests. The argument is structural: there is no read-then-write to interleave.
- **Better Auth's `rate_limit` table is never swept by us.** Whether it grows unbounded is the framework's business and has not been checked.

**Addendum, same session — a real F06 bug, found by the owner signing up.**

The owner created their account. It came out `admin` with `preferred_locale = ar`, as designed — and **`email_log` was empty**. The verification email F06 claimed to send on sign-up had never been sent.

- **Symptom:** sign-up returns 200, account created, nothing logged, nothing printed. `sendResetPassword` and the manual `/send-verification-email` endpoint both worked fine, which is what made it look like the wiring was correct.
- **Cause:** Better Auth `await`s `sendVerificationEmail` **inside the sign-up transaction**. `sendEmail` writes `email_log`, whose `user_id` is a foreign key onto `user`, over a **different pooled connection** — which cannot see a row that is written but not yet committed. The insert failed with a foreign-key violation, `sendEmail` caught it (it is built never to throw), and the email vanished silently.
- **Diagnosis:** Next 16 permits only one dev server per project, so the running one had to be stopped and restarted with its output captured. The failing query was in its stderr. Three throwaway accounts were created and deleted in the process — safe now that the owner holds the admin row, and `user` is back to that one row.
- **Fix:** `deliverAfterResponse`, which wraps the send in Next's `after()`. It runs once the response is finished and therefore after the commit, and it takes the send off the critical path — which is what the fire-and-forget was reaching for anyway. Re-tested: a fresh sign-up now writes a `verify-email` row, in the **recipient's** locale, linked to the user.
- **Nothing in `test`, `lint`, `typecheck` or `build` would ever have caught this.** It needs a real account to be created. That is the same shape as Open Thread 11, and it is now Open Thread 24 — every later callback into Better Auth, and anything F14 does in a `databaseHooks` hook, has the identical hazard.
- The Better Auth CLI was re-run after the edit (it loads `next/server` fine) and produced no schema change.

**Next session should know (F07 uploads, F08 jobs):**
- **`src/lib/auth.ts` is now finished.** F06 and F09 were its two remaining edits; nothing in Waves 5–9 should touch it. That also ends the CLI → `db:generate` → read SQL → `db:migrate` loop.
- **F08 owns two things F09 handed it:** the nightly `rate-limit-sweep` cron, which just calls `sweepRateLimitBuckets()`, and the `jobs` table (Open Thread 7's last third).
- **F07's `/api/upload` limit already exists** as `upload.request` in `LIMITS`. Import it; do not invent a number.
- **Every later action uses the same three lines:** `enforceLimit(action, "user", session.user.id)` after the guard, then `refuseWith("rate_limited", { retryAfterSeconds })`. Anonymous limits use `hashIp(clientIpFrom(headers))` and must decide what to do when it is `null` — `clientIpFrom` deliberately does not guess.
- **Do not put a bare number in an ICU message** (Open Thread 22). Format it through `src/lib/format.ts` and pass a string.
- Still **no user accounts** — `user` is 0 rows and whoever signs up first becomes admin.

---

### Session 6 — Wave 4 · F06 Transactional Email

**Date:** 2026-08-16
**Status:** ⚠️ done with deviations · **F07–F09 not started.** Run alone, not as one of four parallel agents.

**Built:**
- `src/lib/email/send.ts` — the only file that talks to Resend. Log row **before** the network call, updated after. Never throws.
- `src/lib/email/config.ts` (`emailConfigured`, `EMAIL_FROM` — no db, no `server-only`), `i18n.ts` (`createTranslator`), `render.ts` (`renderEmail` → `{subject, html, text}`), `types.ts`, `layout.tsx`.
- **11 templates** in `src/lib/email/templates/`, plus a typed registry in `index.ts`. `sendEmail` takes a template name and the params *that* template needs; a mismatch is a type error.
- `src/lib/url.ts` — `APP_URL`, `absoluteUrl`, `localeUrl`. F19's QR codes want the same module.
- `src/lib/format.ts` gained **`intlLocaleTag`**.
- `src/lib/auth.ts` — `sendResetPassword`, `emailVerification.sendVerificationEmail`, `sendOnSignUp: true`, `autoSignInAfterVerification: true`, `resetPasswordTokenExpiresIn` set explicitly so the sentence in the email cannot drift from the config.
- `src/app/[locale]/dev/emails/page.tsx` — all 11 templates × both locales, each in an iframe, plus the plain-text render.
- `messages/{ar,en}.json` — a new `email` namespace plus two `auth` keys; the catalogue grew from 347 to **447**.
- `src/lib/email/templates.test.ts` — **160 tests**; suite now 265 across 6 files.
- The two auth pages' "nothing will be sent" notice now follows `emailConfigured` instead of the wave.

**Deviated from spec:**
- **`getTranslations` is not used; `createTranslator` is.** Mail is sent from places with no next-intl request context — a Route Handler (Open Thread 4), an Inngest function (F08), the preview page. Copy still lives in the shared catalogues, so `i18n:check` covers it. Feature file updated.
- **The translator is given `ar-SA-u-ca-gregory-nu-latn`, not `ar`.** ICU formats its own numbers inside a plural; a bare `ar` would have put `٣ أيام` in an email. This is rule 6 being violated through a route ESLint cannot see, so `format.ts` now exports the tag and `templates.test.ts` asserts the result. Feature file updated.
- **`sendEmail` is dynamically imported inside the Better Auth callbacks** — it reaches `server-only` and the CLI refuses such a config. Proven to work: the CLI ran and emitted a byte-identical `auth-schema.ts`.
- **The CLI produced no schema change, so there is no F06 migration.** `emailVerification` adds nothing that F05 hadn't already generated. All three steps were still run.
- **Four files the spec did not name** — `config.ts`, `i18n.ts`, `render.ts`, `types.ts` — each with a reason recorded in the feature file. The important one is `render.ts`: the preview page, the test suite and `sendEmail` all render through it, so what `/dev/emails` shows is what gets sent.
- **Emails are rendered to `html` + `text` and those are sent**, rather than handing Resend the React element. One renderer, and the terminal fallback prints the same bytes.
- **`email_log` writes are in `send.ts`, not `src/lib/data/`.** It is a service with no session. The **read** side is not exempt — F29 must go through `src/lib/data/`, session first.
- **The preview page carries no message keys.** Dev-tool chrome in the shipped catalogues would be a lie about what the app has.
- **`requireEmailVerification` stays `false`**, and that is now a decision rather than a deferral: with no key the verification link only reaches the terminal.
- **No `email:dev` script, no `@react-email/ui`.** The skill's preview server would have been a second renderer with different conventions; `/dev/emails` is the one the feature file asks for.

**Verified:**
- **No key:** `sendEmail` printed both messages to the terminal in full — Arabic RTL text, real clickable link — wrote `email_log` rows with `status: 'skipped'`, and the caller reached the line after them. Rows deleted; `email_log` is back to **0**.
- **Recipient locale, not sender's:** the same event sent to an `ar` and an `en` recipient produced two rows differing in `locale` **and** `subject` (`تم اعتماد تسجيل الصقر` / `الصقر is registered`).
- **Forced provider failure:** with a deliberately invalid key, `status: 'failed'`, `error: 'API key is invalid'` — Resend's own message, not ours — and the caller continued. This is the "does not roll back" criterion, exercised as far as it can be before F14 exists.
- **`/dev/emails` over HTTP:** 200 in both locales, **22 iframes**, every `template (locale)` pair present, zero Arabic-Indic digits, zero `هـ`, zero `text-align: left|right` anywhere on the page.
- **Production serve on 3210:** `/ar/dev/emails` and `/en/dev/emails` **404**, body carries no file path or function name; `/ar`, `/ar/sign-in`, `/ar/forgot-password` all 200.
- **160 new tests**, and each claim proven to fail on a deliberate mutation, then reverted: dropping the forced locale tag → **11 failures**; `textAlign: "start"` → `"left"` in the shared shell → **22 failures**; a Saudi mobile number pasted into one template's body → **2 failures**.
- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (447 keys), `pnpm test` (265), `pnpm build` — all green.
- **Seen in a browser — the first time in this build that any rendered Arabic has been.** `/ar/dev/emails` opened in Chrome: letter joins correct and unbroken, every panel right-aligned, `AJN-4F2K-91XZ` reading left-to-right underneath its Arabic label, `15 مارس 2029` and `30 يوماً` in Latin numerals, the urgent band on the cancellation email, and the proposal disclaimer at the foot of all 22 renders. **Console clean** on that page and on the two auth pages — only React DevTools' notice and `[HMR] connected`, no Base UI warning (Open Thread 11's first clean pass).
- **One thing that looks wrong and is not:** in the Arabic cancellation email, the reviewer's verbatim reason ends `… المرجع: AJNIHA-PROPOSAL/NOTAM-0142.` and bidi puts the full stop to the *left* of the Latin reference, so it reads `.PROPOSAL/NOTAM-0142`. That is correct Unicode bidi for a mixed sentence. Do not "fix" it by reordering the string — the reason is quoted **verbatim** and rewriting a reviewer's words to please the layout is the thing that template exists to prevent.

**Not verified:**
- **No email has ever actually been sent.** There is no Resend key on this machine, so `status: 'sent'` and `providerMessageId` have never held a real value, and nobody has seen one of these in a mail client. Rendering is not delivery: Gmail's and Outlook's handling of `dir`, inline styles and the Arabic face is exactly the class of thing that only shows up on arrival.
- **The 375 px viewport.** Attempted and abandoned: the automation tool's window resize did not change the rendered viewport. Now Open Thread 20, in its third wave unchecked.
- **Light/dark mirroring of the preview page.** Only the default theme was seen. The emails themselves are single-theme by design — mail clients do not carry the app's tokens — so this is about the dev page only.
- **The reviewer digest's "no pilot PII" promise is structural, not observed.** Its params are counts and a URL, and the test asserts the sample nickname and Remote ID code never appear — but F08 is what decides what actually gets passed in, and nothing stops a future caller widening the params.
- The new Arabic copy — 11 subjects and ~100 strings — is unreviewed by a native speaker.

**Next session should know (F07 uploads, F08 jobs, F09 rate limiting):**
- **`src/lib/auth.ts` is done being edited by F06.** F09 is the remaining serialised edit, and it means CLI → `db:generate` → **read the SQL** → `db:migrate` again. F09's rate-limit tables are also Open Thread 7's `rate_limit_bucket`.
- **F08 sends the four cron emails.** `sendEmail` is already the durable path: call it from an Inngest function, pass the recipient's `preferredLocale`, and pass `entityId` so the row is traceable. Templates `drone-expiring`, `drone-expired`, `booking-reminder`, `review-queue-digest` exist with their params typed.
- **F14 sends the decision emails** — `drone-approved`, `drone-rejected`, `booking-approved`, `booking-rejected`, `booking-cancelled-by-authority`. Send them **after** the transaction commits, never inside it.
- **`email_log` has no UI.** Open Thread 18: F29 owes it one, through `src/lib/data/`, session first.
- **Testing a module that carries `server-only` needs help.** Vitest externalises the package and it throws. What worked: a throwaway `vitest.probe.config.mts` aliasing `server-only` to an empty module, plus `disableConsoleIntercept: true` to see the output. `node --import tsx --conditions=react-server` does **not** work — it resolves next-intl to the react-client build and dies on `createContext`.
- **Port 3100 is taken by something else on this machine**, as well as 3000 (Open Thread 3). A `next start` there answers, from a foreign app, and will happily give you a convincing wrong answer. 3210 was free. Always check the server actually bound before trusting a status code.
- Still **do not create a probe account** — `user` is empty and whoever signs up first becomes admin. The F06 probes deliberately wrote `email_log` rows with a null `userId` instead.

---

### Session 5 — Wave 3 · F05 Authentication, Roles & Access Control

**Date:** 2026-08-16
**Status:** ⚠️ done with deviations · **Wave 3 code-complete, account-level criteria NOT verified**

**Built:**
- `src/lib/auth.ts` — Better Auth: drizzle adapter (`transaction: true`), email+password, `role` (`input: false`) and `preferredLocale` additional fields, `changeEmail`/`deleteUser`, `nextCookies()` last, and the `databaseHooks.user.create.before` hook that makes the first account admin.
- `src/lib/db/auth-schema.ts` — CLI output, unedited. `schema.ts` re-exports it (the same trap F03 hit with enums).
- **Open Thread 6 closed:** 16 foreign keys onto `user.id` across 11 tables, in migration `0001_cute_sprite`.
- `src/lib/session.ts` rewritten onto Better Auth's inferred type (**Open Thread 8 closed**); `src/lib/auth-guards.ts`, `src/lib/auth-client.ts`, `src/lib/auth-errors.ts`.
- `src/app/api/auth/[...all]/route.ts`; `src/proxy.ts` now composes next-intl with the optimistic cookie check.
- Five auth pages under `(public)/(auth)/` with their own layout, five client forms, sign-out button.
- `(app)/layout.tsx` + `/dashboard` placeholder; `(admin)/layout.tsx` + `/admin` carrying role assignment.
- `src/lib/actions/{result,user}.ts` — the `ActionResult` / `Reason` / `refuse()` shape for every later wave, and `setUserRoleAction`.
- `src/lib/data/user.ts` — `listUsers`, `getUserById`, `countUsers`, `setUserRole` (row + audit event in one transaction).
- `src/components/ui/button-link.tsx`, and ESLint **rule 6**.
- 44 message keys; `roles` and `dashboard` namespaces are new.

**Deviated from spec:**
- **`src/lib/db/index.ts` split into `client.ts` + a `server-only` re-export.** The Better Auth CLI refuses a config that reaches `server-only`, transitively included. `auth.ts` is the sole module allowed to import `@/lib/db/client`; ESLint rule 6 enforces it. Feature file updated.
- **`<Button render={<Link/>}>` replaced by `ButtonLink` everywhere.** `CLAUDE.md` was prescribing a pattern that logs a Base UI console error, and the escape hatch it names (`nativeButton={false}`) sets `role="button"` on an anchor. Two of the eight call sites were F02's, broken since Wave 1. `CLAUDE.md` and the feature file updated. **The user found this, not us** — Open Thread 11.
- **The four Better Auth tables use `timestamp` without a zone**, against the timestamptz convention. Left as generated; drizzle round-trips the instants correctly. Feature file updated.
- **FK delete actions are not uniform, and the choice is deliberate**: `cascade` for what belongs only to the account (`pilot_profile`, `notification`, `notification_preference`), `set null` for every record of an *action* (`*_by_user_id`, `audit_event.actor_user_id`, `email_log`), and **`restrict`** for `drone.owner_user_id` and `booking.pilot_user_id` — a registration record isn't personal data to take away. That makes `deleteUser` fail for any pilot with aircraft; Open Thread 14 hands the consequence to F28.
- **`setUserRoleAction` has no `rateLimit()` (F09) and no zod schema.** Its whole input is an id and an enum, and `isRole` is already the narrowing function the app uses. Noted in the file.
- **`/admin` exists with a role-assignment panel**, beyond a bare layout. F05 specifies `setUserRole` as the only role path, and the acceptance criteria need a reviewer-guarded action and an `/admin` URL to 404 against. F22–F25 replace the page.
- **ESLint's two `no-restricted-imports` blocks had to be merged.** In flat config a later block naming the same rule **replaces** the earlier one — adding rule 6 as its own block silently switched rule 5 off everywhere. Both are now composed from shared constants and re-proven on probes.
- Sign-in/sign-up go through Better Auth's endpoint from client components, not server actions — the framework sets the session cookie itself.
- `.env` gained `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_URL`, all pointing at **port 3001** (Open Thread 3). The browser client sets no `baseURL`, so it uses the page's own origin and the port can't break sign-in.

**Verified:**
- **The generated SQL was read in full before applying** — 4 tables, 16 FKs, no drops. `pnpm db:migrate` clean; `\dt` lists **19 tables**; `pg_constraint` confirms all 18 FKs onto `user` and their delete actions (`audit_event.actor_user_id` = set null, `drone.owner_user_id` = restrict).
- **F03's deferred criterion, now testable and proven:** `create table … owner_user_id uuid not null references "user"(id)` → `ERROR: foreign key constraint … cannot be implemented … incompatible types: uuid and text`. This is why every user column is `text`.
- **The proxy is not the boundary — demonstrated, not asserted.** With a **forged** `better-auth.session_token` cookie the proxy waves the request straight through, and the layout guard is what answers: `/ar/admin` → **404**, `/ar/dashboard` → 307 to `/ar/sign-in`. Signed out with no cookie, both are caught by the proxy (`?next=%2Fadmin`, `?next=%2Fdashboard`, locale prefix stripped).
- All five auth pages 200 in both locales; `/api/auth/ok` 200. `/ar/sign-in` renders `<html lang="ar" dir="rtl">` with the Arabic copy and the proposal notice; `/ar/forgot-password` states plainly that email isn't configured.
- After the `ButtonLink` fix the home page serves real `<a data-slot="button-link">` elements with no `role="button"`, and a sweep of all seven pages leaves **zero** errors and zero `nativeButton` warnings in the dev log.
- ESLint rules 5 and 6 each proven to **fail** on deliberate probes after the config restructure; probes deleted, `eslint` clean.
- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (347 keys), `pnpm test` (60), `pnpm build` — all green.

**Account-level criteria — run on request, with two probe accounts since deleted:**

The user first chose to skip these, then asked for them to be run. Two throwaway accounts were created, every criterion exercised, and both deleted; the database is back to **0 users / 0 sessions / 0 accounts / 0 audit events**, seed data untouched, so the owner's sign-up still becomes admin.

- **First account = `admin`, second = `pilot`** — confirmed in the sign-up response and in the row. `preferredLocale` honoured per account (`ar` / `en`).
- **The `input: false` test.** A pilot POSTing `{"role":"admin"}` to `/api/auth/update-user` → `FIELD_NOT_ALLOWED`, HTTP 400, role unchanged — and it rejects the **whole request**, so a `{name, role}` payload doesn't sneak the name through either. First attempt was refused by CSRF (`MISSING_OR_NULL_ORIGIN`) and had to be re-run with a valid `Origin`; the CSRF refusal was **not** the test passing.
- **Signed-in pilot → `/ar/admin` = 404**, admin → 200, signed out → 307. On the production build the 404 body carries no stack trace, no guard name and no file path. In **dev** it does — see Open Thread 16.
- **The server action, called directly** (real `Next-Action` id lifted from the production bundle, UI bypassed entirely). A **positive control first** — admin promotes a pilot to reviewer, `ok:true`, row changed — because otherwise every refusal below could just mean the action never ran. Then: pilot promoting itself → `not_admin`; pilot demoting the admin → `not_admin`; forged cookie past the proxy → `not_authenticated`; admin changing its own role → `cannot_change_own_role`; bogus role → `invalid_role`; unknown user → `user_not_found`. Roles unchanged throughout.
- **Ownership isolation**, at the data layer — there is no drone page until F18, so this is `getDroneById`, not a URL. Owner sees the row; **another pilot sees `null`**; an admin sees it; a stranger's own list is empty; and an unrecognised role sees `null`, so `roleOf` fails closed in practice and not just on paper. The drone was inserted **with no serial number** — the product's central case, exercised once more.
- **`restrict` FK proven:** deleting the owner while their drone existed was refused by Postgres.
- **The audit trail wrote itself correctly** — two `user.role_changed` rows with the right `before`/`after` and `actor_role`, from the transaction in `setUserRole`.

**Tests added (same session, after the probes):**
- `src/lib/session.test.ts` and `src/lib/auth-errors.test.ts` — **45 tests**, suite now 105 across 5 files. They cover `roleOf` failing closed, the reviewer/admin split, `safeNextPath`'s open-redirect refusals (including the protocol-relative `//host` that starts with a slash and still leaves the site), and `authErrorKey`.
- Two carry intent a future session could otherwise "tidy" away: `USER_NOT_FOUND` **must** map to the same message as a wrong password, or the sign-in form becomes an account-enumeration oracle; and every key `authErrorKey` can return must exist in **both** catalogues — `i18n:check` compares the two against each other and cannot catch a code pointing at a key neither has.
- **Each proven to fail on a deliberate mutation, then reverted:** `roleOf` falling open to `admin` → 9 failures; dropping the `//` check → 2; giving `USER_NOT_FOUND` its own message → 1; mapping a code to a nonexistent key → 2.

**Not verified:**
- **`setUserRole`'s transaction is still untested** — it needs a database, so it is not in the suite. Its audit-write was confirmed by hand during the probes (2 correct `user.role_changed` rows) and that evidence is now deleted.
- **`pnpm db:studio` showing the user row** — no browser was used.
- **Auth pages at 375 px, light and dark, Arabic RTL** — not checked; no browser. Given Open Thread 11, that is exactly where the next defect will be.
- The new Arabic copy is unreviewed by a native speaker.

**Next session should know (Wave 4 — F06–F09, four sub-agents in parallel):**
- **`src/lib/auth.ts` is the one shared file** (plan §5). F06 adds `sendVerificationEmail` / `sendResetPassword`; F09 adds rate limiting. Both edits are **serialised**, and each means re-running the CLI → `db:generate` → **read the SQL** → `db:migrate`.
- The CLI command that works, `server-only` collision and all: `pnpm dlx @better-auth/cli@latest generate --config src/lib/auth.ts --output src/lib/db/auth-schema.ts -y`. Keep the pool in `src/lib/db/client.ts` free of `server-only` or it breaks again.
- **`requireEmailVerification` is `false`** and the two email pages say plainly that nothing will be sent. F06 flips both.
- **Never read `session.user.role`** — it is `string | null`. Use `roleOf` / `isReviewer` / `isAdmin` (Open Thread 15).
- Server actions: `getSession()` returns `null` rather than redirecting; guard, then `refuse("code")` from `@/lib/actions/result`. Redirecting guards need the locale passed in — `next/root-params` throws in actions (Open Thread 4).
- The `user` table is **empty** — the two probe accounts were deleted. Whoever signs up first becomes admin. Still do not create a probe account without asking.
- Dev server takes **port 3001**; `BETTER_AUTH_URL` and `APP_URL` are set to match. **Change `BETTER_AUTH_URL` if you serve on another port** or every auth POST returns `INVALID_ORIGIN` (Open Thread 12).
- **Testing a server action by hand:** its id is in the production client chunks (`grep -r createServerReference .next/static/chunks`), the body is a JSON array as `Content-Type: text/plain;charset=UTF-8`, and it must be POSTed **to a route that references it** — anywhere else returns `{}` without running. Always run a positive control first.
- **Running a script against `src/lib/data/*`:** needs `node --env-file=.env --conditions=react-server --import tsx` (the condition satisfies `server-only`; `--env-file` because ESM imports hoist above `process.loadEnvFile`), a `.mts` extension for top-level await, and an import from `@/lib/db/client` — the tsx loader can't see named exports through `index.ts`'s `export *`. Next itself has no such trouble.

---

### Session 4 — Wave 2 · F04 Riyadh Airspace Seed Data

**Date:** 2026-08-15
**Status:** ⚠️ done with deviations · **Wave 2 complete**

**Built:**
- `src/lib/geo/bbox.ts` — `computeBbox`, `countVertices`, `bboxOverlaps`, `assertWithinSaudiArabia`, `assertRingsClosed`. **The one implementation**; F23's editor must use it rather than growing its own.
- `src/lib/seed/{cities,zones-riyadh,zone-hours,closures,index}.ts`, script `db:seed`.
- 6 cities (Riyadh `isModelled: true`, five others false), 12 zones (1 restricted base + 7 permitted + 4 no-fly), 98 `zone_hour` rows, 2 closures.
- `src/lib/geo/bbox.test.ts` and `src/lib/seed/zones-riyadh.test.ts` — 47 new tests.

**Deviated from spec:**
- **`src/lib/geo.ts` became `src/lib/geo/index.ts`.** F03 had created it as a file; F04's spec wants `src/lib/geo/bbox.ts`, and a path cannot be both. `@/lib/geo` still resolves.
- **The seed builds its own postgres client** instead of importing `@/lib/db`, which is `server-only` and belongs to the request path. A seed is a script.
- **`tsx` needed, and the entry point cannot use top-level `await`** — tsx transpiles to CJS and throws `ERR_REQUIRE_ASYNC_MODULE`. It ends with `main().catch(…)` and `process.exit(1)`, which is better anyway: a failed seed now exits non-zero.
- **The seed loads `.env` itself** via `process.loadEnvFile`, as `drizzle.config.ts` does. Nothing loads it for a script.
- **Only permitted zones get `zone_hour` rows.** A restricted or no-fly zone is never "open", and giving it opening hours would imply it could be. This is why there are 98 rows (7 × 14), not 168.
- **Idempotency is `onConflictDoNothing`, not upsert.** An upsert would bump `updated_at` on every re-run, which the acceptance criteria forbid. `zone_closure` has no natural key, so it is guarded by a read on `(zoneId, startsAt)`.
- **Preflight assertions live in the seed *and* in the test suite.** Not duplication for its own sake: the seed must **refuse to write**, and the suite must fail on `pnpm test` without anyone re-seeding.

**On the honesty constraint:** every zone's `authorityRef` is an explicit `AJNIHA-PROPOSAL/…` string, and the two closures are `AJNIHA-PROPOSAL/NOTAM-…`. Nothing in the seed carries a GACA reference number, real or invented. The geographic anchors are public fact; the permissions are the proposal, and the file says so at the top.

**Verified:**
- `pnpm db:seed` → 6 cities, 12 zones, 98 hour rows, 2 closures.
- **Idempotency proved, not assumed:** md5 of every zone's `code || updated_at` captured before and after a second run — byte-identical, and the second run reported 0 inserts across all four categories.
- In the database: 7 permitted / 1 restricted / 4 no-fly; 2 auto-approving permitted zones; `RUH-NF-KKIA` has **2 rings** and `vertex_count` 34; `RUH-P-07` has exactly **2 Friday windows**; closures split 1 past / 1 future against `now()`; zero rows matching placeholder text patterns.
- Every seeded bbox was derived by `computeBbox`, never typed by hand, and all 12 sit inside 24–26 °N / 46–48 °E.
- `RUH-NF-KKIA` (24.886–25.029 °N) overlaps `RUH-P-01` Thumamah (24.98–25.14 °N) — the fixture F12's `no_fly > permitted` precedence needs. Asserted by name in the test, so it cannot be silently edited away.
- The `[lng, lat]` reversal detector was tested against a deliberately reversed polygon and throws.
- `pnpm test` → **60 passed** across 3 files. `pnpm lint`, `pnpm typecheck`, `pnpm build` green.

**Not verified:**
- **"Rendering the seeded zones on a map shows them correctly positioned, with no self-intersecting polygons."** Not done — there is no map until F20, and no browser was used. The polygons are simple convex-ish rings authored vertex by vertex and every ring is closed and inside Saudi Arabia, but **nothing has checked for self-intersection**, and a bbox test cannot. F20 is the first time anyone sees them.
- **"A point inside the KKIA hole is not contained by the polygon."** Deliberately deferred: that needs `pointInPolygon`, which is F12's, and writing a second ray-cast here is precisely the decay the plan warns about. The annulus's *structure* is asserted now (2 rings, inner strictly inside the outer's box); **F12 must add the containment assertion.**
- The disclaimer strings exist in both catalogues (`zones.disclaimer`, `map.disclaimer`) but nothing renders them yet — F16/F20 must, on every map surface.
- Arabic zone names and notes are unreviewed by a native speaker.

**Next session should know (F05 — auth, roles, access):**
- **F05 is the biggest single risk to what already exists.** It must: run the Better Auth CLI, **re-export `auth-schema` from `schema.ts`** (or the tables silently never reach a migration — see F03's entry), then `db:generate` → read the SQL → `db:migrate`.
- **F05 owns Open Thread 6:** adding foreign keys to every user-referencing column, including `audit_event.actor_user_id ON DELETE SET NULL`. That is also when F03's untested acceptance criterion — a `uuid` user column failing at migrate time — finally becomes testable.
- **F05 replaces `src/lib/session.ts`** (Open Thread 8) with Better Auth's inferred type, and adds the real guards. `isReviewer`/`isAdmin` are used throughout `src/lib/data/*.ts`; keep the names or update all seven files.
- **Do not create a probe account.** The first account created becomes admin; making a test account before the user signs up locks them out of their own system page.
- Editing `src/lib/auth.ts` later means re-running the CLI → `db:generate` → `db:migrate`. F06 and F09 both touch that file.
- The database currently holds seed data only — no users, no drones, no bookings.

---

### Session 3 — Wave 2 · F03 Database Schema

**Date:** 2026-08-15
**Status:** ⚠️ done with deviations · **F04 not started**

**Built:**
- `docker-compose.yml` (`postgres:alpine`, no tag, healthcheck), `drizzle.config.ts`, `POSTGRES_URL` in `.env`.
- Scripts: `db:up`, `db:down`, `db:generate`, `db:migrate`, `db:studio`. **No `db:push`.** `build` is now `pnpm db:migrate && next build`.
- `src/lib/db/enums.ts` — 13 `pgEnum`s. `src/lib/db/schema.ts` — 15 tables. `src/lib/db/index.ts` — postgres.js pool, `server-only`, dev-global so Next's module reloading doesn't leak connections.
- `src/lib/geo.ts` — `Position` (`[lng, lat]`), `Polygon`, `MultiPolygon`, `BoundingBox`.
- `src/lib/session.ts` — provisional `Session`/`Role` (Open Thread 8).
- `src/lib/data/{drone,zone,booking,pilot,remote-id,audit,notification}.ts`. Every exported function takes the session first. `audit.ts` has **no** update or delete function and must never grow one.
- Migration `drizzle/0000_fair_human_torch.sql`, committed.

**Deviated from spec:**
- **The generated SQL contained no `CREATE TYPE` at all.** drizzle-kit reads only the file named in `drizzle.config.ts`, and the enums lived in `enums.ts` without being re-exported. Every table using an enum would have failed on apply. Fixed with `export * from "./enums"` in `schema.ts` — which is also how F05's `auth-schema.ts` must be wired in. **This is the read-the-SQL rule paying for itself on its first use; `db:push` would have surfaced it as a runtime error later.**
- **Docker volume mounts `/var/lib/postgresql`, not `/var/lib/postgresql/data`.** Postgres 18+ restart-loops on the old path. The container was in `Restarting (1)` until this was changed.
- **`mobileE164` → explicit `mobile_e164`.** The snake_case converter had produced `mobile_e_164`.
- **Driver is postgres.js**, chosen over `pg`. See Decisions.
- **`casing: "snake_case"`** in both the drizzle-kit config and the runtime client.
- **Two enums beyond the spec's list**: `notification_category`, `drone_photo_kind` — the spec gave their values in prose but not as enums.
- **No foreign keys on user-referencing columns** (Open Thread 6). Better Auth's `user` table doesn't exist yet, so they are plain `text` with no constraint. F05 must add them, including `audit_event.actor_user_id ON DELETE SET NULL`.
- `jobs`, `remote_id_scan`, `rate_limit_bucket` **not** created — deferred to F08/F11/F09, which own their columns (Open Thread 7).
- `email_log` **was** created here, since F03 lists its columns.
- ESLint `no-unused-vars` now ignores `_`-prefixed args, so the session-first convention holds even where the session is unused.

**Verified:**
- `pnpm db:up` → container `Up (healthy)`.
- `pnpm db:generate` → migration written; **SQL read in full before applying**, which is how the missing enums and `mobile_e_164` were caught. Regenerated from scratch after fixing both.
- `pnpm db:migrate` → applied clean to an empty database. `\dt` lists all 15 tables.
- Round-trip through Drizzle against the live database (temporary probe, since deleted):
  - inserting a `city` with **no `id`** returns a filled-in v4 uuid — the default works;
  - a `self_built` drone with **`serialNumber` omitted** inserts successfully — the product's central case, proven at the database;
  - read-back through `db.query` returns the Arabic nickname intact;
  - `geometry` round-trips as an object with `[46.6, 24.7]` — `[lng, lat]` order preserved;
  - `typeof zone.minLat === "number"`, **not `string`** — the `doublePrecision`-not-`numeric` decision, proven rather than assumed.
- `pg_indexes` confirms all three partial uniques on `booking` carry `WHERE (status = ANY (ARRAY['pending','approved']))`.
- `information_schema` confirms `drone.serial_number` is nullable and `zone.min_lat`/`max_lng` are `double precision`.
- `package.json` has no `db:push`.
- `pnpm db:studio` starts and binds (its local server answers on 4983).
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (13), `pnpm build` — all green, with `build` running migrations first.

**Not verified:**
- **"A deliberate `uuid` user column fails at migrate time."** Not testable yet — there is no `user` table to point a foreign key at, so a `uuid` column would simply be created. This check moves to **F05**, when the FKs are added; it is the moment the type mismatch would actually bite.
- **`db:studio` "lists every table" in the UI.** The CLI serves a local API that a hosted page renders, and no browser was used. The equivalent evidence — all 15 tables present — came from `psql \dt` directly, which is stronger about the database but says nothing about Studio's UI.
- Nothing has been run against Neon. The connection string is the only thing that changes, but that is an assumption until it is done.

**Next session should know (F04 — Riyadh seed data, then F05):**
- **Docker must be running** (`pnpm db:up`) before anything touches the database, including `pnpm build`.
- `pnpm db:seed` **does not exist yet** — F04 adds it.
- The `city` table is empty. F04 seeds Riyadh with `isModelled: true`; it is the only modelled city in this build.
- Zone geometry is `[lng, lat]`. Riyadh is roughly `[46.7, 24.7]` — if a seeded polygon lands in the Indian Ocean, the pair is reversed.
- `zone.minLat/maxLat/minLng/maxLng` and `vertexCount` are **denormalised**: whatever writes geometry must compute them. F04's seed and F23's editor both.
- `zone_hour.weekday` is **0 = Sunday**.
- When adding tables: enums go in `enums.ts` **and** get re-exported from `schema.ts`, or they silently never reach the migration.

---

### Session 2 — Wave 1 · F02 Bilingual i18n & RTL Foundation

**Date:** 2026-08-15
**Status:** ⚠️ done with deviations

> Ran in the **same context** as Session 1, without `/clear` — the user checked `/context` and chose to continue. Nothing about the build depends on that.

**Built:**
- `src/i18n/{routing,request,navigation}.ts` — `ar`/`en`, default `ar`, `localePrefix: "always"`, `localeDetection: false`. `createNavigation` exports `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname`.
- `src/proxy.ts` (**not** `middleware.ts` — see Decisions) with `createMiddleware(routing)`.
- `src/app/[locale]/layout.tsx` is now the root layout; `src/app/layout.tsx` is **gone**. `<html lang dir>`, font variables on `<html>`, `generateStaticParams` over both locales, `setRequestLocale`, `NextIntlClientProvider`.
- Fonts: IBM Plex Sans Arabic (400/500/600/700, `swap`) + Geist + Geist Mono, switching on `html[lang="ar"]` through `--app-font-sans`. No conditional class names anywhere.
- `globals.css`: `--font-sans` now resolves to `--app-font-sans`; `line-height: 1.75` for Arabic; Latin face kept for `code`/`pre`/`.font-mono` inside Arabic; `.rtl-flip`; and a `letter-spacing: normal` net under `[dir="rtl"]` that exempts explicit `dir="ltr"` islands.
- `src/lib/format.ts` — the choke point. `formatDate/Time/DateTime/DateRange/RelativeTime`, `formatNumber/Distance/Altitude/Area`, `riyadhWeekday` (Sunday = 0), `riyadhDayKey`, `RIYADH_OFFSET_MINUTES`.
- `src/lib/locale.ts` (Locale type, `isLocale`, `toLocale`, `direction`, `TIME_ZONE`, labels) and `src/lib/i18n-content.ts` (`pick`, `pickColumns` for the paired `*_ar`/`*_en` columns).
- `messages/{ar,en}.json` — 303 keys across all 22 namespaces, Arabic authored first, including all **26** F12 refusal codes under `airspace.reasons` **and** a matching `airspace.fixes` hint for each.
- `scripts/i18n-check.mts`, wired into `pnpm lint`.
- `src/components/locale-switcher.tsx`.
- ESLint rules 4 (`tracking-*` must be `ltr:`-prefixed) and 5 (no direct `next/link`; no `redirect`/`permanentRedirect`/`useRouter`/`usePathname` from `next/navigation` outside `src/i18n/`).

**Deviated from spec:**
- **`src/middleware.ts` → `src/proxy.ts`.** Next 16 deprecates the filename and the export name. Note `proxy` is nodejs-runtime only — the edge runtime is not available there.
- **`requestLocale` → `next/root-params`.** next-intl deprecates the former. The cost is Open Thread 4: root-params throws in Server Actions and Route Handlers.
- **`useSearchParams` avoided in the switcher** — it broke the build with a CSR-bailout error. See Decisions.
- **Rule 5 bans named imports, not the whole `next/navigation` module.** `useSearchParams`, `useParams` and `notFound` have no locale-aware counterpart; banning them outright would only breed `eslint-disable` comments next to the imports that actually matter.
- **`i18n:check` also diffs ICU placeholders**, beyond the key-set check the spec specified.
- `messages/*.json` carries an `airspace.fixes.*` namespace the spec implied ("plus a `fix` hint for each") but didn't name; it is a sibling of `reasons`, keyed identically.
- Plural forms differ **on purpose**: Arabic `booking.slotsRemaining` uses `=0/one/two/few/other`, English `=0/one/other`. That is correct ICU for the two languages, not drift — `i18n:check` compares placeholder *names*, not categories.
- `--passWithNoTests` **removed** from `pnpm test` (Open Thread 3 from Session 1, now closed — the first real test exists).

**Verified:**
- `pnpm build` → `/ar` and `/en` prerendered as SSG, proxy registered. Served the **production** build on port 3100 and checked over HTTP:
  - `/` → `307` → `/ar`.
  - `/ar` → `<html lang="ar" dir="rtl" …>`; `/en` → `<html lang="en" dir="ltr" …>`.
  - Rendered Arabic dates: `15 مارس 2026`, `14:00`, `15 مارس 2026، 14:00 – 16:00`, weekday `0`. **Zero** Arabic-Indic digits and **zero** `هـ` in the whole page — Gregorian and Latin numerals confirmed in real output, not just in a unit test.
  - Compiled CSS contains `html[lang=ar]{--app-font-sans:var(--font-plex-arabic)…;line-height:1.75}`, `font-family:var(--app-font-sans)`, both `.rtl-flip` rules, and `[dir=rtl] :not([dir=ltr],[dir=ltr] *){letter-spacing:normal}`. `--font-plex-arabic` resolves to the self-hosted `"IBM Plex Sans Arabic"` face and the woff2 files are preloaded.
- `pnpm test` → 13 passed. Covers: `Asia/Riyadh` at +180 in **both** January and July; Arabic date is Gregorian (`2026`, `مارس`, no `هـ`); no Arabic-Indic digits; `formatTime` 24-hour and Riyadh-local; `riyadhWeekday` = 0 on Sunday, 6 on Saturday, and correct across a Riyadh midnight that UTC hasn't reached; `riyadhDayKey` rollover at 21:00 UTC.
- `pnpm i18n:check` → 303 keys in sync. Deleted `nav.map` and `airspace.reasons.above_ceiling` from `en.json` → exit 1 with **both** paths printed; catalogue restored and re-checked.
- `pnpm lint` → clean, and on probes: bare `next/link` → error; `useRouter` from `next/navigation` → error; `useSearchParams` from `next/navigation` → **allowed**, as intended; `tracking-tight` and `md:tracking-wide` → error; `ltr:tracking-tight`, `md:ltr:tracking-wide`, `dark:ltr:tracking-normal` → clean. Probes deleted.
  - The tracking regex needed a fix mid-build: the first version flagged `md:ltr:tracking-wide`, because it only looked for `ltr:` in the *first* variant position.
- `pnpm typecheck` → clean.

**Not verified:**
- **No browser was used.** The 375 px viewport check, light/dark mirroring, and "IBM Plex Sans Arabic in devtools' computed styles" are all unmet. What was done instead is stronger than nothing but not the same thing: the full CSS cascade was read out of the compiled bundle and confirmed to resolve to the right face. Needs a human with a browser, and Arabic glyph shaping needs a human who reads Arabic.
- **The switcher preserving path + query is unverified.** Only `/` exists, so there is no second path to switch between and no page that takes a query string. Re-check during F16/F21.
- The Arabic copy is unreviewed by a native speaker. It is written to be correct and idiomatic, but nobody has read it back.

**Next session should know (F03 — database schema):**
- **Start Docker Desktop before anything else** — `pnpm db:up` needs it, and F03 is the first wave that touches it.
- `build` is still plain `next build`. F03 adds the `pnpm db:migrate &&` prefix and the `db:*` scripts.
- `pnpm lint` now runs `eslint && node scripts/i18n-check.mts`, so a lint failure may be a *translation* failure. Read which half failed.
- Any new user-facing string needs a key in **both** catalogues or `lint` fails. Arabic first.
- When F14/F18/F21/F22 write server actions: **do not call bare `getTranslations()` in an action** — see Open Thread 4.
- For a link that looks like a button: `<Button render={<Link href="…" />}>`, not `asChild`.

---

### Session 1 — Wave 0 · F01 Project Shell

**Date:** 2026-08-15
**Status:** ⚠️ done with deviations

**Built:**
- `git init -b main` in the project directory. `git rev-parse --show-toplevel` now prints `C:/Users/alsha/Desktop/drone-2-demo`. The parent home repo had **no** `.gitignore` at all — one was created containing `drone-2-demo/`.
- Next.js + TypeScript + Tailwind v4 + ESLint, App Router, `src/`, `@/*` alias, pnpm. Scaffolded into `scaffold-tmp` and moved up; no nested project folder.
- shadcn/ui initialised; `button card input label badge` added.
- Vitest installed, `vitest.config.mts` with a `node` environment, `@` alias resolved, `include: src/**/*.test.ts`.
- `eslint.config.mjs` with all three rules — logical properties, no bare locale formatting, airspace purity. Each was **proved to fire** against a deliberate probe file, then the probes were deleted.
- `.env` (gitignored, effectively empty) and `.env.example` (committed) covering every key in plan §8 plus `RATE_LIMIT_PEPPER`.
- `src/app/page.tsx` replaced with a Wave-0 placeholder using shadcn `Card` + `Button`. `src/app/layout.tsx` left as the scaffold wrote it — F02 rewrites it.

**Deviated from spec:**
- **Version research was done inline against the npm registry, not by parallel sub-agents.** See Decisions. The consequence to carry forward: the *per-branch API and deprecation sweep* the spec asked for did **not** happen. Every later wave must check its own package's current docs before writing against it — the Pinned Versions table gives the version, not the API.
- **`--turbopack` dropped** from `create-next-app` (flag no longer exists; Turbopack is default in Next 16), so `dev` is plain `next dev`.
- **`.scaffold-tmp` → `scaffold-tmp`** — npm rejects a package name starting with a period.
- **`typecheck` is `next typegen && tsc --noEmit`**, not bare `tsc`. Next 16 generates the global `LayoutProps`/`PageProps` types into `.next/types`; on a fresh clone bare `tsc` fails with `TS2304: Cannot find name 'LayoutProps'` in `layout.tsx`. This will bite anyone who runs `pnpm exec tsc --noEmit` directly, as several acceptance criteria say to.
- **`test` is `vitest run --passWithNoTests`** — see Open Thread 3; remove the flag when F10 adds the first test.
- **Rule 1 was widened to `cva()`/`cn()`/`clsx()`/`twMerge()` calls**, and shadcn's `button.tsx` / `badge.tsx` were corrected from `pr-`/`pl-` to `pe-`/`ps-`. Attribute-only linting let physical padding into the shared primitives untouched. The mapping is exact: those classes sit behind `has-data-[icon=inline-end]` / `inline-start`, so `pe-`/`ps-` is what was meant.
- `vitest.config.ts` → `.mts`; kept the scaffold's `AGENTS.md`. Both in Decisions.
- `shadcn init` added **`shadcn` itself to `dependencies`**, alongside `@base-ui/react`, `class-variance-authority`, `clsx`, `lucide-react`, `tailwind-merge`, `tw-animate-css`. Left exactly as the CLI wrote it — current shadcn expects to be resolvable from the project. Don't "clean it up" into devDependencies without checking the CLI still works. Note the primitives sit on **`@base-ui/react`**, not Radix.
- `.gitignore` gained `!.env.example` — the scaffold's `.env*` would otherwise have swallowed the committed template. `data/` deliberately **not** added yet; F07 owns it.

**Verified:**
- `pnpm lint` → clean. Then, on deliberate probe files: `className="ml-4 text-left rounded-lg border-l pr-2"` → 1 error; `toLocaleDateString('ar')` and `new Intl.NumberFormat` → 2 errors; the logical rewrite (`ms-4 text-start rounded-lg border-s pe-2 md:me-2`, plus a template literal) → clean, confirming **`rounded-lg` is not a false positive**; `src/lib/airspace/__probe.ts` importing `server-only`, `@/lib/db`, `next-intl` → 3 errors, while `src/lib/airspace/query.ts` importing `@/lib/db` → clean; `new Intl.DateTimeFormat` inside `src/lib/format.ts` → clean; `cva("base ml-2", …)` → 2 errors. All probes deleted; `pnpm lint` clean afterwards.
- `pnpm typecheck` → clean.
- `pnpm build` → compiled, `/` and `/_not-found` prerendered static.
- `pnpm test` → exit 0, "No test files found".
- `pnpm dev` → ready in ~0.9s; **`HTTP 200` on `http://localhost:3001/`** (not 3000 — see Open Thread 4), page HTML contains "Ajniha — project shell" and the shadcn `Button` renders with its full compiled class list.
- `git add -n` confirms `.env.example` is staged and `.env` is not.

**Not verified:**
- The page was checked over HTTP, not in a browser — no visual/RTL confirmation. F02 is the first feature where that matters.
- No dark-mode, mobile, or Arabic-glyph check. Nothing bilingual exists yet.
- Whether TypeScript 7 or ESLint 10 work with this stack — deliberately not attempted; the framework pins `^5` and `^9`.

**Next session should know (F02 — i18n & RTL):**
- Run `pnpm typecheck`, **not** `pnpm exec tsc --noEmit`, or you'll chase a phantom `LayoutProps` error.
- `src/app/layout.tsx` is still the untouched scaffold and `src/app/page.tsx` is a throwaway placeholder — replace both freely.
- `src/lib/format.ts` does **not** exist yet. It is the only file exempt from the Intl ban; the exemption is keyed to that exact path in `eslint.config.mjs`. Creating it elsewhere means fighting the linter.
- `src/lib/airspace/` does not exist yet either. The purity rule already covers it, and exempts exactly `src/lib/airspace/query.ts`.
- Port 3000 belongs to another app on this machine. Confirm which port `next dev` actually took before trusting a URL.
- Nothing is committed yet at the time of writing — the first commit of this session includes the whole shell.

---

## Entry template

Copy this for each new session.

```markdown
### Session N — Wave X · F<NN> <Feature name>

**Date:**
**Status:** ✅ done | ⚠️ done with deviations | 🟨 incomplete

**Built:**
-

**Deviated from spec:**
- (what, why, and whether the feature file was updated — or "none")

**Verified:**
- (commands run + result — not "should work")

**Not verified:**
- (what couldn't be checked, and what it needs)

**Next session should know:**
- (traps, half-finished threads, anything surprising)
```
