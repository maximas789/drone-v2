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
| 6 — Pilot experience | F16–F21 | ⚠️ **Complete, with deviations (Sessions 14–25).** The whole pilot journey runs: register an aircraft → Remote ID → map → book → dashboard. |
| 7 — Admin | F22–F25 | ⚠️ **Complete, with deviations (Sessions 26–34).** F23 ran a/b/c: the geometry layer and the zone list; the Sunday-first hours grid, the live slot preview and the publish/suspend/archive lifecycle; then the closures screen with its cancellation preview and **the first Inngest fan-out ever executed on this machine**, plus `/admin/cities`. F24 added the compliance lookup, the reveal-oversight page, and the audit row that makes every search accountable. F25 ran a/b: **the analytics screen** — six tiles, seven hand-rolled SVG charts, the validated chart palette and a CSV export; then **the audit browser** — keyset pagination, nine filters, a field-level diff, an overlay map for a moved boundary, an audited export, and the append-only grep that holds the whole claim up. **One acceptance criterion in the wave is unverified: the reviewer-404 half of F25b. The second staff account now exists and is a reviewer; what is left is somebody signing in as them against a production serve (thread 64).** |
| 8 — Close-out | F26–F30 | ✅ **Complete, with deviations (Sessions 35–45). F30 finished in Session 45 (a/b/c) — Wave 8 is done.** **F30c**: the preview card. `next/font/google` cannot feed satori — it writes content-hashed **WOFF2** and satori reads WOFF — so `pnpm vendor:fonts` commits four faces with the OFL licence and a staleness test that was **proved to fail** before it was kept. **satori spaces Arabic unevenly and two obvious fixes did nothing** (one produced a byte-identical PNG); words are laid out as flex items with an explicit gap instead, which survives because Arabic does not join across a space. The card drew **"Ajniha Ajniha"** in English — found by looking at the PNG, invisible to every check. The map on it is the **real seeded geometry**, in literal hex because `ZONE_FILL` holds CSS variables (thread 65, third costume). `Organization` names Ajniha and **never GACA — zero occurrences, checked**; `FAQPage` was considered and **rejected** because the headings are topics, not questions. Earlier: **F30a and F30b landed (Session 45).** **F30b**: all 26 public pages carry their own title, description, canonical and three `hreflang` links — canonical string-compared against the URL fetched, `x-default` on Arabic, **0 duplicate titles in either locale** after the fetch found two collisions no test could reach. `noindex` is set **once per route group**, not once per page. **Thirty-nine signed-in pages had all shared one tab title**; each now names a catalogue key validated against both catalogues before any file was edited, and a source scan keeps it that way. **Only F30c — the preview card and the structured data — remains of F30.** Earlier: **F30a (Session 45): the discoverability spine.** One public-page list in `src/lib/site/`, derived from `DOC_SLUGS` and `LEGAL_SLUGS` rather than copied, feeding a 26-entry bilingual sitemap, a `robots.txt` and an `llms.txt` — **all three verified against a production serve, and all 26 sitemap URLs fetched cold at 200**. The AI-crawler tokens the spec attributed to Wave 0 **were never researched there**; they were fetched from each operator's own documentation on 2026-08-23 and recorded with their sources. Two live `robots.txt` bugs found and fixed: `Disallow: /dashboard` and `Disallow: /admin` had **matched nothing since F11** under `localePrefix: "always"`, and a trailing slash would have left `/ar/settings` crawlable. **F30b (per-page titles) and F30c (the preview card) remain.** Earlier — F29 is complete (Sessions 42–44), except Cancel and Re-run — deferred in F29b with the reason recorded.** F29c added the email log, where `skipped` is styled apart from `failed` because every one of the 82 real rows is `skipped` and conflating them would make the panel look like an outage; the distinction was **measured**, not asserted. The activity slice calls F25b's own reader, so "one log, not two" is structural. **Only F30 and F31 remain.** Earlier (Sessions 35–43): F29b (Session 43):** the jobs panel — six scheduled functions with cron, Riyadh timezone, last run and a next-due time computed by a parser that **refuses what it cannot read** rather than guessing, plus 50 of 390 real runs with the error printed whole. **Cancel and Re-run were deliberately not built**: the SDK exposes no cancellation method and `job` stores no trigger payload, so both would have meant inventing an endpoint or firing a wrong event — the log records what each needs. **F29c and F30 remain.** Earlier (Sessions 35–42): F29a (Session 42):** the system page — nine health checks, each answering from something real rather than inferred, and row counts that match `psql` figure for figure. The **first admin-only settings section**, which could not arrive wrong because F28a wrote the filter and its test before there was anything to hide. The `APP_URL` check was verified by deliberately breaking it (`.env` backed up and restored byte-identical) and the re-render repair actually ran — three files rewritten in place, expired and revoked skipped. **No secret-shaped run appears anywhere on the page**, checked against five patterns. **F29b/F29c and F30 remain.** Earlier (Sessions 35–41): F28 is complete (Session 41):** account deletion. The spec's two rows contradict — drones deleted *and* the Remote ID still resolving — so `drone.owner_user_id` became nullable `set null` and a code whose owner has gone answers **`withdrawn`** instead of 404. Most of the deletion is the schema's: of 22 FKs to `user`, six cascade and fourteen set null, `audit_event.actor_user_id` among them. Verified by a **20-assertion probe against the live database** rather than by clicking a button that destroys data. The privacy policy's retention section, true yesterday and false today, was rewritten and pinned by tests. **F29 and F30 remain.** Earlier (Sessions 35–40): F28b (Session 40):** security and notifications. Two bugs a production serve found and every static check missed — `listSessions` throws `SESSION_NOT_FRESH` for a session over 24 h old and blanked the whole page, and a function passed for an ICU `{value}` instead of a `<tag>` crashed the render. A third: the sliding switch changed colour and never moved, in three separate implementations, all caught by `getBoundingClientRect` — it is a native checkbox now, the call `Select` and `Slider` already made. Only **two** notification toggles ship, because `zone_closure` is a category nothing sends. Earlier (Sessions 35–39): F28a (Session 39):** the settings shell and the way into it — `/settings/profile` had existed since F17 with nothing linking to it. Language now writes `preferredLocale`, which nothing wrote after sign-up, so a pilot who switched to English in the header received Arabic mail for ever; verified against `psql` in both directions and restored. The owner can reveal their own ID behind a confirmation, logged before the value returns. **F28b** is security + notifications, **F28c** the danger zone — which needs a migration to let a Remote ID outlive its drone, and rewrites the privacy policy's retention section. Earlier (Sessions 35–38): F27 is complete (Sessions 37–38)** — privacy and terms in both languages, a table of contents a test keeps honest, footer links, and an acceptance line that is a sentence rather than a pre-ticked box. Every clause with a number in it is asserted against the constant that enforces it. Two cookie findings: the app was writing a `NEXT_LOCALE` cookie nothing read (now off — it sets exactly one cookie, `HttpOnly`), and **localhost cookies ignore the port**, so another local app's PostHog and RudderStack cookies show up on this origin and look like trackers this app does not have. Earlier (Sessions 35–37): F27 is half done (Session 37): `src/lib/legal/`, the legal MDX loader, a drift-proof table of contents, and the privacy policy in both languages — assembled from the schema, and it found that the app was setting a `NEXT_LOCALE` cookie nothing ever read (`localeCookie: false` now; the app sets exactly one cookie). **F27b** is terms, the footer links, the sign-up acceptance line, the 375 px pass and the signed-in cookie check. **F26 is complete** — six bilingual pages, five real screenshots, two contextual deep links, and a crawl of every public surface. F27–F30 remain, strictly in order. Earlier (Session 35): F26 split a/b: **F26a is done** — the MDX machinery, `/docs`, and all six pages in Arabic and English, written against the running app and verified signed out in both locales against a production serve. **F26b** is the real screenshots, the two contextual deep links, and the app-side link crawl. |
| 9 — Prove it | F31 | 🟨 **Sessions 46a–46e. F31a done and re-run in full after every fix; thread 64 closed** (reviewer 404s on zones, audit, reveals, cities, zones/new and `/settings/system`, English locale too, no stack traces; 200 on admin, analytics, lookup, pilots, bookings). **F31b: 13 of 14 steps verified** — step 6 proved the four-eyes rule from both sides of one URL, **step 7 is complete** (`AJN-V56M-NAX6` and `AJN-Y74H-2740`, 1096-day windows, QRs byte-identical, emails logged), and step 13's acceptance line is met by `probe-booking.mts` at the layer the race is actually decided. Steps 1–2 cannot be re-run. **F31c round one complete: four critics, 13 broken, 5 missing, 25 worth knowing — all broken and missing fixed.** Ownership came back **clean**. The worst cluster was honesty: four strings told pilots a **GACA reviewer** decides their booking, the OG card and `llms.txt` claimed the proposal was **"put to" GACA**, the public map called booking unavailable, the masked-ID hint promised what the reveal panel contradicted, and both admin zone editors drew Riyadh with no disclaimer. Also fixed: three **alternative-slot buttons that rendered with no label at all**, a booking action that bound a flight to **any aircraft id passed in**, and **`PROBE18B` — never seed data, and the integrity evidence for it searched `probe-%`, case-sensitively matching 0 of 7 rows.** Thread 61 closed: rejections now reach the pilot's inbox through a job. **Round two ran** — blocked on the first attempt by the account's monthly spend limit, retried after the limit reset. Verdict on the seven round-one fixes: **all correct, no broken, no missing, no regressions** against the non-negotiable rules. It found **four defects in the round-one work itself**, worst of them an honesty one: `booking-approved` rendered `ceilingAglM ?? 120`, emailing a pilot *"Maximum altitude: 120 m"* for a zone with no published ceiling — asserting thread 77's unsourced figure as **that flight's** limit — while `booking-reminders` used `?? 0` for the same column, so two emails about one flight disagreed. Both templates take `number | null` now. **All fourteen registered functions have a caller** (11 at the start of F31c): auditing all eleven templates rather than the two reported found a third with none, `booking-approved` — a booking decision reached the pilot as a bell notification and nothing else, in either direction. **The job log is filterable** by status and function, in the URL. **Session 47 closed both remaining judgement calls.** The **375 px header** was measured for the first time — through a same-origin iframe, after `resize_window` failed a fifth time — and it was a **live defect on every signed-in page in both locales**: 411 px of content in a 375 px viewport, with the **sign-out button rendered off-screen at `left: -36`**. The header wraps now; 360 px, no overflow, desktop unchanged. **Thread 77, the 120 m claim, is closed by the user's decision to keep the string** — it rests on their knowledge of the rule, and no document is claimed. **What is left needs a deploy, not a session**: every sticker still encodes localhost, Blob has never run, email is 82 rows of `skipped`, Inngest has never synced. |

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
| @next/mdx | 16.3.2 | registry · installed | F26. Wraps the Next config; needs `@mdx-js/loader` and `@mdx-js/react` beside it. **Under Turbopack, remark/rehype plugins must be named as strings** — a JavaScript function cannot cross into the Rust bundler, so a plugin written in this repo cannot be passed at all. |
| @mdx-js/loader · @mdx-js/react | 3.1.1 | registry · installed | F26. |
| remark-gfm | 4.0.1 | registry · installed | F26, and **not optional**: MDX parses CommonMark, which has no tables. Without it a `\| a \| b \|` block renders as literal pipes with every check green. |
| @types/mdx | 2.0.14 | registry · installed (dev) | F26. Declares the `*.mdx` module shape. Its `default` is typed; a named `meta` export is not, so `isDocMeta` narrows it. |

### AI crawler user-agent tokens — from F30a research

**F30's feature file said these came from Wave 0. They did not** — F01 researched package versions only, and this table had no crawler row until now. Read from each operator's own documentation on **2026-08-23**; `src/lib/site/crawlers.ts` carries the same list with the source URL beside each group.

**A stale token is not an error.** It is a `User-agent:` line naming a bot that does not exist — a rule that matches nothing, silently, for ever. The date above is part of the data; re-check it rather than trusting it.

| Kind | Tokens | Source |
|---|---|---|
| Training / model development | `GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, `meta-externalagent`, `CCBot` | developers.openai.com/api/docs/bots · support.claude.com/en/articles/8896518 · developers.google.com/search/docs/crawling-indexing/google-common-crawlers · support.apple.com/en-us/119829 · developers.facebook.com/docs/sharing/webmasters/web-crawlers · commoncrawl.org/ccbot |
| Search / citation | `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, `Applebot` | as above, plus docs.perplexity.ai/guides/bots |
| User-initiated fetch | `ChatGPT-User`, `Claude-User`, `Perplexity-User`, `meta-externalfetcher` | as above |

**Two of them are not crawlers.** `Google-Extended` and `Applebot-Extended` fetch nothing; each decides what the operator's *real* crawler (Googlebot, Applebot) may do with pages it already holds. Disallowing one withholds a permission, it does not refuse a request — and Apple and Google both state that disallowing them does not remove a page from search.

**One does not fit the split.** Meta documents `meta-externalagent` as serving both "training foundation AI models" *and* "improving products by indexing content directly" — one token, two purposes, no way to separate them in `robots.txt`. Filed under training, which is the stricter reading.

**Deliberately not named**, so nobody adds them later thinking they were missed: `OAI-AdsBot` (Ajniha buys no ads), `GoogleOther` (no stated AI purpose — the `*` group covers it), and `facebookexternalhit`, which is the **link-preview fetcher that renders the card when an Ajniha link is pasted into WhatsApp**. Blocking that one would break F30c's preview on the exact surface this pitch is shared in.

---

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
| 11 | **Nothing in `pnpm lint` / `typecheck` / `build` / `test` catches a rendering defect.** F15 is the second proof: a duplicated locale switcher and sign-out button rendered on `/dashboard` with all five checks green, and was found by opening the page. Earlier: Base UI's `nativeButton` warning had been firing on F02's home page since Wave 1 and every check stayed green; the user found it by opening the page. **F06 opened three pages in Chrome and found them clean**, so the thread is no longer untouched — but it is still a manual pass with no automation behind it, and every other route is unopened. F31's gate needs a real browser pass, and F20/F23 (MapLibre, terra-draw) are the likeliest to hit this again. **F24 is the fourth and worst proof.** Two defects, both invisible to every check: seven duplicate-React-key console errors on the declared-modules list (**the same expression sat in F11's public scan page**), and the **GACA disclaimer clipped on all ten surfaces that render it** — `Badge` is `h-5 overflow-hidden`, so the `whitespace-normal` every call site added wrapped the sentence and then lost its second line. It only failed below ~640 px, so a desktop looked right, and the sentence it truncated is the one the product is obliged to keep saying. `ProposalNotice` now owns it so an eleventh copy cannot get it wrong. | F05 | F31, and every UI wave |
| 12 | **`BETTER_AUTH_URL` must equal the origin the app is actually served from**, or every auth POST is refused with `INVALID_ORIGIN` — sign-in included. Found by serving the production build on a different port. It is the same class of failure as the `APP_URL` QR trap and fails just as silently in a browser. F29's system page should check it. | F05 | Deployment, F29 |
| 16 | **A dev-mode 404 embeds a stack trace naming the guard** (`requireReviewer`, absolute file path) in its RSC payload; the production build does not. So the "404, not a stack trace" criterion is **only meaningful against `next start`**. F31 must run its route checks against a production serve, never `next dev`. | F05 | F31 |
| 14 | **`drone.owner_user_id` and `booking.pilot_user_id` are `ON DELETE RESTRICT`**, so deleting an account that holds registered aircraft or bookings is refused by the database — while `deleteUser` is enabled in `src/lib/auth.ts`. Deliberate: a registration record is not personal data to take away. **F28 owns the consequence** and must offer a real path (revoke, or transfer) instead of a raw delete that errors. | F05 | F28 |
| 36 | ~~**`viewerLevelFor` was never exercised with a reviewer who is also the drone's owner.**~~ **Exercised in F22c**: `/ar/rid/AJN-7Q4M-31KD` was opened by the admin who owns that aircraft, and the staff branch rendered with its reveal control and no error — staff winning by the order of the checks, as designed. Kept as a note because the *combination* still has no test. Staff wins by the order of the checks, so such a person sees the staff branch and their own reveal control; no row like that has ever existed. Worth a deliberate case when F22 gives reviewers aircraft. | F11 | F22, F31 |
| 77 | **The app states a national 120 m altitude limit; the documentation deliberately does not.** The airspace panel's altitude control reads *"الحد الوطني للارتفاع هو 120 مترًا"* in both languages, as fact. **No GACA document naming 120 m has ever been fetched and read** — F16b's research reached GACAR Part 107 and E-Book Volume 18, and `src/lib/landing/sources.ts` holds no such quotation. 120 m is the highest ceiling *we authored* for the Riyadh zones. `docs/zones-and-rules` therefore omits the claim, and F26b's decision-panel screenshot is **cropped above the slider** so a picture cannot smuggle it back in. Either the string is sourced and the docs should say so, or it is unsourced and the string should be softened — a product decision, and the honesty rule's exact subject matter. | F26b | F27, F30, F31 |
| 76 | **Two rejection templates promise an upload that does not exist.** `review.templates.identity_unreadable` and `review.identityTemplates.document_unreadable` both tell a pilot *"أرفق صورة واضحة للوثيقة"*. **There is no identity-document upload anywhere in the app** — F17's profile wizard collects a document type, number and date of birth and nothing else, and the reviewer compares typed data. Anybody who receives either message is being sent to a control that has never been built. Found while writing `docs/registering-a-drone`, which describes that rejection as being about the typed details instead. Either the copy changes or F28 adds the upload; it is a product decision, not a typo. | F26a | F27, F28, F31 |
| 15 | **`role` reaches the app as `string \| null`, not a union.** Better Auth types an `additionalField` declared as a list of literals as a plain `string`. `roleOf()` in `src/lib/session.ts` narrows it and **fails closed** — anything unrecognised is treated as `pilot`. Never read `session.user.role` directly; use `roleOf` / `isReviewer` / `isAdmin`. | F05 | Every wave that branches on role |
| 10 | **Nothing has checked the seeded polygons for self-intersection.** **They have now been *seen*** — F16a's landing page draws all 12 as an SVG, and they render cleanly: the restricted city, the permitted carve-outs, and KKIA's ring as a genuine hole under `fill-rule="evenodd"`. They are plainly authored regular polygons, which is what the disclaimer says. Seen is not tested, and nothing computes self-intersection. **F20 is still the first interactive render.** | F04 | F20 |
| 17 | **`emailConfigured` is baked in at build time on the SSG auth pages.** `/[locale]/forgot-password` and `/verify-email` are prerendered, so the "no provider configured" notice reflects `RESEND_API_KEY` as it was during `next build`, not as it is at runtime. Setting the key on the host without rebuilding leaves the wrong sentence on the page. Same class as the `APP_URL` QR trap. | F06 | F29 (should check it), deployment |
| 18 | **Nothing consumes `email_log` in the UI yet.** The rows are written and are the answer to "why didn't that email arrive?", but there is no screen that shows them. F29's system/ops page owes that. No Resend **webhook** was built either, so `delivered`/`bounced`/`complained` never arrive — deliberate: the endpoint needs a public URL and a signing secret. | F06 | F29 |
| 19 | **`/dev/emails` sample links always carry the `ar` prefix.** Each template's `sample` is a static object built at module load with `localeUrl(path)`, whose default locale is Arabic, so the *English* preview shows `/en`-less URLs. A preview-data artefact only — real sends get the recipient's locale from the caller. | F06 | Nothing; cosmetic |
| 21 | **Better Auth's own `rate_limit` table stores raw IP addresses** in its key (`0000:0000:…:0000\ **F24 adds a second thing F27 must not claim.** `audit_event.after` carries a **mobile number** on F17's `pilot_profile.contact_updated` — correctly, since it records what a contact was changed to. The whole table was scanned at F24 and that is the only PII in it; no national ID appears anywhere, and F24 writes neither. |/sign-up/email`). Ours does not — `rate_limit_bucket` keys on `sha256(pepper + ip)` — but the framework's key format is not ours to choose and there is no hook to hash it. F27's privacy page must therefore **not** claim the app never stores an IP address. Rows are short-lived but not swept by us. | F09 | F27, F29 |
| 22 | **Any bare numeric argument in an ICU message renders Arabic-Indic digits.** next-intl formats `{count}` itself using the page locale, so `ar` gives `٣`. `messages/ar.json` already carries two such messages — `booking.slotsRemaining` (`#` in the plural branches) and `admin.pendingCount` — neither of which is rendered yet. The rule is: **numbers reaching a message go through `src/lib/format.ts` first** and arrive as strings. ESLint cannot see this route. | F09 | F21, F22, F25 |
| 23 | **`scripts/i18n-check.mts` cannot tell a plural branch body from a placeholder.** `one {second}` is reported as a placeholder named `second` and fails the check as drift. Worked around in F09 by formatting the unit in `format.ts` instead — which was the better answer anyway — but the next person to write an English plural whose branch body is a single word will hit it. | F09 | any wave writing plurals |
| 24 | **Anything Better Auth calls back into runs *inside* its transaction.** F06's email send did, and the `email_log` insert failed on a foreign key onto a `user` row that was written but not yet committed — over a different pooled connection, which could not see it. Fixed with Next's `after()`. **Every later callback into Better Auth has the same hazard**, and so does anything F14 does in a `databaseHooks` hook. | F09 session | F14, F17, F28 |
| 25 | **A raw `sql` expression in a drizzle select returns a string, not a `Date`.** Drizzle has no column type to map through a raw `sql` expression and postgres.js hands back text; the first thing that formats it throws `Invalid time value`. In F08 it threw inside `sendEmail`'s `try` **before** the `email_log` insert, so the failure wrote **no row at all** and the job reported success. Select the column and narrow in code. The latent half — `sendEmail` rendering before it logs — is untouched and would swallow the next one the same way. | F08 | F29 (the log is the answer to "why didn't that email arrive?"), anything selecting a timestamp expression |
| 26 | **`export *` from `src/lib/db/schema.ts` does not re-export `user` under plain Node ESM**, because `schema.ts` also imports the name locally. Next's bundler papers over it — the app is fine — but any `tsx` script must import from `@/lib/db/auth-schema`. | F08 | any future script or seed |
| 27 | **No cron has ever fired on its own schedule.** Every F08 run so far was triggered by hand from the dev dashboard. Whether Inngest honours `TZ=Asia/Riyadh` as intended rests on the server accepting the expression, not on anyone having watched 03:00 Riyadh arrive. | F08 | F31 |
| 28 | **`job.rerunOfRunId` and the `cancelling` status are never written.** The SDK supplies neither: F29 must write `cancelling` when it sends a cancel, and `rerunOfRunId` on the new run when it initiates a re-run. `cancelled` *is* written, by `run-cancelled.ts`. | F08 | F29 |
| 30 | **The Vercel Blob driver has never run.** No token and no store on this machine, so `src/lib/storage/blob.ts` is unexecuted: the `put`/`head`/`del` calls were written from the installed `.d.ts`. The first deploy with a token is the first execution, and `addRandomSuffix: false` + `allowOverwrite: true` are the two options a wrong guess would show up in (a mismatched pathname makes `deleteFile` miss, which is an orphaned blob, which is a privacy leak). | F07 | Deployment, F29 |
| 31 | **Blob objects are stored `access: 'public'`.** Nothing in the app emits a blob URL — `fileUrlFor` returns `/api/files/…` and that route checks ownership — but a URL that escaped by other means would resolve, for ever, including after the row is deleted. `access: 'private'` is the fix; it was not taken because there is no store to prove it against. **F27's privacy page must not claim otherwise**, and it only matters once a token is set. | F07 | F27, deployment |
| 32 | **The upload delete/reorder *actions* were never driven over HTTP** — only their data layer was, plus the reviewer refusal path in the browser. **F19b closed the other half of F07's gap**: a real PDF was put on the dropzone's file input and travelled the whole route — sniffed, stored, row updated, audit written — so `POST /api/upload` and `FileDropzone` are both exercised for the first time. The delete and reorder actions themselves are still unposted. | F07 | F31 |
| 33 | **HEIC is rejected, and iPhones shoot HEIC by default.** The kind table accepts JPEG, PNG and WebP only; a pilot photographing their drone on an iPhone with default settings gets `upload_type_rejected` and no explanation of why their photo app produced a file the site will not take. **Nothing has still been uploaded from a real phone** — F19b's upload was a PDF from disk. Either the table grows a sniffer or the copy has to say so. | F07 | F18, F31 |
| 37 | ~~**A booking has no launch point, so no-fly overlays are not resolved at booking time.**~~ **Half closed in F23b, the half F23 owned.** `publishReadiness` now refuses to publish a *permitted* zone whose boundary overlaps a **published** no-fly zone, naming the zones in the way — so the state where booking would authorise a flight over a prohibition the map refuses can no longer be *created* through the app. What is still true, and is now F21's alone: a booking row carries a zone and no coordinate, so `createBookingAction` still asks the engine about a zone id. **The seeded `RUH-P-01` and `RUH-NF-KKIA` touch in a ~50 m sliver and were published before this check existed** — the rule is enforced at publish, not retroactively, so that pair is still there. Re-publishing either would now refuse. | F12/F13 | F21 |
| 38 | ~~**The seeded zones open at 06:00 and Riyadh sunrise is 06:34 in December.**~~ **Reconciled in F23b, by saying it rather than changing it.** The admin slot preview runs the real `deriveSlots` and then marks every slot `isNightWindow` would refuse on a `nightAllowed: false` zone, naming that day's sunrise and sunset. Seen: RUH-P-01's 17:00–19:00 slot marked against an 18:26 sunset, and a hand-set 04:00 opening marking two slots against a 05:33 sunrise. `slotStates` still has **no `night` state** — deliberately, for F13's reason — so **F21's pilot picker still shows slots the engine will refuse**, without a greyed marker. That is the part left, and it is F21's. | F12/F13 | F21 |
| 43 | **`notification.emailLogId` is wired on the approval path only.** `linkNotificationEmail` matches on `(userId, entityId)` and `qr-render` calls it after sending. The expiry sweep, the booking reminders and the closure fan-out all send email beside a notification and do not link it, so F29's "why didn't that email arrive?" answers for approvals and shrugs for the rest. | F15 | F29 |
| 44 | **375 px works through a same-origin iframe, and only that way.** `resize_window` reports success and leaves the viewport at 1440 — six attempts across five sessions. The technique that works: inject an `iframe` 375 px wide pointing at the page, whose media queries evaluate at its own width, then measure `scrollWidth` vs `clientWidth` inside it. **F31's gate must use this**, not the tool. **Reconfirmed at F24**, with the full result card rendered inside the frame: `resize_window` again left `innerWidth` at 1440, the iframe gave 371, and `body.scrollWidth === clientWidth` with `scrollX` still 0 after a real scroll attempt. | F15 | F31, every UI wave |
| 46 | **`<input type="date">` is unusable in this app.** Chrome renders it from the **browser's** locale and ignores `lang` on the element and on `<html>` — proven by setting both. Under an Arabic Chrome it prints `٠٤/٠٥/٢٠١٢` and a reversed `ةنس/رهش/موي` placeholder, which is rule 6 broken through a surface `format.ts` cannot reach. `DateOfBirthInput` (three selects) is the pattern. **Native `required` is banned for the same class of reason**: it cancels the submit and speaks the browser's language, so the app's bilingual refusal never runs. Both found by opening the page. **Broken again in F25b** — the audit filter bar shipped native date inputs and the Arabic page drew `ةنس/رهش/موي`. Also newly established: `dir`, `lang` and an inline `style.direction` are all overridden, because the UA sheet's rule on `input[type=date]` carries `!important` and beats author styles including inline ones. `DateSelect` is the only answer; wrap it in a hidden input if the form must stay a plain GET (`audit/date-filter.tsx`). | F17 | F18, F21, F23, F31 |
| 47 | **No QR has ever been printed, and none has been scanned by a real phone camera.** F19a proved what the image *encodes* — the stored PNG is byte-identical to a fresh encode of the `/ar/rid/{code}` URL, with a differing control — and that the target resolves. Neither says a camera can read a **20 mm printed** symbol at ~15 cm, which is the criterion F19 actually states and the thing a field inspector does. It needs paper and a phone, so no amount of code can close it. **F19b owns the print view**; whoever builds it should print one sheet and try, or say plainly that it is unverified. | F19a | F19b, F31 |
| 48 | **The print dialog has never been opened, and the printed palette is untestable today.** `window.print()` blocks the page on a native dialog the browser tooling cannot dismiss, so the Print button is wired and unexercised; the `@page` rule, the chrome-hiding selectors and the millimetre sizes were verified from the CSSOM and by measurement instead. Separately, *"printed output uses the light palette even in dark mode"* is **vacuous right now**: nothing in this app ever applies the `.dark` class — there is no theme toggle. **Re-check both when F28 ships one**, and note the printed surfaces also use explicit `bg-white` / `text-black` rather than theme tokens. | F19b | F28, F31 |
| 50 | **`CLAUDE.md` says GACA registration *requires* a manufacturer serial number. GACA's own documents do not.** E-Book Volume 18, Table 1 makes the serial essential information for the **Specific Category only**; Note 3 asks for it in the Open Category *"if this information is available"* and says the displayed identifier is *"either the GACA registration certificate number or the UAS serial number"*. **The product is unaffected and the pitch is stronger for it** — `/remote-id` argues the accurate version, that the regulator already contemplates an authority-issued identifier standing in for a serial, and that from 1 January 2026 what must be *broadcast* under DRI is a registration number, not a factory marking. But `CLAUDE.md`'s opening paragraph still states the unverified version, and it is the file every session reads first. **The correction is the user's to make.** | F16b | `CLAUDE.md`, F26, F27, F30 |
| 51 | **The three-year registration validity is uncited.** GACAR Part 48 could not be retrieved under any filename tried, and the three-year periods that *do* appear in Part 107 are the UAS Operator Certificate's duration (§ 107.131) and a record-retention rule — neither is a drone registration. `remoteId.validity` (*"Registration is valid for three years"*) is therefore **a product decision, not a regulatory fact**, and `/remote-id` deliberately does not present it as one. Anything that later attributes it to GACA needs Part 48 first. | F16b | F26, F27 |
| 54 | **In dark mode the map panel stays light.** The zone fills switch to the `.dark` `--zone-*` values and stay legible, but OpenFreeMap's `liberty` basemap has no dark variant, so a dark page frames a light rectangle. Switching to a dark style needs a theme signal the app does not have — **thread 48**, no toggle and no `prefers-color-scheme` hook — and reading the theme at map init only would leave the map stale after a toggle that does not yet exist. Cosmetic, and the seam is only visible to somebody who added `.dark` by hand. | F20a | F20b, thread 48 |
| 55 | ~~**A zone query cannot see a no-fly overlay, so `createBookingAction` cannot either.**~~ **Same half-closure as thread 37**: F23b refuses to *publish* an overlapping permitted zone, which is the consequence this row asked F23 for. The direction is still the safe one — the map is stricter, never greener — and `map-consistency.test.ts` still pins it. The remaining half is F21's: **carry the tapped point into the booking** so containment is answerable at all. That same missing coordinate is why a moved boundary flags *every* approved flight rather than a subset. | F20b | F21 |
| 56 | **There is no signed-in `/map` surface, and `nav.map` has pointed at nothing since F16a.** F20's file list names `src/app/[locale]/(app)/map/page.tsx`; F20 shipped the map on the public `/zones` instead, because that is where the airspace is published and a second route showing the same map would be two pages to keep in sync. What `/zones` deliberately does **not** have is F20's mobile layout — a full-screen map with a drag-up bottom sheet — because `/zones` is a document with a map in it, not a map application. **F21 needs that surface to book from and should build it**, with the sheet, and wire `nav.map` to it. | F20b | F21 |
| 57 | **The last-seat race has never been run in a browser.** `createBookingWithSeat` retries against `booking_seat_uniq` and `createBookingAction` answers `slot_full` with three alternatives, which F21a's wizard renders as one-click buttons — but seeded capacity is 4–6 and no seat has actually been contended by two concurrent pilots. F13's suite covers the transaction; **the alternatives UI is code that has been read, not run.** Needs two sessions booking the same seat at once, or an injected `pickSeat`. | F21a | F31 |
| 58 | **Ownership was proved only in the "does not exist" direction.** `/bookings/[id]` 404s for a well-formed id that is not this pilot's *or* does not exist — `getBookingById` returns `null` for both, deliberately, so the split cannot enumerate other pilots' flights. Verifying the *other pilot's booking* case needs a second account, and **the first account created becomes admin**, so a probe account is forbidden here. Same gap applies to F18's drones. | F21a | F31 |
| 59 | **A `"use client"` module's exports are client *references*, so a Server Component cannot call them.** F21b's dashboard 500'd at request time because `countdownParts` lived in `next-flight.tsx`; `typecheck`, `lint` and `test` were all green. The mirror of the `"use server"` trap in `validation/declaration.ts`. **Anything a server page and a client component both call belongs in a plain module** — here `src/lib/dashboard/countdown.ts`. Kept as a standing warning, not a task. | F21b | every wave with client components |
| 60 | **`next-intl` treats a `.` in a key path as a namespace separator**, so a *flat* catalogue key that is itself a dotted code — `auditActions["drone.approved"]` — is unreachable from `t("auditActions.drone.approved")` and renders as the literal path on the page. It shipped a raw key onto the regulator's audit trail in F22a with `typecheck`, `lint`, `i18n:check` and a purpose-built test all green: the test asserted the JSON *had* the key, which it did. `trailLabelKey()` underscores them and `audit-actions.test.ts` now asserts no key under `auditActions` contains a dot. **Any future catalogue keyed by a dotted domain code has the same hazard.** | F22a | every wave adding a code-keyed catalogue |
| 61 | **Nothing sends the rejection email — and nothing sends the authority-cancellation one either.** `booking-cancelled-by-authority` is the same shape as `drone-rejected`: a written, registered template with **no caller**, confirmed in F22b after a real cancellation reached the pilot as a notification and nothing else. Both need the same fix in the same place. `drone-rejected` is a written, tested template registered in `EMAIL_TEMPLATES`, and no code path sends it — `rejectDroneAction` writes the row, the audit event and a `droneRejected` **notification**, and stops. Approval gets an email because `qr-render` sends one; rejection does not, so a pilot learns their registration was refused only by opening the app. Deliberate for F22a (the criterion is *verbatim*, which the notification and `/drones/[id]` satisfy) but it is an asymmetry a reviewer would not expect. **F22c or F29 owns closing it**, and the send must go through a job for thread 24's reason. | F22a | F22c, F29 |
| 62 | **`document.documentElement.scrollWidth` is unreliable under RTL** with an overflowing descendant inside an `overflow-x-auto` box: it reported **696** against a 360 viewport on `/admin` while the page did not scroll at all. It cost a `min-w-0` "fix" that changed nothing and was reverted. The trustworthy signals are `document.body.scrollWidth === clientWidth` **and** `scrollTo(9999, 0)` leaving `scrollX` at 0. **Thread 44's iframe technique must be amended to use those**, or F31's gate will report overflow defects that do not exist. | F22a | F31, every UI wave |
| 63 | **An expired drone with no photographs can never be renewed.** `renewDroneAction` answers `photo_required`, and the only surface that adds a photograph is `/drones/[id]/edit`, which 404s for `expired` (`EDITABLE_DRONE_STATUSES` is draft + rejected). The pilot is told to add a photo and has nowhere to add one. It only bites a row that reached `approved` without photographs — which registration should prevent — so it is a seeded-fixture problem today, not a live one. **F18 or F28 owns either widening the editable statuses for renewal or saying so in the refusal.** | F22a | F18, F28 |
| 64 | **The four-eyes rule has never been satisfied over HTTP, because there is only one staff account.** `probe-four-eyes.mts` proves both halves against the database with two user *rows*; what is unrun is a second **reviewer signing in** and deciding the first account's submission in a browser. The assistant may not create accounts or enter passwords, so the user must sign up the second account and promote it on `/admin`. Until then the whole build has exactly one person who can decide nothing of their own. **Still one account as of Session 30** — checked directly against the `user` table, which holds a single row, `admin`. The plan handed to this session said to sign the second one up; it has not happened. **F24 hit it twice.** It is why `/admin/bookings/[id]` offers the single account no decision at all — so the *is this drone authorised right now* panel had no approved booking to render and needed `scripts/probe-authorised-now.mts` — and it is why F24’s reviewer-not-admin checks were driven over HTTP with a throwaway account that was deleted afterwards, rather than in a browser. **Session 34 (2026-08-21/22): the second account finally exists.** `alshar55@hotmail.com`, signed up by the user and promoted to **reviewer** on `/ar/admin` — the promotion is in the log as two `user.role_changed` rows (see thread 75 for why two). So the thread is now *satisfiable*, and half of F25b's criterion is done: **an admin reaches `/admin/audit` on a `next start` serve**, checked on 3001. **What is still unrun is the reviewer half** — a reviewer 404ing on `/admin/audit` while reaching `/admin/analytics` — and the original four-eyes decision in a browser. Both need a reviewer *session*, which means the user signing in; the assistant may not enter a password. Check them against a **production** serve, never `next dev` (thread 16). | F22c | F31, and any demo that shows an approval |
| 65 | **`ZONE_FILL` holds CSS variables, not colours.** `var(--zone-permitted)` works in MapLibre's own paint properties only because the app resolves it first (`resolveZoneColors`); anything else handed the map — terra-draw's mode styles in F23a, and whatever F25 charts with — gets a string it cannot parse and falls back to a default, **silently**. The name reads like a colour and is not one. | F23a | any future map or chart code |
| 67 | **A blank map in a CDP screenshot is not a blank map.** Both `/zones` and the zone editor screenshotted as flat beige rectangles for half an hour of investigation in F23b — style loaded, sprites and glyphs fetched, attribution and scale controls populated, worker starting cleanly, console empty. **One click on the canvas and the map appeared, fully drawn.** MapLibre only repaints on demand, and the capture does not force one. Two corollaries: **click the map before screenshotting it**, and *"no tile requests in `performance.getEntriesByType('resource')`"* proves nothing either — MapLibre fetches tiles **inside the worker**, whose timeline the window cannot see. Both wrong turns were taken. **F25b adds the harder half: check `document.visibilityState` first.** The automation tab was `hidden`, and rAF is suspended in a hidden tab — so MapLibre never renders, never fires `load` or `idle`, the layers are never added, and the tile deadline expires on a perfectly healthy map. That is not a screenshot that failed to repaint, it is a render loop that was never running, and it looks exactly like the `setWorkerUrl` trap. Read `visibilityState` before suspecting the worker, the style or the container. | F23b, F25b | F31, any session that screenshots a map |
| 68 | ~~**`zone-suspended.ts` has never run.**~~ **The wall is down.** `npx inngest-cli@latest dev -u http://localhost:3001/api/inngest` was installed and run in F23c, the `ajniha` app connected with **11 functions**, and **`closure-fanout` executed end to end** — a booking cancelled, notified and emailed from a closure published in a browser, with a `completed` row in `job`. Kept for one session as a note: **`zone-suspended.ts` itself is still unexecuted**, and it is now a fixture away rather than an install away. | F23b | F31 |
| 69 | **`inngest.send` throws, and it threw over a status that had already committed.** Suspending a zone with no Inngest listening gave the admin a `fetch failed` stack trace — while the zone *was* suspended. `suspendZoneAction` now guards the send and answers `fanOutQueued: false`, which the panel renders as a plain sentence. **Every other `inngest.send` in the app is still unguarded**: `approveDroneAction` and `revokeDroneAction` in `src/lib/actions/drone.ts` have exactly this failure available to them, and a revocation that throws after committing is worse than a suspension that does. F29 owns the general fix. | F23b | F29 |
| 70 | **A module-level counter in a client component is a hydration mismatch.** F23b's hours grid minted row keys from `let counter = 0` at module scope; the module is evaluated once per process on each side, so the server rendered `w1` and the browser `w2`, and React reported mismatched `id`/`htmlFor` — with `typecheck`, `lint` and `test` all green. Fixed with an index in the `useState` initialiser plus a `useRef` for rows added after mount. **Thread 11's shape again**, and the console is the only place it showed. | F23b | every wave with client components |
| 71 | **A cancellation reason reaches an English-reading pilot in Arabic.** `booking.cancellationReason` is a single column and holds the **authored** language, which is right for the record — but `/en/bookings/[id]` renders it raw under *"Why this was cancelled"*, so a closure whose English reason was written, stored and emailed still shows Arabic on the pilot's own page. The notification params carry **both** languages and are the material for a fix; the same gap applies to an authority cancellation, which has only ever had one authored reason. **F28 or F21 owns it**, and it needs a decision about whether the row grows a second column or the page reads the notification. | F23c | F31 |
| 72 | **`{count}` messages hard-code an Arabic plural.** Arabic has six plural categories; a message written as `{count} حجوزات` prints `1 حجوزات` for one. `impactCount` and `closureCancelCount` were fixed in F23c with the pattern that works under thread 22 — a numeric `n` selects the branch and is never printed, a **formatted** `count` string is what appears — but **`zoneAdmin.previewCount` and every other `{count}` message in the catalogues are unaudited**. `i18n:check` cannot see this: it compares placeholders between catalogues, and a message wrong in both is wrong consistently. | F23c | F25, F31 |
| 74 | **Every chart on `/admin/analytics` has only ever been drawn from single-digit data.** Five registrations, four bookings, thirty scans, two review decisions. Label thinning, the eight-zone bar cap, the six-step sequential ramp and the 44 px bar cap are exercised by unit test and by reasoning; **none has been seen on a full screen**. A seed of a few hundred rows would be the cheapest way to find out what this page looks like when it is doing its job — and F31 is the place that matters, because the pitch screen looking thin is a presentation failure rather than a bug. | F25a | F31 |
| 78 | **A deleted message key is not an error — it is text, and `i18n:check` cannot see it.** `llms.txt` shipped the literal string `meta.description` into the file that describes this app to an assistant, because F30a deleted that key and the route still read it. next-intl throws `MISSING_MESSAGE` **to server stderr** and renders the key path into the response; `typecheck`, `lint`, `i18n:check` and 1100 tests were green, and nobody reads production stderr. `i18n:check` is structurally blind to it: it compares the two catalogues *with each other*, and a key deleted from **both** leaves them perfectly in sync. Found by fetching the file. `site.test.ts` now names every `meta.*` key the spine reads and was proved to fail when one is removed — but that guard covers F30's keys only, and every other namespace has the same hole. | F30a | F30b, F31 |
| 75 | **A role change that changes nothing still writes an audit event.** Re-submitting the role form on `/admin` with the value already selected appends a `user.role_changed` row whose `before` and `after` are identical — `{"role": "reviewer"}` → `{"role": "reviewer"}`. Found in Session 34 while verifying the promotion: two clicks, two rows, one real change. It is F05's action, not F25b's, and it is not wrong so much as **noisy in exactly the wrong place** — the audit browser now renders every row, so an event that reports no change reads to a regulator as a decision somebody made. The fix is a no-op guard in the role action, not in the browser: the log must not be filtered at render, because then it stops being the log. | F25b | F26–F30 wherever the role action is touched; F31's demo |

---

## Decisions made mid-build

Choices not in the plan, or that changed it. Each needs a reason a future session will accept.

| Date | Decision | Why | Plan updated? |
|---|---|---|---|
| 2026-08-18 | **`EDITABLE_DRONE_STATUSES` moved to `src/lib/validation/drone.ts`, and `saveDroneDraftAction` now honours it** — so `rejected` is editable, not only `draft`. | F07 had already decided this list in Wave 4 and F18a wrote `status !== "draft"` beside it, so a rejected drone accepted new *photographs* while refusing a corrected *weight*. A pilot told the declared weight was wrong had no way to act on it. It lives in the pure module so a client component can ask without pulling `src/lib/storage` into the bundle; `storage/validate.ts` re-exports rather than copying, and a test asserts the two predicates agree. | Feature file updated |
| 2026-08-18 | **`deleteDroneAction` deletes the bytes before the row**, not after. | `drone_photo` cascades, and the moment it does every pathname the app knew is gone with it — an orphaned blob is a photograph that stays fetchable to anyone holding the pathname with no ownership check in front of it, and nothing in the database would ever reveal it. The ordering chooses the recoverable failure: a row-delete that fails after the bytes are gone leaves broken thumbnails a second delete fixes. | Feature file updated |
| 2026-08-18 | **No "Book a flight" on the approved screen**, and the Remote ID links to `/rid/{code}` instead of a card route. | F21 owns booking and F19 owns the card; neither exists. A button whose only destination is a 404 is what F18a refused to ship on the list card, and `/rid/{code}` is a real page that answers a real question — what a person scanning the aircraft sees. | Feature file updated |
| 2026-08-18 | **The three unreachable status screens are seeded with raw SQL**, not by driving `src/lib/workflow/`. | Settled with the user up front. F14 proved every drone edge 34/34 against the live database, so these rows exist for *rendering*; re-driving the transitions would prove nothing new. The cost is stated rather than hidden — no audit events, and a hand-set `registrationExpiresAt` — and `scripts/probe-drone-states.mts` says so in its header so it is never mistaken for a template. | n/a |
| 2026-08-18 | **`codec.test.ts`'s uniqueness assertion was relaxed to ≤ 3 duplicates**, with the arithmetic written down. | It asserted zero collisions in 10⁵ draws from a 2⁴⁰ space. The birthday bound is ~4.6 × 10⁻³, so it failed about one run in 220 — and it did, in this session. It was also contradicting the code it tests: `issueRemoteId` has a savepoint retry loop *because* collisions happen. A generator that had lost entropy produces thousands and still fails. | n/a |
| 2026-08-18 | **The delete confirmation and the reviewers' quoted reasons are hand-built markup**, not `window.confirm` and not a plain `<blockquote>`. | A native confirm speaks the browser's language and blocks the page — the `<input type="date">` class of defect from F17. And a reviewer's sentence is the one string on the page whose direction is not the page's, so both quotes carry `dir="auto"`; without it an Arabic reason had its full stop set at the left-hand end on `/en`. | Feature file updated |
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
| `pnpm exec tsc --noEmit` | 2026-08-22 (F26b) | ✅ **Clean at F26b**, which added `src/lib/docs/screenshots.ts` and the `Screenshot` component. Earlier: ✅ **Clean at F26a**, which added `src/mdx-components.tsx` and `src/lib/docs/`. `@types/mdx` types the `.mdx` default export; the named `meta` export is untyped, which is why `isDocMeta` narrows it rather than a cast. Earlier: clean at F24 too. clean — **requires `next typegen` first** on a clean tree; use `pnpm typecheck`. Also runs F11's `@ts-expect-error` masking assertion |
| `pnpm lint` | 2026-08-22 (F26b) | ✅ **Clean at F26b.** Earlier: ✅ **Clean at F26a.** Rules 1 and 4 cover `src/mdx-components.tsx`, which is where every class string on the documentation pages lives — a markdown page carries none of its own. **Rule 5 is the one that cannot reach these pages**: a `[نص](/docs/remote-id)` in an `.mdx` is not an import, so the locale prefix is protected by routing every internal href through `Link` in the element map rather than by lint. Earlier: **Clean at F24**, which added `src/lib/lookup/` and `src/components/admin/lookup/` — the logical-property and bare-`Intl` bans both cover them unchanged. clean. Both rules probed rather than assumed: the **airspace purity** bans all fire on `evaluate.ts` (F12), and **rule 11** fires on a `.set({ status: … })` written into `src/lib/data/` while the four workflow files stay clean (F14). **Rule 11 probed again in F23b**: it fired on a `.set({ status: … })` written into `scripts/probe-zone-lifecycle.mts`, which was then rewritten to delete the row rather than reach past the workflow. |
| `pnpm build` | 2026-08-22 (F26b) | ✅ **F26b:** no route change, no schema change. **The `.next`-clobbering caution below bit again** — the dev server left running across a build serves broken chunks, and the symptom was `img.complete === false` on the new screenshots, which reads exactly like a broken image path. Restart dev after every build. Earlier — **F26a:** `/[locale]/docs` and `/[locale]/docs/[slug]` build **dynamic**, which they must — each reads the session for the header. **No schema change**; `pnpm db:generate` reported nothing to migrate. The `next start` port trap bit again exactly as the F24 row warns: `pnpm start` on a port a `next dev` was still holding failed with `EADDRINUSE` and the **dev** server kept answering, so the first round of "production" checks was not production at all. Kill the listener by PID and read `Ready in …` before trusting a result. Earlier — **F24:** `/[locale]/admin/lookup` and `/[locale]/admin/reveals` build **dynamic**, which they must — each reads the session; **no schema change**, `pnpm db:generate` reported nothing to migrate. **A caution learned here: `next start` on a port that is already listening fails and leaves the *old* process serving**, with the failure only in the log — kill the listener by PID and wait for `Ready in …` before trusting a production-serve result. `/[locale]/admin/zones/[id]/closures` and `/[locale]/admin/cities` build **dynamic**, which they must — each reads the session. **F23c adds no schema change**; `pnpm db:generate` reported nothing to migrate. **The build clobbers `next dev`'s `.next`** and the dev server on 3001 kept serving afterwards, but restart it if it does not. Earlier (F23b): ✅ `/[locale]/admin/zones`, `/admin/zones/new` and `/admin/zones/[id]` build **dynamic** too, and **terra-draw lands in a lazy chunk of its own** — see the bundle row below. Earlier (F22c): `/[locale]/admin/pilots` and `/[locale]/admin/pilots/[id]` build **dynamic**. Earlier (F22b): `/[locale]/admin/bookings` and `/[locale]/admin/bookings/[id]` build **dynamic**. `/[locale]/admin` and `/[locale]/admin/drones/[id]` build **dynamic**, which they must — each reads the session. `/api/zones/geojson` builds as a dynamic route; `/[locale]/rid/[code]` and `/api/rid/[code]` build as dynamic routes, `/robots.txt` static; `/api/upload`, `/api/files/[...path]` and `/api/inngest` too; migrates first; `/[locale]/dev/emails` still prerenders as a **404** in a production build; F17's `/[locale]/profile/complete` and `/[locale]/settings/profile` build **dynamic**. **F23b adds no route and no schema change**; `pnpm db:generate` reported nothing to migrate. |
| `pnpm i18n:check` | 2026-08-22 (F26b) | ✅ **1937 keys at F26b** (+2: the two deep links' copy). Earlier: ✅ **1935 keys at F26a** — the `docs` namespace rewritten (its F02 keys named pages that were never built), and `nav.help` deleted as unused. Earlier: ✅ **1765 keys at F24** (+54, the `lookup` namespace, `review.tabLookup` and `review.auditActions.remote_id_lookup`); **1711 keys** (1630 at F23b (1561 at F23a (1436 at F22c, 1371 at F22b, 1303 at F22a, 1155 at F21b). Earlier: **737 keys** (690 at F18a), ar/en in sync (632 at F17, 556 at F15) |
| **A booking decision driven over HTTP** | 2026-08-19 (F22b) | ✅ **all three, from the panel.** Approve → `approved` with a `decisionSnapshot`; authority-cancel with a written reason → `cancelled`, the reason stored byte-for-byte and shown back verbatim; the reject panel's 20-character floor disabling the button, flagging `aria-invalid` and naming the shortfall. Trail: `booking.requested` → `booking.approved` → `booking.cancelled_by_authority`, each with `actorRole: admin`, each rendered with a real label |
| **Approval refused by a closure published after the request** | 2026-08-19 (F22b) | ✅ **F22's headline criterion, driven in a browser.** A published `zone_closure` was inserted over the booked slot; the page's re-run flipped to **denied** with `zone_closed_window` and its fix, and pressing Approve was **refused with those same reasons** — the row stayed `pending`, `decided_at` null. Closure deleted, the booking then approved normally. F14's probe had proved the transaction; this is the first time a reviewer has been refused on screen |
| 375 px, Arabic, F22b's two routes | 2026-08-19 (F22b) | ✅ via the iframe (thread 44) — `body.scrollWidth === clientWidth` (356) and `scrollTo(9999,0)` leaves `scrollX` at 0 on both the queue and the detail page; the 46 rem booking table scrolls **inside its own box** (322 visible, 736 content). `resize_window` not used |
| `pnpm db:generate` + `db:migrate` | 2026-08-19 (F22c) | ✅ `0005_old_komodo` applied — **SQL read in full first**: one new enum (`drone_report_status`), one value added to `audit_entity_type`, one table (`review_presence`), five columns on `drone_report`, two FKs, three indexes, **no drops**. **25 tables.** The `ALTER TYPE … ADD VALUE` is safe inside drizzle's transaction here because nothing in the same migration *uses* the new value |
| **Four eyes, against the live database** | 2026-08-19 (F22c) | ✅ `scripts/probe-four-eyes.mts`, **22/22**. All six decisions refuse the owner — drone approve and reject, booking approve, reject and **authority-cancel**, module verify, identity verify — and a *different* reviewer gets through every one of them. A refused self-decision writes **no audit event and no status change**. Also the first execution of the declaration lock's `for update … of` across two left joins (a bare `FOR UPDATE` there is refused by Postgres) and of the new `drone_report` audit entity type. Every probe row deleted |
| **Four eyes, in a browser** | 2026-08-19 (F22c) | ⚠️ **half.** The owner's half is proven on all three screens: `/admin/drones/[id]`, `/admin/bookings/[id]` and `/admin/pilots/[id]` replace the decision panel with `OwnSubmissionNotice` for the one account, which owns everything. **The other half — a second reviewer deciding it over HTTP — is unrun**, and needs a second account the assistant may not create. See thread 64 |
| **The pilots directory** | 2026-08-19 (F22c) | ✅ in Chrome, all four search modes: a Remote ID resolving through the aircraft to its owner, a whole document number matched **on its hash** (a wrong one returning nothing under the right caption), an Arabic name fragment, and a miss. The term never reaches the URL — the search is a POST, deliberately |
| **The soft lock** | 2026-08-19 (F22c) | ✅ seen on screen. The heartbeat wrote its own `review_presence` row while the page was open; a second reviewer's row, inserted directly and expiring in ten minutes, rendered *"يفتح هذا السجل الآن أيضاً: سارة العتيبي"* on `/admin/pilots/[id]`. Both probe rows deleted. Two *live* browsers on one record has not been tried |
| **Report triage (thread 35)** | 2026-08-19 (F22c) | ✅ end to end over HTTP — a report **filed from the public scan page** in Arabic, appearing on `/admin` as `open`, closed as `actioned` with a note, and coming back showing who handled it and when. One `drone_report.actioned` audit event with `actorRole: admin`; a second close answers `already_applied`. The row is left in the database as demo content |
| 375 px, Arabic, F22c's routes | 2026-08-19 (F22c) | ✅ via the iframe (thread 44) — `body.scrollWidth === clientWidth` (356) and `scrollX` 0 on `/admin/pilots`, `/admin/pilots/[id]` and the rebuilt `/admin`. `resize_window` not used |
| **Drawing a zone, in Chrome** | 2026-08-19 (F23a) | ✅ a polygon **drawn with five clicks** on the real map, its area and vertex count appearing live under it (193.7 km², 5 points), saved as a **draft** with a `zone.created` audit event, and reopened from the list with its boundary loaded into the editor and fitted. Two defects found by looking, both fixed: the polygon drew **grey** (terra-draw is handed `ZONE_FILL`, which holds `var(--zone-…)`, and silently falls back to its own default — `resolveZoneColors` was the fix, as it was for F20's layers), and on the **second** visit the editor was inert because `map.on("load")` had already fired against a warm cache before the listener attached |
| **Geometry refusals, POSTed straight at the action** | 2026-08-19 (F23a) | ✅ four refusals and one silent correction, driven at `createZoneAction` over HTTP with the dev build's action id: `geometry_self_intersecting` (a bow-tie terra-draw itself will not let you draw), `geometry_outside_saudi_arabia` (a `[lat, lng]` pair), `geometry_too_many_vertices` (5 101 against the cap of 5 000), `name_ar_required` for an English-only name — and **a wrong `bbox` posted alongside a valid polygon was ignored**, the row storing the bbox computed from the geometry. A clockwise, unclosed ring saved with `["ring_auto_closed", "winding_corrected"]`. Every probe row deleted |
| **terra-draw out of the pilot bundle** | 2026-08-19 (F23a) | ✅ against the production build: the 138 kB chunk carrying terra-draw is referenced by `admin/zones/new` and `admin/zones/[id]`'s `react-loadable-manifest.json` and by **nothing** under `(public)/zones`. `EditorMount` is the `ssr: false` boundary that puts it there |
| 375 px, Arabic, F23a's routes | 2026-08-19 (F23a) | ✅ via the iframe (thread 44) — `body.scrollWidth === clientWidth` (356) on `/admin/zones` and on the editor. The map itself keeps `dir="ltr"` so MapLibre's own controls stay on the right side of the canvas; the toolbar beside it mirrors |
| **The compliance lookup, in a browser** | 2026-08-21 (F24) | ✅ all six input kinds driven through `/ar/admin/lookup` against the live register: a whole code in three spellings, a misread `I`-for-`1`, a four-symbol fragment **and one spanning the group dash**, a module serial, a national ID **through its hash**, a mobile in four spellings including Arabic-Indic digits, and an Arabic partial name. The five-candidate disambiguation list carried **no owner identity**; `AJN-0000-0000` gave an explicit "no registration found" with the report action. **Two defects found by looking**: seven duplicate-React-key errors on the declared-modules list — the same expression as F11's public scan page, fixed in both — and the **GACA disclaimer clipped below 640 px on all ten surfaces that show it** (`Badge` is `h-5 overflow-hidden`), now one `ProposalNotice` component |
| **"Authorised to fly right now?"** | 2026-08-21 (F24) | ✅ both answers seen, in `ar` and `en`. **Yes** with the zone and the slot; **No** with *"the registration is valid, but no approved booking covers this moment"* — a different sentence from the not-registered one. The yes case needed `scripts/probe-authorised-now.mts`: four eyes refuses this build's single account any booking decision (thread 64), and a slot that has already started cannot be booked. The probe row was deleted |
| **A reveal, and a reveal that could not be logged** | 2026-08-21 (F24) | ✅ the audit event is written **before** the identity returns — proven by *forcing it to fail*. A `BEFORE INSERT` trigger raising on `remote_id.identity_revealed` made the page answer "the reveal could not be logged", the ID stayed masked, `remote_id_scan.revealed_identity` stayed **false** and `audit_event` was unchanged. Trigger removed. The successful reveal set the flag and wrote the reason with **no digits of the document** |
| **Every search is logged, and carries no PII** | 2026-08-21 (F24) | ✅ 21 `remote_id.lookup` rows written, `{ queryType, resultCount }` only — including `resultCount: 0`. The **whole `audit_event` table** was then scanned for the national ID and the mobile: the single hit is **F17's `pilot_profile.contact_updated`**, which records a contact change and is meant to. F27's privacy page must say so rather than claim the trail holds no contact detail |
| **F24's routes and actions, production serve** | 2026-08-21 (F24) | ✅ **both halves, with a real probe account.** As a **pilot**: 404 on `/ar/admin/lookup`, `/en/admin/lookup` and `/ar/admin/reveals` with **no guard named**; `lookupAction` and `revealIdentityAction` both answered `not_found` with no identity field in the response. Promoted to **reviewer**: `/admin/lookup` renders and `lookupAction` answers `ok`, while `/admin/reveals` still 404s in both locales **and its link is not drawn**. Reveal without a reason refused at the action. The 20/hour reveal limit fired at the 20th call — driven with a short reason, so **zero audit events and zero reveals** were written. Account and its rate-limit rows deleted. **The reviewer half of thread 71's gap is closed for F24's actions**; four eyes itself is still unexercised |
| 375 px, Arabic, F24's routes | 2026-08-21 (F24) | ✅ via the iframe — a 371 px frame with the **full result card** rendered: `body.scrollWidth === clientWidth`, `scrollX` still 0 after a real scroll attempt, and no element overflowing horizontally. Two 28 px ghost controls raised to 44 px. `resize_window` **does not change `innerWidth` on this machine** — the iframe is the technique that works |
| **A closure published in a browser, and its fan-out** | 2026-08-20 (F23c) | ✅ **the first Inngest run on this machine.** `inngest-cli` installed, the `ajniha` app connected with **11 functions**; a closure drafted and published from `/ar/admin/zones/[id]/closures` cancelled its one overlapping booking through `closure-fanout` — `booking.cancelled_by_closure` with `actorIsSystem`, a `zoneClosed` notification carrying both languages as params, a `booking-cancelled-by-authority` email rendered and logged `skipped` (no Resend key), and a `completed` row in `job`. The probe booking was seeded by SQL and deleted afterwards; the closure is left as demo content. **Closes thread 68** |
| **The closure preview equals the fan-out's query** | 2026-08-20 (F23c) | ✅ `scripts/probe-zone-closures.mts` **23/23** — three bookings around a window (inside, ending as it starts, starting as it ends) return the identical set from `listBookingsInClosureWindow` and `listBookingsOverlapping`; a closure over a draft zone refused; `published_at` stamped once and a second publish `already_applied`; a published closure refused deletion and an unpublished one deleted **after** its audit event was written; an unpublished closure invisible to the pilot-facing reader and visible to the admin one. Every probe row deleted |
| **Closure and city screens, in Chrome** | 2026-08-20 (F23c) | ✅ in Arabic and English. The preview named the pilot and the flight time before saving **and** again inside the publish confirmation; the four closure states (not published / scheduled / in force / over) each rendered against the seeded and new rows; a reversed Riyadh centroid was refused live with the button disabled, and Tabuk — added through the form — appears in the zone editor's city select. **Two defects found by looking**: a raw `zoneAdmin.closureReasonHint` key and `ستُلغى 1 رحلات`. Console clean afterwards on both routes in both locales (2 messages, DevTools and HMR) |
| **The five F23c actions, forged cookie** | 2026-08-20 (F23c) | ⚠️ **half.** Every one of `createZoneClosure`, `publishZoneClosure`, `withdrawZoneClosure`, `previewClosureImpact` and `createCity` answered `not_authenticated` to a direct POST carrying a forged session cookie, and no city row appeared; a **cookieless** POST is redirected by the proxy and returns a 2-byte body with no data. The **reviewer** half is unrun — thread 64, one account |
| 375 px, Arabic, F23c's routes | 2026-08-20 (F23c) | ✅ via the iframe (thread 44, with thread 62's signals) — `body.scrollWidth === clientWidth` (360) and `scrollTo(9999,0)` leaves `scrollX` at 0 on both `/admin/zones/[id]/closures` and `/admin/cities`. `resize_window` not used |
| `pnpm db:up` + `db:migrate` | 2026-08-17 (F11) | ✅ `0004_broken_the_initiative` applied — `remote_id_scan`, `drone_report`, `remote_id_viewer_level`. **SQL read in full**: one enum, two tables, four FKs, five indexes, no drops. **24 tables.** |
| Remote ID codec, issuance, declarations | 2026-08-17 (F10) | ✅ against the live database — 100 000-code alphabet and duplicate checks, forced collision, five-collision throw, renewal keeping the code, suspension/reactivation, the module-claim transfer. See the session entry |
| Scan page + JSON twin at four viewer levels | 2026-08-17 (F11) | ✅ over HTTP — anonymous **12 keys**, owner 28, reviewer 29; the full national ID appears in no payload at any level |
| Airspace engine, against the live database | 2026-08-17 (F12) | ✅ bbox pre-filter over the real Riyadh polygons, carve-out beating the restricted base, a no-fly point, an over-ceiling refusal and the daily cap. The **KKIA annulus containment assertion** (thread 9) and the **declaration-window broadcast check** (thread 34) are unit-tested against the seeded geometry and rows |
| Booking concurrency, against the live database | 2026-08-17 (F13) | ✅ `scripts/probe-booking.mts`, **18/18**, run twice: capacity 1 with two simultaneous claims → one row; capacity 3 with five → seats 0,1,2; both `duplicate_booking` indexes; a cancelled seat reused; `capacity + 1` forced conflicts → `slot_full`; a failed booking leaving **no** audit event. Every probe row deleted |
| A booking driven over HTTP | — | ❌ **not run.** No page calls the actions yet — F20 owns the map, F21 the booking flow |
| Both lifecycles, against the live database | 2026-08-17 (F14) | ✅ `scripts/probe-workflow.mts`, **34/34**: every drone edge in order with one audit event each, a **self-built airframe with no serial number approved end to end**, renewal keeping the code, revocation suspending the Remote ID, and approval **refused** for a booking whose zone closed after the request. `actorRole` survived promoting the reviewer to admin. Every probe row deleted |
| A decision driven over HTTP | 2026-08-19 (F22a) | ✅ **done — the drought is over.** A rejection written from the reject panel (edited template, reason stored byte-for-byte, `rejectionCount` 1 → 2, **exactly one** `drone.rejected` event with `actorRole: admin`) and an approval pressed on the next drone. Six refusals driven straight at the actions wrote nothing. Earlier: ❌ **still not run.** F18b drove every *pilot* action over HTTP, but `approveDroneAction`, `rejectDroneAction`, `revokeDroneAction` and `reinstateDroneAction` have no caller — F18b's `approved` / `rejected` / `revoked` rows were seeded by SQL. **F22 owns closing this** |
| Approval → QR → email, as one flow | 2026-08-19 (F22a) | ✅ **run as one, from a button.** `approveDroneAction` → `approved`, registration 2026-08-19 → 2029-08-19, Remote ID `AJN-GCBR-3KJN` issued, the Inngest event reaching a live dev server, `qr-render` storing `qrPathname`, `email_log` `drone-approved` / `skipped` (no Resend key). Earlier: ❌ **never run as one.** The action sends the event and F08's job was proven separately; Inngest was not running during F14's probe |
| Identity reveal | 2026-08-17 (F11) | ✅ in Chrome — audit event with reason written **before** the value returned; forcing the audit write to fail refused the reveal and showed nothing |
| `pnpm test` | 2026-08-22 (F26b) | ✅ **1027 passed, 59 files at F26b** (+8: the anchors the app links into, and the screenshot registry — which **reads the PNG headers back** rather than trusting the declared dimensions, and fails on a file no page shows). Earlier: ✅ **1019 passed, 59 files at F26a** (+18 in `src/lib/docs/docs.test.ts`: the manifest ↔ file check in both directions, the order permutation matched across locales, the no-`h1` rule, `/docs/*` links resolving to a real slug, and `headingSlug` — including the **hamza fold**, pinned deliberately so it reads as a decision rather than an accident). The `.mdx` files are read as **text**, never imported: Vitest has no MDX loader and adding one would be a second compiler pipeline maintained alongside the bundler's, with the usual result that the two disagree. Earlier (F25b): **1001 passed, 58 files**. Earlier: ✅ **898 passed, 50 files at F24** (+41 in `src/lib/lookup/__tests__/detect.test.ts`: the six input kinds including Arabic-Indic digits and the four Saudi mobile spellings, the `flightAuthorisationOf` branches, and **a source scan standing in for F24's "verify by grep"** — the candidate projection carries no identity column and the action reaches the record only through `resolveRemoteId`). **Three mutations run, all three caught** — an identity column added to the projection, `getRemoteIdRecordByCode` imported into the action, and the eight-letter-name/valid-code collision. Earlier: **857 passed, 49 files** (26 new: the closure window's arithmetic against Riyadh civil time, the half-open overlap rule, and the city rules including a reversed Riyadh centroid). **Three mutations run, all three caught** — `closureOverlaps` made closed rather than half-open → 2 failures, a zero-length window allowed → 3, and a blank coordinate let through as `Number("") === 0` → 1. All reverted. Earlier (F23b): ✅ **831 passed, 47 files** (39 new: the hours grid's week rules against the real `deriveSlots`, publish readiness including the no-fly overlap, `geometryShrinks`, and the zone lifecycle's place in the transition table). **Three mutations run, all three caught** — the half-open overlap rule closed, the "a permitted zone needs hours" clause dropped, and `zone.suspended` opened to a reviewer. Earlier (F23a): **792 passed, 45 files** (45 new: winding and area, the geometry validator, and the zone form's rules). **Two mutations run, one initially survived**: `j = i + 2` → `i + 1` in the self-intersection scan was caught by five tests, but **dropping the latitude cosine from the area calculation was not** — the assertion window spanned 1.0–1.25 km² and both the right answer (1.12) and the wrong one (1.24) fell inside it. Tightened to 1.05–1.18, which fails on the mutation. A test that cannot fail is not a test. Earlier: **747 passed, 42 files** (5 new: `isOwnSubmission`, including the case that would stop the clock — a **system** actor with a null id must never match a null subject). The audit-label scan was **widened after it missed something on screen**: it matched `action: "x.y"` literally, so `action: isComplete ? "pilot_profile.completed" : …` slipped past and printed a raw dotted path on the English pilot page. It now reads a 200-character window after each `action:`, which covers a ternary; matching *any* quoted action-shaped string was tried first and pulled in rate-limit keys (`booking.create`, `drone.draft`). Earlier: **742 passed, 41 files** (13 new: the urgency buckets and their boundaries, and `registrationAtSlot` against the engine's own `<= slotEnd`). **One mutation run and caught by a test that already existed**: adding `booking.requested` to the audit table without a label failed `audit-actions.test.ts`'s source scan — which is how the two unlabelled booking actions were found at all. Earlier: **729 passed, 40 files** (28 new: the queue's age arithmetic and search, the validity-window round trip across month ends and a leap day, and the audit-label suite). **Four mutations run, all four caught** — a label dropped from *both* catalogues, a newly-audited action absent from `DRONE_TRAIL_ACTIONS` (caught by the source scan), `isOverdue` flipped `>` → `>=`, and the dotted catalogue keys restored. Earlier: **701 passed** (F21b). Earlier: **589 passed, 26 files**. F18b **ran the mutations F18a skipped**: 25 against `validation/drone.ts`, 21 caught, **3 real gaps (every length ceiling untested)** closed, 1 equivalent mutant recorded; then 4 more on `isDroneEditable`, all caught. Also **fixed two failing tests it did not cause** — `codec.test.ts` asserted zero collisions in 100 000 draws of a 2⁴⁰ space (birthday bound ~4.6 × 10⁻³, so ~1 run in 220 fails; now ≤ 3), and the suite's 5 s default was flaking three different expensive tests run to run (global `testTimeout: 20_000` in `vitest.config.mts`; **four consecutive green runs** after). Earlier: **583 passed, 26 files** (15 new: the weight-class boundaries, the serial-iff-commercial rule and the type/specs validators — **no mutations run on them yet**, see the session entry). Earlier: **568 passed, 25 files** (48 new: the Saudi ID checksum, the mobile normaliser, the profile validators, the open-redirect guard, and a **source scan** asserting the mask exists in one file and no page renders a raw document number; **12 mutations run, all 12 caught** — one initially "survived" and turned out to be a mis-aimed mutation, not a gap). Earlier: **520 passed, 20 files** (11 new: the bilingual collapse and the catalogue/source cross-checks). Earlier: **509 passed, 19 files** (30 new: the transition table and the workflow's arithmetic; **seven mutations run, all caught**). Earlier: **479 passed, 17 files** (106 new: geometry, Riyadh time, evaluate, precedence, reason catalogues, slots; **eight mutations run, all caught**). Earlier: **373 passed, 11 files** (32 new: codec and redaction; **six mutations run, all caught**). Earlier: **341 passed, 9 files** (22 new for the upload validator; four mutations run, one initially survived and the claim it tested was corrected). Earlier: **319 passed, 8 files** (31 new for the job rules; four mutations run, one initially survived). Earlier: **288 passed, 7 files** — 24 new for the rate-limit rules and the 429 branch. Four mutations run; **two initially passed**, and the tests were rewritten until they failed. See the session entry. |
| **Declared-module verify / reject** | 2026-08-19 (F22a) | ✅ over HTTP — a validity window stored as Riyadh civil midnight (exclusive end bound), `broadcastCapable` flipped with its own audit event, a window the wrong way round refused `invalid_validity`, and superseded rows offering no controls. **Closes thread 49** — all four columns are now written by somebody |
| **Identity reveal from a pilot profile** | 2026-08-19 (F22a) | ✅ over HTTP — the whole number returned only after the `pilot_profile.identity_revealed` event committed, carrying the reason and **no digits**. **Closes thread 45**: F11's reveal keys on a Remote ID code, which a `pending` drone does not have |
| **Admin routes, production serve** | 2026-08-19 (F22a) | ✅ on port **3002** with a real probe pilot account: 404 on `/ar/admin`, `/en/admin` and `/admin/drones/[id]`, **no guard named, no data**. The same request against `next dev` **does** name the guard — thread 16 reconfirmed. A forged cookie reaches every action and every one answers `not_authenticated`; a pilot POSTing the five reviewer actions gets `not_found`. Probe account deleted |
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
| Rate limiting — direct action POST | 2026-08-18 (F18a) | ✅ **done.** Four server actions POSTed from the owner's own session against a `pending` drone: `not_editable`, `upload_target_locked`, `already_applied`, `not_found`. The guard-then-limit prologue is now exercised over real HTTP, not only in probes. Tripping a *limit* through one is still unrun |
| Sign-up sends its verification email | 2026-08-16 (F09 session) | ✅ **after a fix.** It did not, until the owner's real sign-up exposed it — see the Session 7 addendum. |
| Owner account | 2026-08-17 | ✅ one user, `admin`, `preferred_locale = ar`. Three probe accounts were created and deleted while chasing the bug above; `user` is back to that one row, `email_log` and `rate_limit` emptied, the 12 seeded zones untouched. **Re-confirmed after F10/F11:** every probe row from that session deleted too — `drone`, `remote_id`, `remote_id_scan`, `drone_report`, `pilot_profile`, `audit_event` and `email_log` all back to 0. |
| F17 profile flow, in Chrome + against the live database | 2026-08-17 (F17) | ✅ wizard end to end in Arabic, the `?next=` return journey, the duplicate-document refusal against a probe account, `verifiedAt` cleared by an identity change, the rejection banner, the owner seeing `•••••4967`, and the audit trail carrying only the mask. Console clean. Every probe row deleted |
| **A server action POSTed directly, no session** | 2026-08-17 (F17) | ✅ **first time in this build.** Both F17 actions answered `{"ok":false, reasons:[{code:"unauthorized"}]}`. Closes half of thread 40 and the whole of F09's "direct action POST" gap for these two |
| 375 px, Arabic, via the iframe | 2026-08-17 (F17) | ✅ `scrollWidth === clientWidth`, no overflowing element, the three date selects on one row. `resize_window` not used — thread 44 |
| F18a registration flow, in Chrome | 2026-08-18 (F18a) | ✅ **a self-built airframe with no serial number registered end to end by clicking** — serial field absent, weight boundaries live, zero-photo submit refused, `?draft=` restored after a cold reload, empty state, Arabic and English, console clean. Probe rows and the local blob deleted |
| 375 px, Arabic, `/drones/new` | 2026-08-18 (F18a) | ✅ via the iframe — no horizontal overflow, radio cards stack |
| **F18b: all six status screens, in Chrome** | 2026-08-18 (F18b) | ✅ **first time any of approved / expired / revoked has been opened.** Seeded by `scripts/probe-drone-states.mts`. Four rendering defects found by looking — a revoked card claiming "valid until 2029", an Arabic reason mis-set on `/en`, a cramped delete confirmation, and a refusal with no link to its fix. Console clean, 12 messages, zero errors |
| **Delete removes the row *and* the blob** | 2026-08-18 (F18b) | ✅ through the UI, with a real uploaded PNG — `uploads/` 1 → 0 files, row gone. `not_deletable` for `pending` and `approved` when posted directly |
| **Renewal keeps the Remote ID code** | 2026-08-18 (F18b) | ✅ `AJN-9K3P-64VZ` unchanged through `expired` → `pending`, `drone.renewal_submitted` in the trail. Resubmit took `rejectionCount` 1 → 2 and cleared the row's reason |
| **Cross-pilot 404 — pilot _and_ reviewer** | 2026-08-18 (F18b) | ✅ over HTTP with a probe account, run twice (as `pilot`, then promoted to `reviewer`): 404 on detail and edit, indistinguishable from a non-existent id, **no drone data in the body**. Both accounts deleted |
| 375 px, Arabic, F18b's six routes | 2026-08-18 (F18b) | ✅ via the iframe — `scrollWidth === clientWidth`, no overflowing element on any of list, five status screens and edit. `resize_window` not used (thread 44) |
| Zone publish lifecycle, against Postgres | 2026-08-20 (F23b) | ✅ `scripts/probe-zone-lifecycle.mts` **19/19** — `apply.ts` locking and writing a **zone** row, publish refused without hours and refused over a published no-fly overlap (named), `publishedAt` stamped once, a second publish `already_applied`, a reviewer refused, archive refused with a live booking, and an approved booking **flagged to `pending` keeping its seat** with its notification and trail. Every probe row deleted. |
| Zone lifecycle over HTTP | 2026-08-20 (F23b) | ⚠️ **publish, suspend, republish, archive and the hours save all driven in a browser** on `RUH-P-20`, in Arabic, plus the English editor on `RUH-P-01`. **The suspension fan-out never ran** (no `inngest-cli`, thread 68) and **the geometry-impact handshake was never driven** (a terra-draw vertex drag would not land through CDP). |
| `pnpm db:seed` | 2026-08-15 (F04) | ✅ 6 cities, 12 zones, 98 hour rows, 2 closures. Second run inserted 0 of everything and left every `updated_at` byte-identical (md5 compared). |
| Signed-out route protection | 2026-08-16 (F05) | ✅ over HTTP — see entry. Includes the **forged-cookie** probe that proves the proxy is not the boundary. |
| Two-account ownership | 2026-08-16 (F05) | ✅ two probe accounts created, **every F05 criterion exercised**, then both deleted — `user`, `session`, `account`, `audit_event` all back to **0**, seed's 12 zones untouched. Details in the session entry. |
| Production serve (`next start`) | 2026-08-16 (F06) | ✅ on port **3210** — `/ar` 200, auth pages 200, `/ar/dev/emails` and `/en/dev/emails` **404** with no stack trace. (F05's guard checks were the earlier run.) |
| Uploads, end to end | 2026-08-16 (F07) | ✅ over HTTP with three probe accounts: type sniffing, size ceiling, cross-pilot 404, locked target, delete removing row **and** bytes, traversal refused. See the session entry. |
| Vercel Blob driver | — | ❌ **never executed.** No token, no store. |
| Browser console clean | 2026-08-18 (F18b) | ⚠️ **partial, but less so again.** F18b: `/ar/drones`, the six `/ar/drones/[id]` status screens, `/ar/drones/[id]/edit`, `/en/drones/[id]` and a 375 px iframe — **12 messages, all React DevTools / HMR / Fast Refresh, zero errors, zero warnings.** Earlier (F15): `/ar/notifications`, `/en/notifications`, `/ar/dashboard` and a 375 px iframe: **22 messages, all React DevTools / HMR / Fast Refresh, zero errors, zero warnings.** `src/components/airspace/decision-reasons.tsx` is still unopened. Earlier (F11): `/ar/rid/{code}` and `/ar/admin` join them: zero errors, zero warnings, through a reveal and a report submission. Earlier (F07): the dropzone page joined F06's three: zero errors, zero warnings. Every other route is still unopened. Earlier (F06): `/ar/dev/emails`, `/ar/forgot-password`, `/ar/verify-email` opened in Chrome: zero errors, zero warnings — only React DevTools' notice and `[HMR] connected`. Every other route is still unopened. |
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
- OG preview card as a third party sees it — needs a public domain. **The card itself renders** (F30c: Arabic correctly shaped, 1200×630 PNG, both locales, plus a `/remote-id` variant); what is unseen is how WhatsApp, iMessage or Slack crop and letterbox it.
- QR codes encoding a production URL — needs `APP_URL` on a real domain.
- Printed-QR scanning at 20 mm — needs a printer and a phone.
- Inngest production sync — needs a first deploy.
- ~~**Any Inngest run at all on this machine**~~ — **no longer true.** F23c installed and ran `npx inngest-cli@latest dev -u http://localhost:3001/api/inngest`; the app connects with 11 functions and `closure-fanout` has executed. Start it before any session that needs a fan-out, or `inngest.send` fails and the action reports `fanOutQueued: false` (thread 69).

---

## Session entries

Newest at the top.

---

### Session 47 — Wave 9 · F31 close-out: the log reconciled, Open Thread 20 measured and closed, thread 77 decided

**Date:** 2026-08-31
**Status:** ✅ done

**Built:**
- **The signed-in header wraps.** `src/app/[locale]/(app)/layout.tsx` — `flex-wrap` on the `<header>`, `flex-1 flex-wrap justify-end` on the `<nav>`. Two class strings and a comment recording the measurement, because the next person to see a two-row header on a phone will otherwise "tidy" it back.

**Fixed:**
- **Open Thread 20 was a real defect, not just an unchecked box** — five waves of "couldn't check 375 px" were hiding a live overflow on **every signed-in page, in both locales**. Unwrapped, the nav is **354 px** against a **351 px** content box in Arabic (`الإعدادات` 70 + the locale switcher 123 + `تسجيل الخروج` 101 + gaps), 332 in English. The page scrolled sideways — `scrollWidth` **411 px** in Arabic, 383 in English, against a 375 px viewport — and **the sign-out button sat at `left: -36`: rendered, focusable, and off the screen.** The public landing was clean at 360 px throughout, which is why nothing else ever caught it.
- After: **360 px in both locales, zero overflowing elements**, sign-out on-screen on a second row (header 101 px tall). **Desktop unchanged** — 1280 px, header 61 px, one row, no overflow.

**Deviated from spec:** none. No feature file claimed the header.

**Verified:**
- `pnpm typecheck` → clean. `pnpm lint` → clean, **2135 keys, ar and en in sync**. `pnpm test` → **67 files, 1114 tests, 0 failures**.
- The 375 px measurements above, before and after, in both locales, plus `/ar/drones` and the public `/ar`.

**Not verified:**
- **Not re-run: `pnpm build`, and the `verify:*` suite.** A two-class layout change touching no route, no query and no string, with typecheck, lint and 1114 tests green — but they were not run, and this line is the reason CLAUDE.md rule 12 exists. Run them before any deploy.
- The wrapped header has not been **seen** — no screenshot. The evidence is `getBoundingClientRect()`, which is what caught the SVG anchors and is stronger than a screenshot for overflow, but it is not a look.

#### How 375 px was finally measured — the technique, for next time

`resize_window` still does not work: it **reports success and the rendered viewport stays 1440** (`outerWidth: 0`, `visibilityState: "hidden"` — the window is not attached). That is the fifth failure and it is not worth a sixth.

**What worked: a same-origin `<iframe>` sized to 375 × 812, loaded with the app's own URL.** Media queries inside an iframe resolve against the *iframe's* width, so Tailwind's breakpoints evaluate at a genuine 375 px, and same-origin means `contentDocument` is readable — every element's `getBoundingClientRect()`, the computed styles, `scrollingElement.scrollWidth`. Overflow is then a query: every element whose `right > viewport` or `left < 0`.

Two traps, both already in CLAUDE.md wearing new costumes: the tab is **hidden**, so `Runtime.evaluate` on a probe of eight pages timed out at 45 s claiming the renderer was frozen — **batch two or three pages per call**; and the browser session carries the **user's real cookie**, which is the only reason a *signed-in* header could be measured at all. No credentials were needed and none were asked for.

#### The build log was stale, and this session's first act was fixing it

Session 46e was written while round two was blocked and said so. **Round two then ran** — four commits followed (`3e3646f`, `a87c726`, `31a13c1`, `078c262`) — and `docs/VERIFICATION.md` was corrected by one of them while this file was not. So the log claimed as open two things that were already closed: **`booking-rejected`'s missing caller** (closed by `3e3646f`, which also found a third template with no caller, `booking-approved`) and **the job-log filters** (`src/components/ops/job-filters.tsx`, `a87c726`). Both are corrected in place above, and the round-two section now records the four defects round two found in round one's own work.

**The rule that failed here is worth naming**: the entry was accurate when written and became false three commits later. An entry is not finished when the session ends; it is finished when the work it describes stops moving.

#### Thread 77 — the 120 m altitude claim — closed by the user

**The user's decision, taken this session: leave the string as it is.** The claim rests on the user's own knowledge of the rule; **no GACA document naming 120 m has been fetched, and none is claimed.** `altitudeLimitNote` and `GACAR_ALTITUDE_LIMIT_M` are unchanged, the documentation still omits the figure and F26b's screenshot is still cropped above the slider. Recorded so that a future critic meets a decision rather than a finding. **Thread 77 is closed.**

**Next session should know:**
- **Every remaining unknown needs a deploy, not a session.** QR stickers still encode `localhost`; Vercel Blob has never run; email is 82 rows of `skipped`; Inngest has never synced. None of these can be closed on this machine, and F31 cannot honestly close them either.
- **The 375 px technique above generalises.** The scan page (`/ar/rid/…`) is the most phone-first surface in the app and Session 46d named it as still unchecked at phone width — it can be measured now, in about two minutes.
- **The admin tab strip** still draws Zones and Audit for reviewers who 404 on them. Argued in `queue-tabs.tsx`, reported by a critic, **still the user's call** — the one open item that is not a deploy.

---

### Session 46e — Wave 9 · F31c Four critics, and the honesty findings they turned up

**Date:** 2026-08-25
**Status:** ⚠️ **Round one and round two both complete and fixed.** 13 broken, 5 missing, 25 worth knowing in round one; round two cleared every fix and found four defects in the fix work itself.

> **Corrected after the fact.** This entry was written while round two was blocked, and said so. The limit reset, round two ran, and four commits followed (`3e3646f`, `a87c726`, `31a13c1`, `078c262`). The round-two section below is the corrected account; `docs/VERIFICATION.md` was corrected in the same way by `31a13c1`.

---

#### Round one — four critics, one message

Promise-keeping, ownership, looks-like-theirs and operability, each read-only, each reading `docs/VERIFICATION.md`, the plan, the specs and the source. **Every finding was re-verified by hand before anything was changed.**

**Ownership came back clean** — no broken, no missing, across all 14 `src/lib/data/*.ts`, ~40 server actions and all six route handlers. No pilot-B reach, no pilot into `/admin`, no unscoped query a non-staff caller can reach, no `redactRemoteId` bypass, and not one action trusting its layout.

#### The honesty cluster — six live violations of the non-negotiable rule

1. **Four strings told pilots a *GACA reviewer* decides their booking**, on the public zone panel, the booking wizard and the confirmation page. The English said "GACA" outright — the exact claim `for-authorities.mdx` exists to deny, with the denial in the footer of the same page.
2. **The OG card and `llms.txt` claimed a proposal "put to" GACA** — a *relationship*, asserted on the two surfaces that travel without their page. The JSON-LD had been scrubbed of precisely this and documented why; the card beside it had not.
3. **The public map told every visitor "booking is not available yet in this demonstration"** — about a feature built and driven end to end this week.
4. **The masked-ID hint promised the full number "appears on no screen"** while a reveal control sat beside it on four surfaces.
5. **Both admin zone editors drew the full Riyadh airspace with no disclaimer**, breaking a rule `Disclaimer`'s own comment calls a project rule.
6. **Session 46d's own strings** named a job-runner vendor to a regulator persona and sent the reviewer to a page that answers them 404.

#### Correctness

- **The three alternative-slot buttons had no label at all** — the only child was a whitespace literal. Three blank buttons, three nameless controls for a screen reader. `SlotTime` was already imported for the review pane so the unused-import rule never fired, and this is the visible half of step 13, the one step never driven in a browser.
- **`createBookingAction` bound a booking to any `droneId` passed in**, with no owner predicate, while all four sibling actions narrow the same permissive read. Staff-only — but the owner would see a flight they never planned and their aircraft's anonymous scan page would report it airborne.
- **`PROBE18B` was never seed data.** `probe-drone-states.mts` sets it as `MARKER` with a teardown that never ran, so F31's *"no test fixture remains"* was unmet — **and the evidence offered for it searched `probe-%`, which is case-sensitive and matched 0 of the 7 rows.** Renamed to real Arabic nicknames rather than deleted; they now carry Remote IDs, QRs and bookings.
- **Refusal reasons outlived their cause** — cleared in exactly one place, so a refusal followed the pilot through every later step.

#### Operability, and thread 61 closed

- **The Inngest health check answered from something it never measured**: it probed `localhost:8288` unconditionally and accepted any status under 500, so it read *degraded* on a correct production install and *green* whenever anything held that port. **Both directions were live on this machine today.**
- **Three swallowed `catch` blocks now report** — both zone fan-outs discarded the exception entirely, leaving client state as the only trace that pilots were never told their bookings were cancelled.
- **Nothing sent the rejection email** — thread 61, specified in F06 with its criterion already ticked, assigned to "F22c or F29", closed by neither. Now a `drone/rejected` event and job, through a job for thread 24's reason, reason quoted verbatim. **Proved**: 12 functions instead of 11, a negative control that sends nothing for a drone that is not rejected, and a real send logged to the owner in `ar` with the job `completed`. **`booking-cancelled-by-authority`, which thread 61 names alongside it, is already wired — that half is stale.**
- **A Resend key is not a verified domain.** With a key and no `EMAIL_FROM` the sandbox sender reaches only the account owner: nothing logs `failed` and the row read *Healthy* while no pilot received anything.

#### Round two — blocked, then run

**Both round-two critics terminated on their first call: the account hit its monthly spend limit.** The limit reset and round two ran on the second attempt. Its verdict on the seven round-one fixes: **all correct, no broken, no missing, and no regression against the non-negotiable rules** — `evaluate.ts` still pure, every new send after its transaction and before `revalidate`, no logical-property or Intl violations, all seven `inngest.send` sites guarded and logging. Before it ran, the author's own check answered the two correctness questions round two existed to ask: `clearRefusal` cannot race `applyReasons`, and the two `isDev` derivations are byte-identical.

**Eleven worth-knowing findings. Four were defects in the round-one work itself:**

1. **The worst was an honesty defect I created.** `booking-approved` rendered `row.ceilingAglM ?? 120`, so a zone with **no published ceiling** emailed the pilot *"Maximum altitude: 120 m"* — asserting the app's single unsourced regulatory figure (thread 77, deliberately kept out of the docs and cropped out of F26b's screenshot) as **this flight's** limit. `booking-reminders` used `?? 0` for the same column, so two emails about one flight disagreed, and **0 m reads as ground level — the opposite of unlimited.** Both templates take `number | null` now and say *"no published ceiling"* when there is none.
2. **The `emailSandboxSender` message contradicted `send.ts`**, which documents that state precisely: with a key and an unverified domain, mail reaches the Resend account owner and every other address comes back `failed` with the provider's reason. My message said nothing would log as failed. The health page is the one read under pressure, so it now says what `send.ts` says.
3. **`usingSandboxSender` had two edges.** `EMAIL_FROM=` in a `.env` is the empty string, which `??` keeps — so every send went out with a blank `from` while the health row reported the sandbox state rather than a broken one; and an operator setting the sandbox address explicitly got a green row. Now `||` with a trim, and the flag tests the **resolved** address.
4. Inserting the two booking events left the rejection's docblock above the approval, so one carried the wrong comment and the other none.

**Noted rather than papered over:** `noticeQueued` is returned by three actions and rendered by none. The panel unmounts the moment the page re-renders as decided — the same reason the approval warning had to become a derived row — and a rejection has no equivalent durable trace to derive from. The comment now says so, and names the missing email-log row as the operator's signal, which the job and email filters can now find.

#### All fourteen registered functions have a caller — 11 at the start of F31c

The operability critic reported `drone-rejected` and `booking-rejected` as templates written, registered and tested with **no code path sending them**. Auditing all eleven rather than taking the two reported found a **third**: `booking-approved`. So a reviewer's decision on a booking reached the pilot as a bell notification and nothing else, **in either direction**. Both now go through jobs like their drone twin, each re-reading and refusing anything whose status has moved since the event was sent — a booking cancelled between the decision and the send must not be confirmed as standing, and one since reinstated must not be described as refused. `booking-rejected` sends `alternatives` empty, deliberately; the template is built for that case and says so.

#### The job log is filterable

By status and by function, in the URL, using `EmailFilters`' shape and its own parameter names so the two panels on that page do not disturb each other. `src/components/ops/job-filters.tsx`. Unfiltered newest-50 spanned about **eight hours** against `booking-closeout`'s 96 runs a day, so last night's failure had already scrolled off the panel.

**Re-run after round two's own fixes:** `tsc` clean, `lint` clean, **2135 keys** in sync, **1114/1114**, routes **126/126**.

#### Deliberately not changed

**The admin tab strip draws Zones and Audit for reviewers who then get 404s.** The critic is right that it contradicts `/admin/lookup`, whose comment even says *"the zones tab makes the opposite call"* — but `queue-tabs.tsx` argues its position explicitly, and reversing a documented design decision is not a defect fix. **The user's call.**

#### Next session should know

- **The cron jobs now fire unattended.** `booking-closeout`, `booking-reminders` and `review-queue-digest` all ran on schedule, which retires the long-standing *"nothing has ever run on its own schedule"*. One consequence: the walkthrough booking was correctly marked `no_show` once its slot passed.
- **Jobs need `INNGEST_DEV=1` passed inline to `pnpm start`** plus `npx inngest-cli@latest dev -u http://localhost:3001/api/inngest`. `.env` was not modified.
- **The review queue is empty** — both pending aircraft were approved, so a future approval test needs a freshly registered drone.
- **Still open**: the 375 px header and the 120 m altitude claim, both the user's decisions. `booking-rejected`'s caller and the job-log filters, listed here when this entry was written, were closed by the round-two commits above — don't rebuild them.

---

### Session 46d — Wave 9 · F31b Steps 6 and 7, and the crash that hid behind them

**Date:** 2026-08-25
**Status:** 🟨 **12 of 14 steps verified.** The user signed in as the reviewer,
which unblocked steps 6, 7 and the reviewer 404s. **Three defects found and
fixed**, one of them on the single most important action in the product.

---

#### Thread 64 is closed — the reviewer boundary, over HTTP

Signed in as `alshar55@hotmail.com`, every route answered as specified:

| Route | Reviewer |
|---|---|
| `/ar/admin/zones`, `/ar/admin/audit`, `/ar/admin/reveals`, `/ar/settings/system` | **404** |
| `/ar/admin/cities`, `/ar/admin/zones/new`, `/en/admin/audit` | **404** |
| `/ar/admin`, `/ar/admin/analytics`, `/ar/admin/lookup`, `/ar/admin/pilots`, `/ar/admin/bookings` | **200** |

**No stack trace on any of them**, and the English locale 404s too — the guard
is not locale-dependent. The last open F31a acceptance criterion.

#### Step 6 — the four-eyes rule, proven from both sides in a browser

The **same URL** that showed **لا يمكنك البتّ في طلبك أنت** and no decision
control to the owner renders **اعتماد / رفض** to the reviewer, with the
**بدون رقم تسلسلي** badge and its explanation in front of them. Nothing about
the page changed; only the account did.

---

#### The defect: an approval that committed and reported a crash

**Pressing اعتماد returned Next's error page.** The registration had been
granted anyway — status `approved`, Remote ID minted, audit rows written.

The digest on the screen matched the serve log exactly:

```
⨯ Error: Failed to send event … We couldn't find an event key to use to send
  events to Inngest … digest: '1800274008'
```

`approveDroneAction` sent `drone/approved` **after** the transaction committed —
correct ordering — but **unguarded**. With no event key the send throws, the
exception escapes the action, and Next renders a 500 over a decision that
succeeded.

**`suspendZoneAction` already guards exactly this**, and its comment describes
what happened to me almost word for word: *"it threw, in a browser, over a
suspension that had already been written … the status changed and the person
who changed it believes it did not."* That guard was written for zones in
thread 69 and **never applied to the drone decisions** — the one action this
whole product is a demo of. `approveDroneAction` and `revokeDroneAction` were
both unguarded; all four `inngest.send` call sites are now inside `try`.

**Why the guard alone was not enough.** `stickerQueued: false` reaches the
panel, but the panel unmounts the instant the page re-renders as decided, so
the warning is one nobody ever reads. The durable form of the same fact is a
row: **an approved registration whose Remote ID has no `qrPathname`.** The
decided box now reads that and says the sticker was not drawn and the pilot was
not emailed. **Verified in both directions** — it appeared on a fresh load after
the failed send, and **cleared itself** once the QR existed.

#### The second defect: a production serve could never run a job

Chasing the first one, `INNGEST_DEV=1` did nothing and the log kept printing
*"set the INNGEST_DEV env var"*. The value was being ignored by
`src/lib/inngest/client.ts`, which passed `isDev: process.env.NODE_ENV !== "production"`
— and **passing `isDev` at all disables the SDK's own documented switch.**

So under `next start` the app was permanently in cloud mode, answered
`/api/inngest` with a 500, and **no job could ever run against a local dev
server** — which is why F23c's fan-out had to be driven under `pnpm dev`, and
why the un-runnable list has been carrying Inngest since Wave 4.

`INNGEST_DEV` now wins when set, with the `NODE_ENV` derivation as the default
so a fresh clone still works with no env at all. Result, on a **production
serve** for the first time on this machine:

```
PUT /api/inngest → 200
apps: [{ name: "ajniha", connected: true, functionCount: 11 }]
```

---

#### Step 7 — complete, and the QR verifier grew

With the app connected, `drone/approved` was fired for both approved aircraft:

- **Remote IDs**: `AJN-V56M-NAX6` (صقر الرياض) and `AJN-Y74H-2740`, both `active`.
- **Validity**: 2026-08-25 → 2029-08-25, **1096 days** each — three years,
  including 2028's leap day.
- **Audit**: `drone.approved` **and** `remote_id.issued`, both `actor_role: reviewer`,
  sharing a timestamp — one transaction.
- **Notification**: `droneApproved` × 2.
- **QR rendered**: `qr/AJN-V56M-NAX6.png` (4051 B) and `qr/AJN-Y74H-2740.png` (3981 B).
- **Email logged**: `drone-approved`, `ar`, `status: skipped` — no Resend key,
  labelled honestly rather than as a failure.
- **Job rows**: two `qr-render` runs, `completed`, no error, `trigger_event: drone/approved`.

**`pnpm verify:qr` now passes 22/22** (was 14/14 with three stickers, now five).
Both new PNGs are **byte-identical** to a fresh render of
`{APP_URL}/ar/rid/{code}`, 512×512, and the negative control still passes.

**How it was invoked, stated plainly.** The two events were posted to the dev
server directly, because triggering them through the app needs the *owner's*
session — the Regenerate control and the system page's re-render are both
admin-only, and the browser was signed in as the reviewer. **The approval path
that sends the event is the thing that was fixed and it was exercised twice;
what was not re-driven end to end in one click is send-and-render together.**

**Every sticker still points at `http://localhost:3001`.** Correct here, fatal
in production.

---

#### Not verified

- **Step 13** — racing the last seat. Needs a second signed-in *pilot*, and the
  reviewer has no pilot profile and no aircraft; الثمامة's capacity is 6, so
  there is no last seat to race. Cheapest route is a capacity-1 zone created
  from `/admin/zones/new`, then archived.
- **Steps 1 and 2** cannot be re-run and were not.
- **The 20 mm printed scan**, unchanged.

#### Next session should know

- **The Inngest dev server must be running** for any job: `npx inngest-cli@latest
  dev -u http://localhost:3001/api/inngest`, and the serve started with
  `INNGEST_DEV=1` — which now actually works. Without it the app is in cloud
  mode, `/api/inngest` answers 500, and approvals report `stickerQueued: false`
  instead of crashing.
- **`.env` was not modified.** `INNGEST_DEV` was passed inline to `pnpm start`.
- Both remaining pending aircraft are gone — **there is nothing left in the
  review queue**, so a future approval test needs a freshly registered drone.

---

### Session 46c — Wave 9 · F31b (continued) The walkthrough in a browser, and the bug it found

**Date:** 2026-08-24
**Status:** 🟨 **9 of 14 steps verified by hand in Arabic.** Steps 6 and 7 are blocked by a *correct refusal*, not by a missing tool; 13 is deferred. **One real defect found and fixed**, with three more found and left named.

---

#### The extension connected, and the picture was better than the log said

`tabs_context_mcp` reached Chrome on the first call. Two things last session recorded as blockers were not blockers:

- **The browser was already signed in as the admin**, and **that account owns all seven drones**. So the "pilot" half of the walkthrough needed no second sign-in — steps 3, 4, 5, 8, 11 and 12 ran on the account that was already there.
- The production serve from Session 46b was still answering on 3001, **and had been up since the previous day.** It was killed by PID and restarted before anything was trusted; every result below is against a serve whose `Ready in` line was read.

**Only two accounts exist** — admin (`alshar044@gmail.com`) and reviewer (`alshar55@hotmail.com`). There is no third pilot account.

---

#### The defect: a successful upload the pilot could not see

**`src/components/upload/photo-grid.tsx` copied its `photos` prop into `useState`.** `useState` reads its argument on the first render only, so the grid kept its mount-time array for ever and discarded every payload that arrived afterwards.

`step-photos.tsx` had the seam exactly right — `onUploaded={() => router.refresh()}`, with a comment explaining that the grid must render database rows because the upload response carries no row id. The refresh fired, returned 200, and carried the new rows. **The grid threw them away one component down.**

The evidence chain, each link measured rather than inferred:

| Link | Observation |
|---|---|
| Upload | `POST /api/upload` → **200** |
| Database | row count rose on every upload (1 → 6 across the session) |
| Refresh payload | fetched the current RSC URL: **4 photo references present** while the DOM held **2** |
| Cause | `const [photos, setPhotos] = useState(initial)` at line 43 |

**Fixed with `useOptimistic`**, which derives from the prop instead of shadowing it, and whose rollback story is free: a refused action simply stops being applied, so the manual `setPhotos(photos)` restore is gone. Reorder is applied **by id**, not by index, so a payload arriving mid-transition reorders what exists instead of indexing off the end.

Verified after rebuild, on the real page: **5 photos on load → 6 after upload with no navigation**; delete **sticks** (the optimistic removal did not revert, so fresh props arrived); reorder persists and **the database agrees with the screen** (`sort_order` 0/1 matched the rendered order). Files on disk match rows exactly — **no orphaned bytes**, which is what `deleteDronePhotoAction`'s own comment promises.

`tsc` clean · `lint` clean · **1114/1114 tests pass**, unchanged from F31a's count · build clean, no new migration.

---

#### Two instruments that lied, both worth remembering

1. **The extension's network panel reported `503` on four requests that actually returned `200`.** After every upload it showed the router refresh and three header prefetches as 503. Nothing in this repo emits 503 and nothing in `next/dist/server` contains the literal. Patching `window.fetch` in the page — the app's own view of its own requests — showed **200 on all five**. A `503` in that panel is not evidence; the page's own `fetch` is. Most of an investigation went into this.
2. **`read_page` prints an input's `value`, not its accessible name.** The build-type radios listed as `commercial` / `self_built` / `fpv` and looked like untranslated enum codes shipped to users. They are not: each radio is wrapped in a real `<label>` carrying the Arabic text, so the accessible name is Arabic. Checked before it was written up.

---

#### The steps

**Step 4 — the serial-less registration, and the product claim holding on a live page.** A self-built FPV named **صقر الرياض** (not `PROBE18B`), 850 g, camera, two photographs. **The serial field is never rendered** — `showsSerial = serialRequiredFor(buildType)` — and switching to *تجارية* flips the manufacturer hint from optional to required, so the conditional is live rather than merely absent. The review pane has **no serial row at all**. **No validation error anywhere**, which is the acceptance criterion.

**Step 5 — `status = pending`, `serial_number` NULL, zero Remote IDs.** The card reads قيد المراجعة, dated *24 أغسطس 2026* — Gregorian, Latin numerals. Not auto-approved.

**Step 6 and 7 — blocked by the four-eyes rule, which is the feature working.** `/admin/drones/{id}` renders **لا يمكنك البتّ في طلبك أنت** and **no approve or reject control exists at all** — absent, not disabled. The admin owns the aircraft, so this account can never approve it. The copy also promises the server refuses a bypass; `isOwnSubmission` is called in **ten places inside `src/lib/workflow/`** (booking ×3, declaration ×2, drone ×2, identity ×2) with the three pages only choosing whether to show the notice. **Verified by reading, not by driving** — driving it needs the reviewer. Because approval is unreachable, **step 7 (issuance, QR, notification, email) is unreachable too.**

**Step 8 — the digital ID card.** `AJN-7Q4M-31KD` in mono, تسجيل ساري, and a QR that is a **real 512×512 image** (`complete`, `naturalWidth` 512) with the code in its alt text. Registration window measured in the database: **1095 days = 3.00 years** exactly. The card's *تاريخ الإصدار* (18 Aug 2026) is the **Remote ID row's** date while *ساري حتى* runs from registration (12 Jul 2026), so the two dates on the card do not span three years — a **seeding artefact**, like the missing QRs, not a defect. **The physical 20 mm scan stays un-run** and is named as such.

**Step 10 — the reveal, driven live.** The prompt states the rule itself: *يُحفظ السبب في سجل التدقيق باسمك قبل عرض أي بيان*. A four-character reason leaves the button **disabled**; a real one enables it. Reveal audit events went **3 → 4**, and the new row carries the typed reason verbatim, `actor_role admin`, `actor_is_system false`, a real actor id, a **64-character IP hash** and the user agent. The value appeared only afterwards, in a red-bordered **الهوية المكشوفة** panel footed *سجّل هذا الكشف باسمك في سجل التدقيق*.

**Step 11 — the map, and every MapLibre trap avoided.** OpenFreeMap tiles drew, Arabic labels are **joined and correctly ordered**, the KKIA no-fly ring and the permitted polygons render, attribution is present and there is no API key. Tapping الثمامة returns **مسموح** — ceiling 120 م, requested 120 م, capacity 6, *ساعات الاثنين* 06:00–11:00 and 15:00–18:00 on a day that really was a Monday. The demo disclaimer is on the surface.

**Step 12 — the booking, and an unplanned proof of the re-check.** The first confirmation was **refused**: *الفترة المطلوبة في الماضي*. It was correct. The slot list had been rendered around 08:5x Riyadh and the confirmation came at **15:50 Riyadh** after a long gap, so the 15:00 slot had already begun; the server re-validated exactly as the page promises (*يُعاد التحقق من المجال الجوي عند التأكيد*), refused with a machine-readable reason and re-struck the slot as انقضت. Rebooked on 25 Aug: zone `auto_approve = t` → booking **`status = approved`**, matching the criterion; `slot_start` stored as `12:00+00` = **15:00 Riyadh**; notification written as **`type: bookingConfirmed`** — a code, not a rendered string.

**Step 14 — traceable, from the same log.** The activity slice is drawn from the audit table itself (*لا سجل ثانٍ*) and shows مُوافق عليه تلقائياً and طُلب الحجز at 15:53 beside كُشفت وثيقة الهوية at 08:49 and قُدِّم الطلب at 08:44. Health: DB 18 ms, **7 migrations applied** matching the 7 files on disk, `APP_URL` and `BETTER_AUTH_URL` both سليم. The email log keeps **«لم تُرسل — البريد غير مُهيّأ» distinct from «فشلت»**. Every photo upload and delete I performed is in the aircraft's own audit trail, attributed and timestamped in Riyadh time.

---

#### Second defect, found by chasing a finding I had already written down

**`<input type="number">` renders its display value in the *browser's* locale.**
The planned-altitude field drew **١٢٠** while its own ceiling hint drew **120**.
This entry originally recorded it as unresolved; it is resolved.

The DOM `value` stays ASCII (`31 32 30`), so `innerText`, all 1114 tests and
`i18n:check` read `"120"` — **only a screenshot catches it.** It is the
already-banned `<input type="date">` trap in a plainer coat.

Proved by elimination on the live element — direction, `lang`, the `locl`
feature, and element type all cleared — then decisively: **the same element
switched from `type="number"` to `type="text"` went from `١٢٠` to `120`.**

**The blast radius was far larger than the field that revealed it.** The admin
zone editor's shared `NumberField` meant **35 numeric inputs on
`/admin/zones/{id}` were rendering Arabic-Indic digits.**

Fixed in both places with the pattern this codebase **already documented in
three comments** — `inputMode="numeric"` with `dir="ltr"`, no `type="number"`.
`min`/`max` went with it: inert on a text input, and the ceiling was never
theirs to enforce — `above_ceiling` comes back from the server. `NumberField`
now **ignores** an unparseable keystroke instead of turning it into `null`,
which is a real value meaning "no ceiling".

**The rule is now enforced rather than written down.** Three components carried
the warning in prose and two others shipped the bug anyway, so
`no-restricted-syntax` bans both `type="number"` and `type="date"` in JSX.
**The rule was proved to fire** — re-introducing the attribute produces the
error — before it was kept.

Verified after rebuild: the altitude field and its hint both read `120`; all 35
zone-form inputs are `type="text"`; letters ignored, digits accepted. `tsc`
clean, `lint` clean, **1114/1114**.

**The lesson worth keeping**: the finding was recorded as "mechanism
unresolved" and it was one `type` attribute away. The probe that misled me
used `type="text"`, so it reproduced nothing and I concluded the element type
was cleared — **the control experiment has to be the real element, not a
lookalike.**

---

#### Found, not fixed — each with its reproduction

1. **375 px: the signed-in header overflows.** `/ar/dashboard` and `/ar/drones` scroll horizontally — `scrollWidth` **409** against `clientWidth` **356**. The offender is the header `<nav class="flex items-center gap-2">`, whose four children total **328 px**: notifications 36 + الإعدادات 69 + **language switcher 122** + logout 101, plus the logo and `p-3`. Public pages (`/ar`, `/ar/zones`) are clean, because the public header is smaller. The language switcher rendering two full buttons is the largest single item. **Left alone because the fix is a design decision** — collapse, hide labels, or wrap — not a mechanical repair.
2. **Arabic-Indic digits — found here, resolved above.** Recorded first as an unresolved mechanism, then traced to `<input type="number">` and fixed, together with the 35 inputs of the admin zone form and a lint rule. Left in this list only so the sequence is legible.
3. **Copy that the screen beneath it contradicts.** The masked ID hint reads *لا تظهر الوثيقة كاملة في أي شاشة* — absolute — and the reveal panel two centimetres below shows exactly that. Either the sentence or the affordance should change; which one is the user's call.
4. **Refusal reasons do not clear when their cause does.** After the past-slot refusal, *أسباب الرفض* stayed rendered through steps 2, 3, 5 and 6 even after a different, valid date was chosen. Cosmetic, but it reads as a standing objection to a booking the app then accepts.
5. **`PROBE18B` is still every seeded aircraft's name** (Session 46b's finding, unchanged). صقر الرياض now sits beside them, which makes the contrast sharper on every signed-in screen.

---

#### Not verified — and what each needs

- **Steps 6, 7 and 13, and the reviewer 404s.** All need a session as `alshar55@hotmail.com`; the assistant may not enter a password (thread 64). **Step 7 is only reachable through step 6**, so the whole issuance chain — Remote ID minted on approval, QR rendered, notification, email logged — remains undriven in a browser. F31a minted `AJN-308N-1W5B` mechanically, which is not the same evidence.
- **Steps 1 and 2** cannot be re-run: the accounts exist and the first-account-becomes-admin slot must never be disturbed.
- **The 20 mm printed scan**, unchanged, and named un-runnable in the spec.

---

#### Next session should know

- **`resize_window` still lies.** It returns "Successfully resized … to 375x812" and `innerWidth` stays **1440**. The 375 px pass above was done through a **same-origin 375 px iframe**, measuring `scrollWidth` against `clientWidth` inside it. That works and is the way to repeat it.
- **The serve is running on 3001**, restarted this session and logging to a file; kill by PID and read `Ready in` before trusting any successor.
- **Walkthrough artefacts left in place deliberately**: the aircraft صقر الرياض (`pending`, serial-less, two photographs) and an approved booking on 25 Aug 15:00. They are the walkthrough's output, not fixtures — deleting them would destroy the evidence. The reveal event and the photo add/delete events are permanent by design.

---


### Session 46b — Wave 9 · F31b (partial) The walkthrough, as far as it goes without a browser

**Date:** 2026-08-23
**Status:** 🟨 incomplete — **1 of 14 steps fully verified, and blocked on the Chrome extension for the other 12.** The extension is not connected: `tabs_context_mcp` cannot reach it.

---

#### What exists

| File | What |
|---|---|
| `scripts/verify/scan-page.mts` | Step 9, done as **source reading** rather than as a screenshot. `pnpm verify:scan-page`. |

---

#### Step 9 — **46/46**, zero identity leaks

All **5 real Remote IDs** (`approved`, `expired`, `revoked`) fetched signed out across **3 anonymous surfaces each** — `/ar/rid/{code}`, `/en/rid/{code}`, `/api/rid/{code}` — and every response body searched **whole** for 12 forbidden strings: the owner's Arabic and English name, the national ID, its **last four digits**, the mobile in four spellings including **Arabic-Indic digits**, both account emails and their local parts.

Zero leaks, across ~136 kB of Arabic HTML and ~148 kB of English per page. Every page still renders its own code, so nothing passes by rendering nothing. The drone nickname is absent from the anonymous page too.

**A screenshot could not have done this.** A value can sit in the markup, in an RSC flight payload, in a `<meta>` tag or in JSON-LD while being invisible on screen; `display:none` is not redaction.

---

#### Two false positives — recorded because they will recur

1. **`0501234567` and `2345` hit on every HTML page, and are not leaks.** The seeded pilot's mobile is `+966501234567`, and `messages/{ar,en}.json` uses `0501234567` as the worked example under `mobileHint` and `mobile_format` — **twice in each catalogue**, and the catalogue ships inside the page. The script now excludes any forbidden value that also appears in the catalogue **and prints the exclusion by name**; dropping it silently would train the reader to ignore the output. **The residue is a real finding: the demo data reuses the documentation's example number, so that one field cannot be checked this way.**
2. **A `429` is not a broken page.** `rid.resolve` is limited to **30 requests a minute per IP** (F09) and this script makes 15, so a second run inside the same minute trips it. The fetch waits the window out, and the limiter now has an assertion of its own — hammering `/api/rid/` **does** produce a 429, asserted last because it leaves the window exhausted.

---

#### Step 10 — the trail, checked; the ordering, read not driven

`revealIdentityAction` opens a transaction, writes `remote_id.identity_revealed`, marks the scan, and returns the identity **only after the commit** — any failure logs loudly and returns `reveal_not_logged` with no data. Structural, and it reads clean. **Driving it live still needs a reviewer session.**

Against the database: **3 reveal events, every one carrying an actor, a role, a reason and an IP hash**; 1 scan marked `revealed_identity`, matching the single `remote_id` reveal.

**One row has a 5-character reason, `"owner"` — deliberate, not a defect.** It is F28a's self-reveal: `revealOwnIdentityAction` takes no argument at all and writes that literal marker, on the **same** action name so an admin auditing reveals has one query. The actor on the row is what separates a self-reveal from a stranger's. A probe expecting the reviewer path's 10-character floor will flag it every time.

---

#### Step 7 — the QR, proved without a decoder — **14/14**

CLAUDE.md's own trap: **QR codes embed `APP_URL` at render time.** A stored PNG is opaque, and decoding it would need a decoder this project does not have — **adding a dependency to check a dependency is not a verification.** So each stored file was byte-compared against a fresh render of its payload URL through the app's own `renderQrPng`. `qrcode` is deterministic for a given string, size, error correction and margin, so byte-identical is proof of what it encodes.

All **3 stored QRs are byte-identical** to `{APP_URL}/ar/rid/{code}` (4029, 4057, 3950 bytes), each a real PNG at **512×512** read out of the IHDR chunk. **The negative control passes** — a wrong code renders a different PNG; without it a renderer ignoring its argument would have passed everything.

**Only 3 of 5 codes have a QR, and it is a seeding artefact.** The three are exactly the `approved` ones; the `expired` and `revoked` rows were inserted directly by `probe-drone-states.mts`, which never ran the render job. A missing QR degrades to a **"pending" panel with a Regenerate button**, `role="status"` not `alert` — a control, not a broken image.

**Every sticker so far points at `http://localhost:3001`.** Correct here, fatal in production.

---

#### Found, not fixed — demo polish

**All five registered aircraft are named `PROBE18B …`** (`PROBE18B معتمدة`, `PROBE18B منتهية`, `PROBE18B ملغاة`, …), seeded by F18b. Correctly **not** shown to an anonymous scanner — checked — so this is not a privacy finding. But it is what a reviewer and a pilot see on every signed-in screen, and a GACA demo would print developer jargon where an aircraft nickname belongs. **Expect F31c's "looks like theirs" critic to raise it.** Left alone because renaming seed data was not asked for; it is a `db:seed` change, not a code change.

---

#### Not verified — and what each needs

- **Steps 1–8 and 11–14, and the 375 px pass.** All need the **Chrome extension, which is not connected**. Install/enable at claude.ai/chrome, same account as Claude Code, restart Chrome if it is a fresh install. The 375 px pass then needs the same-origin iframe of thread 44 — `resize_window` reports success and leaves the viewport at 1440.
- **The four-eyes decision in a browser, and the reviewer 404s** on `/admin/zones`, `/admin/audit`, `/admin/reveals` and `/settings/system`. Thread 64: the user must sign in as `alshar55@hotmail.com`; the assistant may not enter a password.
- **Thread 77, the 120 m altitude claim.** Untouched. A product decision, written up at the foot of `docs/VERIFICATION.md` so F31c's critic meets it as a known open question rather than a fresh finding.

---

#### Next session should know

- **The production serve on 3001 is still running**, and every HTTP check in F31a and F31b ran against it. Kill the listener by PID and read `Ready in …` before trusting a fresh `pnpm start` — a `next start` on a held port fails silently and leaves the *old* process answering.
- Five re-runnable gate scripts now exist: `pnpm verify:{fresh-db,routes,scan-page,two-accounts,no-keys}`.
- **`docs/VERIFICATION.md` is the evidence file F31c's four critics read.** It now carries F31a's eleven checks and F31b's step 9 and 10, both false positives, and the `PROBE18B` finding.

---

### Session 46a — Wave 9 · F31a The mechanical gate

**Date:** 2026-08-23
**Status:** ✅ done. **Every one of the eleven gate checks ran and passed.** F31b (the walkthrough by hand, in Arabic, plus 375 px) and F31c (the four critics) remain.

---

#### What exists

| File | What |
|---|---|
| `scripts/verify/fresh-db.mts` | Creates a throwaway database, runs the migration folder into it, counts what landed, drops it. The `app` database is never touched. |
| `scripts/verify/routes.mts` | 126 HTTP assertions against a **production serve**: every public page in both locales, every protected route redirecting, every `/admin` route 404ing past a fabricated cookie, `/api/files` refusing a real photograph's own pathname signed out, and `/api/zones/geojson` refusing a missing bbox with a code rather than an exception. Sample ids come from the live database, so it survives a reseed. |
| `scripts/verify/two-accounts.mts` | 25 ownership assertions at the data layer, **in both directions**, plus six staff-only readers asked with a pilot session. |
| `scripts/verify/no-keys.mts` | Deletes `RESEND_API_KEY` and `BLOB_READ_WRITE_TOKEN` **before any import**, then drives a real serial-less approval end to end. |
| `docs/VERIFICATION.md` | The evidence file. Written for F31c's critics, who read it rather than the running app — four agents cannot share a port. |
| `package.json` | Four `verify:*` scripts, so the gate is re-runnable rather than a thing that happened once. |

---

#### The gate — all eleven, with numbers

| # | Check | Result |
|---|---|---|
| 1 | `pnpm typecheck` | ✅ zero errors |
| 2 | `pnpm db:generate` | ✅ **"No schema changes, nothing to migrate"** — 7 files before, 7 after |
| 3 | `pnpm db:migrate` | ✅ applied; the two messages are `severity: NOTICE` |
| 3b | Fresh database | ✅ **7 migrations → 25 tables, 16 enums** onto an empty database |
| 4 | `pnpm build` | ✅ 22.7 s, 85 static pages, **63 route entries**; only nine prerendered and every one session-free |
| 5 | `pnpm lint` | ✅ zero errors — and it caught an unused import in a script written for this very gate |
| 6 | `pnpm test` | ✅ **67 files, 1114 tests, 0 failures** |
| 7 | `pnpm i18n:check` | ✅ **2127 keys**, ar/en identical |
| 8 | `PORT=3001 pnpm start` | ✅ `Ready in 731ms`. Every HTTP check below ran against **this**, never `next dev` |
| 9 | `pnpm verify:routes` | ✅ **126/126** |
| 10 | `pnpm verify:two-accounts` | ✅ **25/25** |
| 11 | `pnpm verify:no-keys` | ✅ **12/12**, including a real approval |

`scripts/probe-booking.mts` was re-run for the concurrency row of the domain table: capacity 1 with two simultaneous claims → **exactly one booking**, the loser refused `slot_full` with three alternatives; capacity 3 with five → **seats 0, 1, 2**, no gaps; a failed booking writes **no audit event and no notification** (88 → 88, 10 → 10).

---

#### Deviated from spec

- **`scripts/verify/*.mts`, not `*.sh`.** The spec names `routes.sh`, `two-accounts.sh`, `no-keys.sh`. Every other script in this repo is `.mts`, the user's shell is PowerShell, and two of the three need the app's own modules (`src/lib/site/pages.ts` for the route list, `src/lib/data/*` for the ownership readers) — a curl script would have re-typed the route list by hand, which is the drift F30a existed to remove. `fresh-db.mts` is a fourth script the spec does not name; the acceptance criterion "applies cleanly against a **fresh** database" has no other way to be true.
- **The `verify:*` scripts invoke `node --conditions=react-server --import tsx`,** not `NODE_OPTIONS=… pnpm exec tsx` as the existing probes' headers instruct. An inline env prefix is not valid in a `package.json` script on Windows. Same conditions, same loader, one form that runs everywhere.

---

#### Found, and worth knowing

- **`sendEmail` cannot run under `tsx` at all.** It renders a react-email template through next-intl, and `use-intl`'s production build is ESM inside a package with no `"type": "module"` — so `tsx` takes the CJS loader and `createContext` comes back undefined. Not an app bug and not fixable from here; the render path runs under Next and under Vitest. The no-keys probe asserts the claim that actually matters instead: across the whole `email_log`, **0 rows `failed` and 82 `skipped`**. A missing key has never once been recorded as an outage.
- **`/ar/settings/system` with a fabricated cookie is 307 to sign-in, not 404** — it sits under `(app)`, whose layout runs `requireUser` before the admin-only filter, so an invalid cookie is simply "signed out" there. Correct behaviour, and it means the criterion *"a reviewer 404s on `/settings/system`"* is **not** covered by any script. It needs a reviewer session (thread 64).
- `/api/zones/geojson` with no `bbox` is a **400 with `invalid_bbox`**, by design. Two drafts of the sweep called it a failure before the route was read.
- `deleteFile` removes the file and leaves the directory — right for the app, litter for a probe. `no-keys.mts` clears its own folder.
- **`uploads/` and `.env` are both git-ignored**, confirmed with `git check-ignore`.

---

#### Integrity

- The `user` table holds **exactly two rows**: the user's own `admin` (2026-08-16, the first account ever created) and the `reviewer` (2026-08-21). **No probe account has ever occupied the first slot.**
- After every probe: **0** rows matching `probe-%` in `user`, `drone` or `email_log`; **0 orphaned `audit_event` rows**; 77 audit events, all resolving to live entities.

---

#### Not verified — and what each needs

- **The four-eyes rule in a browser**, and a **reviewer** 404ing on `/admin/zones`, `/admin/audit`, `/admin/reveals` and `/settings/system` while reaching `/admin/analytics`. Both need the user to sign in as `alshar55@hotmail.com`; the assistant may not enter a password. **Thread 64, still open, and it is now the only thing standing between F31 and a complete pass.**
- The six items F31 already names as un-runnable (real email delivery, Blob, the OG card as a third party sees it, a production QR, a printed 20 mm scan, Inngest production sync) — all recorded in `docs/VERIFICATION.md` with what each would need.
- **Thread 77 — the 120 m altitude claim — is untouched and is a product decision, not a bug.** It is written up at the foot of `docs/VERIFICATION.md` so F31c's "looks like theirs" critic meets it as a known open question rather than reporting it as a fresh finding.

---

#### Next session should know

- **F31b is the walkthrough**: all 14 steps by hand, in Arabic, on the production serve at 3001, plus the 375 px pass — which works **only** through a same-origin iframe (thread 44; `resize_window` reports success and leaves the viewport at 1440).
- **F31c is the four critics, dispatched in a single message** so they run at once, reading `docs/VERIFICATION.md` and F31b's capture rather than the app. Two rounds, then stop.
- The production server on 3001 was left running. Kill it by PID before the next `pnpm start`, and read `Ready in …` before trusting a result — `next start` on a held port fails silently and leaves the *old* process answering.

---

### Session 45c — Wave 8 · F30c The preview card, the vendored fonts and the structured data (**F30 complete**)

**Date:** 2026-08-23
**Status:** ⚠️ done with deviations. **F30 is complete. Only F31 — the verification gate — remains of the entire build.**

---

#### What exists

| File | What |
|---|---|
| `scripts/vendor-fonts.mts` · `pnpm vendor:fonts` | Copies four faces + the OFL licence into `assets/fonts/` |
| `assets/fonts/` | 4 × WOFF (Arabic + Latin, 400 + 600), committed, ~127 KB |
| `src/lib/site/og.ts` | The hex palette, `ogFonts()`, `riyadhZonePaths()` |
| `src/lib/site/og-card.tsx` | `OgCard` — the layout, shared by both routes |
| `src/app/[locale]/(public)/opengraph-image.tsx` | The root card |
| `src/app/[locale]/(public)/remote-id/opengraph-image.tsx` | The `/remote-id` variant |
| `src/lib/site/structured-data.ts` | `WebSite` + `Organization`, and what is deliberately absent |
| `src/app/[locale]/layout.tsx` | *(extended)* `openGraph` + `twitter` |
| `src/app/[locale]/(public)/page.tsx` | *(extended)* the JSON-LD script |
| `src/lib/site/fonts.test.ts` | 9 tests — staleness, format, licence |

---

#### The font is the whole feature

`ImageResponse` is **satori**: no browser, no cascade, no font stack, no
stylesheet. It draws only the fonts handed to it as bytes, and a glyph it has no
font for becomes an empty box. The card's headline is Arabic, so getting this
wrong does not degrade the card — it produces a rectangle of tofu on the one
image every shared link displays.

**`next/font/google` cannot supply them**, on two independent grounds: it writes
the faces into `.next/static/media` under content-hashed names that nothing can
map back to a face, and it stores **WOFF2**, which satori does not read.

So `pnpm vendor:fonts` copies four files out of
`@fontsource/ibm-plex-sans-arabic` — the Arabic subset and the Latin one, at 400
and 600, because satori resolves a glyph across every font it is given and
Fontsource ships one file per subset. They are **committed**, so a fresh clone
that runs `next build` still has them, and `fonts.test.ts` fails when they drift
from the installed package. That guard was **proved to fail** by appending five
bytes to one file before it was kept.

**WOFF, not WOFF2** — Fontsource ships both side by side under names differing
by one character, and picking the wrong one fails at *render* time with no type
error and no build failure. A test reads the four-byte `wOFF` signature.

The licence travels with them: IBM Plex is SIL OFL 1.1, which permits
redistribution and requires it. A third test asserts the file is there.

**Not in `public/`** — nothing in a browser ever requests these bytes. That is
what makes them different from the map's worker assets, which live in
`public/vendor/` precisely because they must be reachable over HTTP.

#### satori spaces Arabic unevenly, and two obvious fixes did nothing

The first card rendered with gaps two and three times a normal space, mid
sentence. The English card, drawn by the same code, was clean — so it is the RTL
path specifically. Tried and rejected, each verified by looking at the PNG:

1. **Pre-breaking the lines** so there is no slack to distribute — unchanged.
2. **Removing `display: flex` from the line boxes** — **byte-identical PNG**.

What worked: **the spaces are not satori's to draw.** Each word is a flex item
and the space between them is an explicit `gap`, uniform by construction, with
`row-reverse` putting the first word rightmost. **Shaping survives because
Arabic letters do not join across a space** — a word is an independent shaping
run, so laying words out separately changes where they sit, not how they are
drawn. Confirmed by reading the rendered Arabic in three cards.

The cost: line breaks are counted in words rather than measured, so `perLine`
differs per locale. Safe only because both strings come from the message
catalogue.

#### The card said "Ajniha Ajniha"

`common.appName` is already "Ajniha" in English, and the card rendered the Latin
form beside it unconditionally. The Arabic card was right — `أجنحة Ajniha` — and
the English one printed the word twice. **Found by looking at the PNG.** Nothing
else would ever have said so: it type-checked, it built, it was a valid image of
the correct dimensions.

#### The map is the real geometry

`RIYADH_ZONES` from the seed module, projected through the same pure
`projectionFor` / `pathFor` the landing page and `/zones` use, with
`fillRule="evenodd"` so KKIA's ring is a hole rather than a disc.

**Read from the seed, not the database**, deliberately: the card is generated at
build time and making the one image every shared link displays depend on a live
query is how a deploy with a briefly unreachable database ships a blank card.
The seed module is what the database is filled *from*, so the picture cannot
disagree with the rows.

**`ZONE_FILL` could not be used** — it holds `var(--zone-permitted)`, and satori
parses neither the custom property nor `oklch()`. This is open thread 65 in a
third costume. The palette is therefore literal hex in `og.ts`, each value
carrying the token it came from, converted with the OKLab→sRGB transform and
**checked against known values** (`oklch(1 0 0)` → `#ffffff`, `oklch(0.628
0.2577 29.23)` → `#ff0000`) rather than trusted.

#### Structured data, and the four words that matter

`Organization` names **أجنحة / Ajniha** and never GACA. Fabricated credibility in
visible copy is at least legible to the reader; in structured data it is
consumed by aggregators and assistants that repeat it as fact without showing
anyone the sentence they got it from — and here it would be a machine-readable
claim about a **safety regulator**.

`FAQPage` was **considered and rejected**: `/docs/remote-id`'s eight headings are
topics, not questions. Reshaping prose into questions to earn a rich result is
the same fabrication with extra steps.

Absent, each with its reason written down: `logo` and `image` (no logo exists),
`sameAs` (no profiles — pointing it at nothing is worse than silence), `address`
/ `legalName` / `foundingDate` (a proposal is not a company), `contactPoint` (a
real person's address; published on the legal pages because a data-subject
request must reach somebody, but feeding it to scrapers is a different act), and
every one of `AggregateRating` / `Review` / `Offer`.

`<` is escaped in the JSON, because a `</script>` inside a string would end the
element early — nothing here is user-supplied *today*, which is exactly the
condition that changes without anyone revisiting the escaping.

---

#### Deviated from spec

| What | Why |
|---|---|
| `src/app/[locale]/(public)/opengraph-image.tsx`, not `src/app/opengraph-image.tsx` | There is no `src/app/layout.tsx`; the locale is a root param. Under `[locale]` each language gets its own card; under `(public)` it attaches to public pages and not the signed-in app. |
| **No docs-index variant** | It would differ from the root card only in a headline that already reads "الدليل". A second file drawing the same wordmark is how two cards drift. `/remote-id` got one because it is the link actually shared in a conversation about the concept. |
| `@fontsource/ibm-plex-sans-arabic` added as a **devDependency** | It is a source to copy from, not a runtime import. Vendoring means production never needs the package. |
| No `FAQPage` | The content is not Q&A. See above. |
| The OG image is **not named** in `openGraph.images` | `opengraph-image.tsx` supplies `og:image`, its type and its dimensions by file convention. A hand-written URL beside it would be a second source of truth for one tag, and the stale one would be the hand-written one. |

---

#### Verified — against a production serve on :3001, signed out

| Check | Result |
|---|---|
| `pnpm test` | **1114 passed, 67 files** (9 new) |
| `pnpm exec tsc --noEmit` · `pnpm lint` · `i18n:check` | clean; 2127 keys in sync |
| `pnpm build` | compiled; both `opengraph-image` routes registered |
| `/ar` and `/en` cards | **200, `image/png`, ~67–70 KB each** |
| **Arabic on the card** | **correctly shaped, joined and in reading order** — read off the rendered PNG, three times across three attempts. Not boxes, not reversed |
| The wordmark | `أجنحة Ajniha` on the Arabic card, `Ajniha` once on the English one |
| The map on the card | all 12 seeded zones, KKIA's ring drawn as a hole |
| `/remote-id` variant | its own route, its own headline, **200, 65 KB** |
| `/zones` | inherits the root card, as intended |
| Twitter card | `summary_large_image`, with title and description |
| `og:image:width/height/type/alt` | present, 1200 × 630, `image/png` |
| JSON-LD | **parses**, `WebSite` + `Organization`, `inLanguage` correct per locale |
| **GACA in structured data** | **zero occurrences**, checked for `gaca`, `general authority`, `هيئة`, `الطيران المدني` |
| Banned types | no `AggregateRating`, `Review`, `Offer`, `logo`, `sameAs`, `address`, `contactPoint` |
| `FAQPage` | **0 occurrences** on `/docs/remote-id`, `/docs`, `/remote-id` |
| Font guard | **proved to fail** — five bytes appended to one face, test named the file and the fix |
| Font format | all four carry the `wOFF` signature, not `wOF2` |

#### Not verified

- **No link-preview validator has seen the card.** There is no public domain, so
  every URL is `localhost:3001`. The image renders and its tags are correct; how
  WhatsApp, iMessage or Slack crop and letterbox it is unseen. **Known
  un-runnable** until a domain exists.
- **The card has never been rendered on a machine without `.git` or without
  `node_modules`.** Both would matter on a first deploy — the fonts are
  committed precisely so the second does not, but that has not been proved by
  deleting them.
- **satori's Arabic spacing is improved, not solved.** It is even now because we
  place the words; a longer string, a different weight, or a font change could
  reopen it, and only looking at the PNG would say so.
- **375 px** — nine sessions.

#### Next session should know

- **F30 is complete. F31 is the entire remainder of the build.**
- F31's gate must run against **`next start`, never `next dev`** — a dev 404
  embeds a stack trace naming the guard and a production one does not (thread
  16).
- **375 px works only through a same-origin iframe** — `resize_window` reports
  success and leaves the viewport at 1440. Thread 44 has the technique.
- Two blockers only the user can clear: **a second reviewer signing in** for the
  four-eyes rule over HTTP (thread 64), and the **120 m altitude claim** the app
  states as fact and no fetched GACA document supports (thread 77).
- The **`pnpm vendor:fonts` / `pnpm vendor:map`** pair both have staleness tests.
  Re-run each after bumping its dependency.

---

### Session 45b — Wave 8 · F30b Per-page titles, canonicals and `hreflang`

**Date:** 2026-08-23
**Status:** ⚠️ done with deviations. **F30c — the preview card and the structured data — is what remains of F30.**

---

#### What exists

| File | What |
|---|---|
| `src/lib/site/metadata.ts` | `publicPageMetadata`, `alternatesFor`, `privatePageTitle`, `PRIVATE_ROBOTS` |
| `src/lib/site/resolve.ts` | *(extended)* `resolvePage(path, locale)` — one page, same resolver as the sitemap |
| 8 public route files | `generateMetadata` calling `publicPageMetadata` with their own path |
| 39 private route files | `generateMetadata` calling `privatePageTitle` with a catalogue key |
| 3 route-group layouts | `export const metadata = { robots: PRIVATE_ROBOTS }` |
| `src/components/legal/legal-page.tsx` | `legalMetadata` routes through `publicPageMetadata` |
| `src/lib/site/site.test.ts` | *(extended)* the private-title source scan |

---

#### Every public page passes only its own path

`publicPageMetadata("/zones", locale)` — and title, description, canonical and
the `hreflang` set are decided in one place. **A canonical is a machine-readable
claim about which URL is the real one**, so getting it wrong on one page tells a
search engine to drop that page in favour of another; fourteen hand-written
`alternates` blocks would be fourteen chances to write `/ar/zones` into the
English page's head.

The copy comes from the **same resolver the sitemap and `llms.txt` use**, so a
page's description in a search result is the same sentence `llms.txt` hands an
assistant. `legalMetadata` was rewritten to go through it too — it had been
loading the `.mdx` a second time to read two fields.

An unknown path **throws at build**. A public page that is titled but missing
from `PUBLIC_PAGES` would be titled and unfindable, which is the failure this
feature exists to end.

#### `noindex` is set once per route group, not once per page

`(app)`, `(admin)` and `(public)/(auth)` each export `robots: PRIVATE_ROBOTS`
from their layout; metadata merges field by field, so a page setting only its
own `title` keeps it. **Thirty-nine pages each repeating a `robots` block is
thirty-nine places for one to go missing**, and the one that went missing would
be indexed with every check green.

`/[locale]/dev/emails` already carried its own — left alone.

#### Thirty-nine tabs that all said the same thing

Every signed-in page inherited `title.default`, so a reviewer with the queue, a
drone and the audit browser open saw the same twenty-nine Arabic characters
three times. Nothing was *broken*. It was unusable, and no check anywhere would
ever have said so.

Each page now names a **dotted catalogue path** — the same string it already
renders as its own heading, so the tab and the `<h1>` cannot drift. The mapping
was validated against **both** catalogues before a single file was edited, and
the same pass refused to run unless every private `page.tsx` was covered: 39
routes found, 39 mapped.

**A detail page takes its section's title, not the record's.** `/drones/[id]` is
titled "طائراتي", not the drone's nickname — resolving the nickname would mean
running the ownership-checked query a second time inside `generateMetadata` on
every detail page in the app. The `<h1>` shows the nickname; the tab shows where
you are.

#### Two collisions the fetch found and no test could

- **`دليل أجنحة · أجنحة`** — the docs index stuttered, because its title already
  contained the app name the template appends. Renamed to `الدليل` /
  `Documentation`.
- **`/remote-id` and `/docs/remote-id` had the same tab title.** The concept page
  is now `الهوية عن بُعد: القاعدة ومصادرها` / `Remote ID: the rule and its
  sources`, which is also what it is — the page with the citations. The docs
  page keeps its `.mdx` title, which is its `<h1>` and its sidebar label too.

Neither is reachable by a unit test: half the titles live in `.mdx` modules that
only a bundler can load. **Uniqueness is verified by fetching all 26 pages**, and
that is a manual pass with nothing automated behind it — thread 11 again.

---

#### Deviated from spec

| What | Why |
|---|---|
| `generateMetadata` sits at the **end** of each public route file | The scripted insert put it between the page's doc comment and its component, orphaning the comment. Moved to match the convention `privacy/page.tsx` already set. |
| Private pages get a title but **no description** | A description is what a search result shows, and these pages are `noindex`. Writing 39 descriptions nothing will ever display is the empty-Billing-tab failure in metadata form. |
| The private-title guard is a **source scan**, not a table | A table in the test would be a second copy of the mapping, and a page could be added without appearing in it. The files are the mapping. Three other tests in this suite already scan `src/`. |

---

#### Verified — against a production serve on :3001, signed out

| Check | Result |
|---|---|
| `pnpm test` | **1105 passed, 66 files** |
| `pnpm exec tsc --noEmit` · `pnpm lint` · `i18n:check` | clean; 2126 keys in sync |
| `pnpm build` | compiled, 85 static pages |
| All 26 public pages | **26/26 have their own title, description, canonical and 3 `hreflang` links** |
| Canonical | **26/26 equal the URL fetched** — checked by string comparison, not by eye |
| `x-default` | **26/26 point at the Arabic URL** for that page |
| Title uniqueness | **0 duplicates in `ar`, 0 in `en`** — after fixing the two above |
| Public pages | carry **no** `robots` meta, so they stay indexable |
| The 5 auth pages | own title **and** `noindex, nofollow` |
| 10 private routes sampled | **307 to sign-in** signed out; the sign-in page they land on is itself `noindex` |
| Sitemap / `llms.txt` | still 26 entries and 26 links, still **0** `/rid` occurrences, and both show the corrected titles |
| The private-title guard | **proved to fail**: one key was corrupted, the test named the file and both locales, then it was restored |

#### Not verified

- **No signed-in tab has been read in a browser.** Every private route 307s to
  sign-in and the assistant may not sign in, so the 39 titles are proved to
  *resolve* — by the pre-flight check, by the build, and by the standing source
  scan — but not to *render*. Whether `review.tabBookings` is the right choice
  for `/admin/bookings/[id]` is a judgement nobody has looked at on screen.
- **Title uniqueness has no test**, only the 26-page fetch. Half the titles come
  from `.mdx` modules a unit test cannot load.
- **`hreflang` is served as `hrefLang`.** Next emits the attribute camel-cased.
  HTML attribute names are ASCII case-insensitive so crawlers read it correctly,
  and this cost ten minutes to a case-sensitive `grep` that reported zero
  alternates on a page that had three. Worth knowing before anyone "fixes" it.
- **375 px** — nine sessions.

#### Next session should know

- **F30c is all that is left of F30**: `src/app/opengraph-image.tsx`, a
  `/remote-id` variant, Twitter card metadata, and `WebSite` + `Organization`
  JSON-LD on the landing page.
- `ImageResponse` renders in a **satori** runtime that knows no Tailwind and no
  CSS variables — read the values out of `globals.css` and write them literally.
  **Arabic needs the font buffer passed explicitly** or it renders boxes.
- **`Organization` must not name, imply or claim affiliation with GACA.**
  `ORGANISATION_NAME` in `src/lib/legal/fields.ts` is the project's own name and
  there is deliberately no legal entity behind it.
- `FAQPage` goes on `/docs/remote-id` **only if** that page genuinely is
  questions and answers. Read it before deciding; omit it otherwise.
- Adding `openGraph`/`twitter` to the layout is enough — Next attaches a
  generated `opengraph-image` to both by file convention.

---

### Session 45 — Wave 8 · F30a The discoverability spine: one page list, the sitemap, robots and `llms.txt`

**Date:** 2026-08-23
**Status:** ⚠️ done with deviations. **F30 split a/b/c, agreed with the user up front.** F30b is the per-page titles; F30c is the preview card and the structured data.

---

#### What exists

| File | What |
|---|---|
| `src/lib/site/pages.ts` | **Pure.** `PUBLIC_PAGES` — 13 pages, derived from `DOC_SLUGS` and `LEGAL_SLUGS`; `PRIVATE_SEGMENTS`; `disallowedPaths()`; `localePath()` |
| `src/lib/site/crawlers.ts` | **Pure.** Fourteen AI-crawler tokens in three groups, each with the URL it was read from |
| `src/lib/site/last-modified.ts` | `server-only`. Git committer date, mtime fallback — F26's implementation, lifted |
| `src/lib/site/resolve.ts` | `server-only`. `listPublicPages(locale)` — title, description, `lastModified` |
| `src/lib/site/site.test.ts` | 22 tests |
| `src/app/sitemap.ts` | 26 entries, both locales, `x-default` → `ar` |
| `src/app/robots.ts` | *(rewritten)* four groups, one generated disallow list |
| `src/app/llms.txt/route.ts` | Arabic section then English, 26 links |
| `src/app/[locale]/layout.tsx` | *(extended)* `metadataBase`, `title.template`, `title.default` |
| `src/lib/url.ts` | *(extended)* the loud `APP_URL` warning |
| `src/lib/docs/updated.ts` | *(rewritten)* delegates; keeps `docLastUpdated`, adds `docSourcePath` |
| `messages/{ar,en}.json` | `meta` rewritten — `pages.*`, `titlePattern`, `llms*` |

---

#### Two live `robots.txt` bugs, both of which had matched nothing since F11

**`Disallow: /dashboard` and `Disallow: /admin` were doing nothing at all.**
Routing is `localePrefix: "always"`, so there is no `/dashboard` — the route is
`/ar/dashboard`. A `Disallow:` is a **prefix match**, and `/ar/dashboard` does
not start with `/dashboard`. Only `/*/rid/` had been written with the wildcard,
and only `/*/rid/` worked. Four waves of admin and pilot surfaces have been
crawlable to anything that reads the file.

**A trailing slash is the same trap wearing a different hat.**
`Disallow: /ar/settings/` covers `/ar/settings/profile` and leaves
`/ar/settings` — a real page — crawlable. Every rule is now emitted without one.

`disallowedPaths()` generates both forms for every segment: `/*/<seg>` and, from
`LOCALES`, `/ar/<seg>` and `/en/<seg>`. The wildcard is RFC 9309 and every major
crawler honours it; the explicit pair means the segment whose exposure would be
a **browsable national drone registry** does not rest on that.

Nine segments are private now, not two: `rid`, `dashboard`, `drones`,
`bookings`, `notifications`, `settings`, `profile`, `admin`, and `dev` — the
last because `/{locale}/dev/emails` renders every transactional template.

#### The most dangerous thing in the file is that a robot obeys exactly one group

RFC 9309: a crawler picks the **most specific** `User-agent` group that matches
it and ignores every other group, `*` included. So a named group with a shorter
`Disallow` list does not *add* a restriction — it **removes** the ones in `*`.
Naming `GPTBot` in order to state a policy about it, and forgetting one line,
would hand `GPTBot` the scan endpoint the anonymous group is refused.

Every group is therefore built from the same `disallowedPaths()` and differs in
nothing but its `User-agent` line. `site.test.ts` asserts the four lists are
equal, and separately that `/*/rid`, `/ar/rid` and `/en/rid` are in every one of
them.

#### The crawler tokens the spec said Wave 0 had researched

**Wave 0 had not.** F01 researched package versions; there is no crawler row in
this file and never was one. Fourteen tokens were fetched from each operator's
own documentation on 2026-08-23 and recorded with their sources — see the new
section beside the pinned versions.

Two of them are **not crawlers**: `Google-Extended` and `Applebot-Extended`
fetch nothing and govern what the operator's real crawler may do with pages it
already holds. One does not fit the three-way split at all: Meta documents
`meta-externalagent` as serving training *and* direct indexing. Both are written
into `crawlers.ts` rather than smoothed over, because a reader who assumes
otherwise concludes the file blocks a fetch that still happens.

`facebookexternalhit` is deliberately **not** named — it is the link-preview
fetcher that renders the card when an Ajniha link is pasted into WhatsApp, which
is the surface this pitch is actually shared in. A test asserts it stays
unnamed.

#### `lastModified` is a real date or no date

The four concept pages date from the committer date of their own `page.tsx`; the
six documentation pages from their `.mdx`, per locale, because the two languages
are edited independently; the two legal pages from `EFFECTIVE_DATE`, which F27
set by hand on the argument that a policy's date is a claim about the *policy*
and a typo fix in the Arabic must not announce a new privacy policy to everyone.

Six distinct dates across 26 entries, spanning 18–22 August. `new Date()` would
have produced one, and a sitemap where everything changed today tells a crawler
exactly as much as omitting the field. A page whose date cannot be established
gets **no** `<lastmod>` rather than a fabricated one.

F26's `docLastUpdated` implementation moved to `src/lib/site/last-modified.ts`
so the sitemap and the docs page cannot disagree about when a page changed.

#### A missing message key is text, not an error

`llms.txt` served the literal string **`meta.description`** as the one-line
description of this app. F30a had deleted that key and the route still read it;
next-intl throws `MISSING_MESSAGE` to server stderr and renders the key path
into the response body. `typecheck`, `lint`, `i18n:check` and 1100 tests were
green.

**`i18n:check` is structurally blind to it** — it compares the two catalogues
with each other, and a key deleted from *both* leaves them perfectly in sync.
Found by fetching the file, which is thread 11 for the sixth time. `site.test.ts`
now names every `meta.*` key the spine reads; the guard was **proved to fail**
by adding a key that does not exist and watching both locales go red. Open
thread 78: the same hole exists in every other namespace.

`meta.keywords` was deleted outright in the same pass. Nothing read it, and a
`<meta name="keywords">` list is the keyword-stuffing the honesty rule bans.

---

#### Deviated from spec

| What | Why |
|---|---|
| `src/lib/site/` (four files), not `src/lib/public-pages.ts` | The list must be readable by a unit test *and* resolvable against `.mdx`, the catalogue and the filesystem. That is the split `slugs.ts` / `updated.ts` already made in F26, for the same reason. |
| Metadata went in `src/app/[locale]/layout.tsx` | **There is no `src/app/layout.tsx`.** The locale is a root param — that is how `next/root-params` reaches `i18n/request.ts`. |
| `Disallow: /*/rid`, not the criterion's literal `/*/rid/` | The trailing slash weakens it. `/*/rid` is strictly broader and covers everything the slashed form would. |
| The crawler tokens were researched in this session | Wave 0 never researched them. Recorded with sources and a date rather than claimed. |
| The footer still keeps its own three links | `/docs`, `/privacy`, `/terms` is a navigational choice, not the public surface. Feeding it 13 links would be a worse footer. |
| `APP_URL` unset **warns**, it does not fail the build | The criterion allows either. `pnpm build` runs migrations and compiles the app; a developer with no `.env` should get a working local build and a sentence, not a failure in a step unrelated to the URL. The health check on `/settings/system` already reports it `down`, and F29 verified that by breaking it. |

---

#### Verified — against a production serve on :3001, signed out

| Check | Result |
|---|---|
| `pnpm test` | **1104 passed, 66 files** (22 new) |
| `pnpm exec tsc --noEmit` · `pnpm lint` | clean; `i18n:check` — 2126 keys in sync |
| `pnpm build` | compiled; `/robots.txt` and `/sitemap.xml` prerendered static, `/llms.txt` dynamic |
| `/robots.txt`, `/sitemap.xml`, `/llms.txt` | **200 each**, `text/plain`, `application/xml`, `text/plain; charset=utf-8` — **closes open thread 5**, they are real routes and the `[locale]` catch-all does not swallow them |
| Sitemap | **well-formed XML**, parsed with a real parser — 26 `<url>`, 13 pages × 2 locales |
| Alternates | **26/26 entries carry exactly 3** — `x-default`, `ar`, `en` |
| Every sitemap URL | **26/26 fetched cold, all 200** signed out |
| `rid` in the sitemap | **0 occurrences.** So are `dashboard`, `settings`, `admin`, `drones`, `bookings`, `notifications`, `sign-in`, `profile`, `dev` |
| `rid` in `llms.txt` | **0 occurrences**, same list checked |
| `<lastmod>` | six distinct dates, 18–22 August. Legal pages = `EFFECTIVE_DATE` to the second |
| `/ar/rid/AJN-7Q4M-31KD` | `<meta name="robots" content="noindex, nofollow"/>` — and on an **invalid** code too, so the directive does not depend on resolution succeeding |
| `robots.txt` groups | four; **all four disallow lists identical**, 28 lines each; `Sitemap:` and `Host:` from `APP_URL` |
| Title template | `/ar/privacy` → `سياسة الخصوصية · أجنحة`; `/en/terms` → `Terms of use · Ajniha`; the scan page → `التحقق من طائرة · أجنحة` |
| No default title | **No page anywhere reads "Create Next App"** |
| `APP_URL` unset | the warning fires — proved by importing `@/lib/url` under `tsx`, which does not load `.env` |
| The `meta.*` guard | proved to fail: a key that does not exist reddens both locales |

#### Not verified

- **Six public pages still share the landing page's title** — `/zones`, `/docs`, `/how-it-works`, `/remote-id` and the six docs pages fall back to `title.default`. That is **F30b's whole job**, not a defect here, but until it runs the criterion "every public page has a unique title" is unmet.
- **Canonical URLs and `hreflang` in page `<head>`.** They are in the sitemap; the `<link rel="canonical">` and `alternates` per page are F30b.
- **No link-preview validator has seen any of this** — there is no public domain, so every URL in the sitemap and `llms.txt` says `localhost:3001`. Known un-runnable.
- **The git-date fallback outside a checkout.** `last-modified.ts` returns `null` when both `git log` and `stat` fail, and this build has only ever run inside its own checkout. In practice the sitemap is prerendered at build time, where the checkout exists.
- **375 px** — nine sessions.

#### Next session should know

- **F30b is the per-page titles.** `meta.pages.<key>.title` / `.description` already exist for `/`, `/how-it-works`, `/remote-id`, `/zones` and `/docs`; docs and legal pages take theirs from their own `.mdx` `meta`. `listPublicPages(locale)` returns exactly what a `generateMetadata` needs.
- **The landing page needs `title: { absolute: … }`**, or it renders as `أجنحة — … · أجنحة`.
- **Auth pages need `robots: { index: false, follow: false }`** — `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`. Two of them are SSG, so the directive is baked at build time; that is fine for a constant.
- **Do not write a `<link rel="canonical">` by hand.** `metadataBase` is set, so `alternates.canonical` takes a relative path and Next makes it absolute.
- **F30c is the preview card**: `opengraph-image.tsx` renders in a satori runtime that knows no Tailwind and no CSS variables, and **Arabic needs the font buffer passed explicitly** or it emits boxes. Read the values out of `globals.css` literally.
- **`Organization` must not name, imply or claim affiliation with GACA.** `ORGANISATION_NAME` in `src/lib/legal/fields.ts` is the project's own name and there is deliberately no legal entity behind it.
- After F30, only **F31** remains.

---

### Session 44 — Wave 8 · F29c The email log and the activity slice (**F29 complete, with two controls unbuilt**)

**Date:** 2026-08-22
**Status:** ⚠️ done with deviations. **F29 is complete except Cancel and Re-run, deferred in F29b with reasons.** Next is F30.

---

#### What exists

| File | What |
|---|---|
| `src/lib/ops/email-log.ts` | `listEmailLog`, `listEmailTemplates`, the status vocabulary |
| `src/components/ops/email-log.tsx` | The rows, with the provider's error in full |
| `src/components/ops/email-filters.tsx` | Status + template, a plain GET form |
| `src/components/ops/activity-log.tsx` | The newest 25 audit events, and the way through to F25b |
| `src/app/[locale]/(app)/settings/system/page.tsx` | *(extended)* both sections |

---

#### "Not sent" is not "failed", and it is styled that way

`sendEmail` writes four statuses, and the pair that matters is `skipped` versus
`failed`: the first means only that no `RESEND_API_KEY` was configured, so the
message printed to the terminal. **Conflating them sends an operator to debug a
delivery failure that never happened** — and on this machine every one of the 82
real rows is `skipped`, so getting it wrong would have made the whole panel
look like an outage.

They are **styled** apart, not merely labelled apart, and that was measured
rather than asserted: `failed` computes to `lab(48.4 77.4 61.5)` — red — and
`skipped` to `lab(46.0 -1.5 -5.0)` — muted grey. Only `failed` is destructive.

#### One log, not two

The activity slice calls **`listAuditEvents`, F25b's own reader**, with a limit
of 25 and no filters. There is no second query and no second table, which is
F14's rule made structural rather than promised. The panel is the newest events
plus a link to the browser: an operator on the system page wants *"what has been
happening"*, not a query builder.

The action labels come from F25b's table, keyed the same way, with a fallback to
the raw code — so an action added by a future feature renders as its code rather
than as a blank.

#### The filters live in the URL

A plain `method="get"` form, no client component and no JavaScript. Filters in
the URL mean an operator can send somebody *"look at this"* and have them see
the same rows; a `<select onChange>` router push gives the same list and a link
that means nothing when pasted. An unrecognised `status` falls back to showing
everything rather than to an empty page — `isEmailStatus` narrows it.

---

#### Deviated from spec

| What | Why |
|---|---|
| No **resend** action | F29's Files list names `resendEmail`. With no `RESEND_API_KEY` there is nothing to resend *through* — the button would refuse every time it was pressed, on a page whose entire job is to explain why things do not work. It belongs in the session that first has a working key. |
| The notification link goes to `/notifications`, not to one notification | There is no per-notification route — F15 built a list, not detail pages. Linking to a URL that does not exist would be worse than linking to the list that does. |
| Activity rows are not filterable here | That is F25b's browser, one click away. Two filter UIs over one table is how they start to disagree. |

---

#### Verified

| Check | Result |
|---|---|
| `pnpm test` | **1082 passed, 65 files** |
| `pnpm exec tsc --noEmit` · `pnpm lint` | clean; `i18n:check` — 2116 keys in sync |
| `pnpm build` | compiled |
| Email panel | **50 rows** from 82 real sends |
| `skipped` vs `failed` | **measurably distinct colours**, and the failed row carries the provider's message in a scrolling `<pre>` |
| A failed send | inserted synthetically (all 82 real rows are `skipped`), rendered, **then deleted — 0 `failed` rows remain** |
| Filtering | `?status=failed` → 3 skipped strings on the page; `?status=skipped` → 103. An unrecognised status falls back to everything |
| Activity slice | **25 rows** from the same reader F25b uses, with actor, action label and Riyadh timestamp |
| Link to the audit browser | present |
| Sections on the page | five — health, jobs, email, activity, counts. **No agent-activity section** |
| Three `probe%` addresses left in `email_log` | **pre-existing**, from the F18b and F24 probes on 18–20 August. Not mine, left alone |

#### Not verified

- **A real failed or sent email.** Every one of the 82 is `skipped`, because `RESEND_API_KEY` has never been set. The failure rendering was proved with a synthetic row, which exercises the template but not `sendEmail`'s error path.
- **The full loop the criteria describe** — approve a drone with a broken mail config and trace audit → notification → failed email. The three halves each render; the walk has not been done end to end, and it needs a key that fails rather than no key at all.
- **375 px** — eight sessions.
- **Cancel and Re-run** — still unbuilt, see Session 43.

#### Next session should know

- **F30 is SEO & discoverability, and it is the last build feature.** It writes the sitemap from one list of public pages, and F26's docs and F27's legal pages both added to that list — which is exactly why the plan put it after them.
- `robots.txt` already exists and **must keep disallowing `/*/rid/`**: indexing the Remote ID scan page turns it into a browsable national drone registry.
- The public surface is now: landing, how-it-works, remote-id, zones, docs (6 pages), privacy, terms. `LEGAL_SLUGS` and `DOC_SLUGS` are the two lists to read rather than hand-copy.
- After F30, only **F31** remains — the gate, and the two rounds of fresh-eyes critics.

---

### Session 43 — Wave 8 · F29b Background jobs, the schedule, and two controls that were not built

**Date:** 2026-08-22
**Status:** ⚠️ done with deviations. **Cancel and Re-run are NOT built — see below.** F29c is the email and activity logs.

---

#### What exists

| File | What |
|---|---|
| `src/lib/ops/jobs.ts` | `listJobRuns`, `listScheduledFunctions`, `getJobRun` |
| `src/lib/ops/cron.ts` | `nextCronRun` — pure |
| `src/lib/ops/cron.test.ts` | 6 tests, half of them refusals |
| `src/components/ops/jobs-panel.tsx` | The schedule table and the run list |
| `src/app/[locale]/(app)/settings/system/page.tsx` | *(extended)* the jobs section |

---

#### Cancel and Re-run were not built, and the reason is not "no time"

F29 asks for both. **Neither is implementable from what this app has, and the honest answer was to build neither rather than something that looks like them.**

**Cancel.** The installed Inngest SDK exposes no cancellation method — grepped for one; `api.d.ts` has `/v1/runs/{id}/metadata` and nothing to cancel with. Cancelling means calling Inngest's REST API at an endpoint I would be **guessing**, with a signing key this machine does not have. The alternative — writing `cancelling` into our own `job` row without telling Inngest — is worse than not shipping it: the run carries on, and the app's own record says somebody stopped it. That is a lie in the one table F08 built to be trustworthy.

**Re-run.** `job` stores `trigger_event` as a *name* and not a payload. Re-running an event-triggered function would mean sending that event with no data, which is not the same run and would misfire. The column that would make it work — the original event payload — does not exist.

**What each needs**, so the next session does not rediscover it:
- Cancel: `INNGEST_SIGNING_KEY`, and the cancellation endpoint confirmed from Inngest's own docs rather than inferred.
- Re-run: either a payload column on `job`, or Inngest's REST API to replay a run by id.

The `cancelling` enum value stays. It is correct, F08's comment explaining why is correct, and `run-cancelled.ts` already records a cancellation that happens **from Inngest's side** — a run cancelled in the Inngest dashboard is already mirrored into our table today.

---

#### The schedule is answerable in one glance, which was the point

`CRON_SCHEDULES` was exported as data by F08 *"because F29's system page lists cron, timezone, last run, next due"* — so the panel reads six entries rather than importing the Inngest graph into a page render.

**"Next due" needed real arithmetic**, and `nextCronRun` is deliberately **not a general cron parser**. It understands the shapes `CRON_SCHEDULES` contains — a literal minute, a literal hour, `*`, and a step form — over `* * *` for day, month and weekday. Anything else returns `null` and the cell reads *"not shown"*.

**That refusal is the feature.** A parser that quietly mishandles `0 3 * * 1` prints a confident wrong answer to the one question this panel exists for, and nobody re-checks a time the page stated. Three of the six tests are refusal cases, and one asserts that *every* expression in `CRON_SCHEDULES` is understood — so adding a weekday schedule fails here rather than showing a blank in production.

Riyadh being a fixed +3 with no DST is what makes it tractable without a timezone library; `RIYADH_OFFSET_MINUTES` is the one home for that fact.

---

#### Deviated from spec

| What | Why |
|---|---|
| **No Cancel, no Re-run** | Above. |
| The error is a scrolling `<pre>`, not a truncated cell | Truncating is how "an error occurred" happens. It scrolls **inside its own box** — a stack trace is the widest thing on the page, and under RTL a page that scrolls sideways hides the start of every line. |
| `lastStatus`, not `status`, on an internal Map | ESLint rule 11 bans a `status:` property outside `src/lib/workflow/` and cannot tell a read from a write. This module must **stay** banned from writing one, so the field was named for what it holds rather than the rule relaxed. |

---

#### Verified

| Check | Result |
|---|---|
| `pnpm test` | **1082 passed, 65 files** (6 new) |
| `pnpm exec tsc --noEmit` · `pnpm lint` | clean; `i18n:check` — 2094 keys in sync |
| `pnpm build` | compiled |
| Six scheduled functions | cron **with its `TZ=Asia/Riyadh` prefix**, last run, next due |
| Next-due arithmetic, against the clock at 22:52 Riyadh | `0 3 * * *` → 23 Aug 03:00 · `15 3 * * *` → 03:15 · `*/15 * * * *` → 23:00. **Correct in Riyadh time, not UTC** |
| Run list | **50 rows** from 390 real runs across 8 functions |
| A failed run | inserted synthetically, since all 390 real runs completed: status **فشل**, duration `61,234 ms` (Latin digits), and the **whole 270-character error** in a `<pre>` with `overflow: auto`. **Row deleted afterwards; 0 probe rows remain** |
| Tables at 1024 px | fit, no overflow |
| At 343 px | the table is wider than its box and **the box scrolls** — the page does not |
| `pageScrollsSideways`, Arabic RTL | **false** |

#### Not verified

- **Cancel and Re-run** — not built.
- **A real failed run.** All 390 in the table completed; the failure rendering was proved with a synthetic row, which exercises the template but not the middleware that would write a real one.
- **`cancelling` and `cancelled` rendering** — no run has ever held either status here.
- **375 px** — seven sessions. The 343 px column probe covers content overflow, not the media queries.

#### Next session should know

- **F29c is the email log and the activity log**, and both have their data already: `email_log` (recipient, template, locale, status, provider id, error, `sent_at`) and `audit_event`. F25b's audit browser is the full-power view — this is the operational slice with a link through to it.
- **A skipped email must look different from a failed one.** `email_log.status` distinguishes them; conflating "no API key" with "broken" sends an operator debugging a problem that does not exist.
- F15's `emailLogId` on the notification is what closes the loop the criteria ask for: decision → notification → email → reason.
- Cancel/Re-run: see the table above for exactly what each needs before it can be built honestly.

---

### Session 42 — Wave 8 · F29a The system page: health, configuration and row counts

**Date:** 2026-08-22
**Status:** ⚠️ done with deviations. **F29b is background jobs; F29c the email and activity logs.**

---

#### What exists

| File | What |
|---|---|
| `src/app/[locale]/(app)/settings/system/page.tsx` | `/settings/system` — admin only |
| `src/lib/ops/health.ts` | The nine checks |
| `src/lib/ops/origin.ts` | `sameOrigin` — pure |
| `src/lib/ops/counts.ts` | Row counts, projected over the enums |
| `src/lib/ops/health.test.ts` | 7 tests, incl. the no-secrets-in-source assertions |
| `src/lib/actions/ops.ts` | `regenerateAllQrAction` |
| `src/components/ops/{health-grid,data-counts,regenerate-qr}.tsx` | |
| `src/lib/settings/sections.ts` | *(extended)* the **first admin-only section** |

---

#### The first admin-only section, and it could not arrive wrong

`sectionsFor` has filtered on `adminOnly` since F28a, and `sections.test.ts` has asserted since then that a pilot and a reviewer never see such a row — both written *before there was one to hide*. So adding System was one line plus its page, and the test that guards it already existed.

Hiding the link is the courtesy; **`notFound()` is the check**. Not a redirect and not a "forbidden" page: a reviewer told *"you are not allowed here"* has learned an admin page exists at that URL.

---

#### Nothing on this page reports a status it inferred

Every check answers from something real — a query, a file on disk, a socket, an array in the code:

| Check | Answers from |
|---|---|
| Database | `select 1`, and how long it took |
| Migrations | `drizzle/meta/_journal.json` against `drizzle.__drizzle_migrations` |
| `APP_URL` / `BETTER_AUTH_URL` | the **request's own origin**, passed in from the page |
| `ID_HASH_PEPPER` | `Boolean(process.env…)` — nothing else |
| Resend / Blob | `emailConfigured`, `blobConfigured` |
| Inngest | `functions.length`, plus a socket to the dev server |
| Seed | `count(zone)` |

**Migrations are matched on the journal's `when` against `created_at`**, which Drizzle writes from exactly that value — verified against the live table, seven and seven, in order. The other column is a content hash, and matching on it would mean re-implementing Drizzle's hashing here and being wrong the day it changes.

**A journal that cannot be read reports `degraded`, not `ok`.** A deployed function has no `drizzle/` directory, and a green tick there would be the most misleading thing on the page.

The Inngest dev host is read from the installed SDK — `helpers/consts.js`, `http://localhost:8288/` — rather than remembered.

**Never a bare red dot.** Every degraded row carries the consequence in the operator's own terms, and the state is a *word* as well as a tint: a red dot and a grey dot are the same dot to a colourblind reader.

---

#### The `APP_URL` check, tested by actually breaking it

This is the check that earns the page: every sticker embeds `APP_URL` at render time, and nothing else in the app would ever say it was wrong.

So it was tested by setting `APP_URL=https://ajniha.example.com`, restarting, and reading the row. **`.env` was backed up first and restored byte-identical afterwards** (`diff` clean):

```
APP_URL · معطّل (down, destructive)
  القيمة        https://ajniha.example.com
  أصل الطلب     http://localhost:3001
  رموز الاستجابة السريعة تُرسم الآن بهذا العنوان… صحّح القيمة ثم أعد رسم الرموز
```

It names the value **and** the origin, which is what makes it actionable rather than alarming.

**The repair calls `storeQrForRemoteId`, not the Inngest job.** The job is triggered by `drone.approved`; firing that once per aircraft to redraw an image would send every pilot a second "your registration was approved" notification and email. The job's own render step calls this same function — going straight to it is the shared primitive, not a shortcut around one.

---

#### Deviated from spec

| What | Why |
|---|---|
| Inngest reports **function count + dev-server reachability**, not "functions registered" with Inngest | The count is a fact from the array the route serves. Whether *Inngest* has them registered is a question only Inngest can answer, and inventing a green tick for it would be the guess this page must not make. Unreachable is reported with the fix: `npx inngest-cli dev`. |
| `sameOrigin` split into `src/lib/ops/origin.ts` | `health.ts` carries `server-only`, so a test importing from it fails on load. Same split as `workflow/rules.ts` and `inngest/rules.ts`: the arithmetic behind the page's most consequential warning should be unit-testable without standing up a server. |
| Grouped counts projected over the **enum**, not read from the rows | `group by status` returns only statuses that have rows, so a fresh database would show four drone statuses instead of six and the missing two would look like a rendering bug rather than a zero. |
| No jobs / email / activity panels, not even empty ones | F29b and F29c. An empty panel headed "Background jobs" is exactly the lie this page exists to expose. |

---

#### Verified

| Check | Result |
|---|---|
| `pnpm test` | **1076 passed, 64 files** (7 new) |
| `pnpm exec tsc --noEmit` · `pnpm lint` | clean; `i18n:check` — 2071 keys in sync |
| `pnpm build` | compiled; `/settings/system` in the route list |
| Signed **out** | 307 → sign-in, `?next=` preserved |
| **As a reviewer** — role flipped in `psql` and restored | `/ar/settings/system` → **404**, and `/ar/settings` no longer mentions the route. Restored: 200 and the link is back |
| Nine checks render | 5 healthy, 3 degraded (Resend, Blob, Inngest — the true state of this machine), seed healthy |
| **No secret-shaped run anywhere in the page text** | five patterns — long hex, long base64, `re_…`, blob token, `postgres://` — **0 matches each** |
| `ID_HASH_PEPPER` | the **name** appears as a row title; no value, no prefix |
| `APP_URL` deliberately broken | **down**, destructive, names value and origin, with the consequence. `.env` restored byte-identical |
| Counts vs `psql` | pilots 1, Remote IDs 5, audit events 75; drones sum 7, bookings 4, zones 13 — **every figure matches**, and statuses with no rows show `0` rather than vanishing |
| Arabic numerals | **Latin digits throughout** — no `٠-٩` anywhere on the page |
| **Re-render all QR codes** | ran: *"أُعيد رسم 3، وفشل 0"*. Three files rewritten **under the same names** (in-place, so existing stickers keep resolving); expired and revoked aircraft correctly skipped; one `system.qr_regenerated` audit row with `{rendered: 3, failed: 0}` |
| The suite caught a missing audit label | `system.qr_regenerated` had no `review.auditActions` entry — two tests red until it did |
| Account state afterwards | admin + reviewer, exactly as before |

#### Not verified

- **A pilot getting 404.** A reviewer was tested by role-flip; a pilot takes the same `isAdmin` branch, so this is the same code path — but it was not driven.
- **Every check in its healthy state.** Resend, Blob and Inngest are degraded on this machine and were verified degraded, which is the honest state and the one the user chose to see. Their `ok` branches are one line each and unexercised.
- **Stopping Postgres to see the database check fail**, and **an actually-pending migration.** Both would mean breaking the environment mid-session; the error paths are written and untested. Worth doing once in F29b, when the server is being restarted anyway.
- **375 px** — six sessions.

#### Next session should know

- **F29b is background jobs.** The `job` table is real and complete — `run_id`, `function_id`, `status`, `attempt`, `started_at`, `finished_at`, `duration_ms`, `error`, `output`, `trigger_event`, **`rerun_of_run_id`**. That last column is what makes "re-run creates a *new* run and shows its new id" a schema fact rather than a UI claim.
- **Cancel must read "cancelling", never "cancelled"** — Inngest cancels at the next step boundary, and `job_status` already has a `cancelling` value with a comment saying exactly this.
- **Scheduled functions need cron, `Asia/Riyadh`, last run and next due.** The crons are on the function definitions in `src/lib/inngest/functions/`; the timezone is the app's fixed +180.
- Running the jobs panel against real data needs `npx inngest-cli dev` — nothing has ever run otherwise (thread 69).
- `NODE_OPTIONS="--conditions=react-server"` is still required for anything in `scripts/`.

---

### Session 41 — Wave 8 · F28c Account deletion, the `withdrawn` registration, and the policy rewrite (**F28 complete**)

**Date:** 2026-08-22
**Status:** ⚠️ done with deviations. **F28 is complete. Next is F29.**

---

#### What exists

| File | What |
|---|---|
| `drizzle/0006_cynical_master_mold.sql` | `drone.owner_user_id` → nullable, `on delete set null` |
| `src/lib/data/account-deletion.ts` | `deletionBlock`, `deleteAccount` |
| `src/lib/actions/settings.ts` | *(extended)* `deleteAccountAction` |
| `src/app/[locale]/(app)/settings/account/page.tsx` | `/settings/account` |
| `src/components/settings/delete-account.tsx` | Type-your-address confirmation |
| `scripts/probe-account-deletion.mts` | **20 assertions against the live database** |
| `src/lib/remote-id/redact.ts` | *(changed)* `RegistrationStatus` gains `withdrawn` |
| `src/content/legal/{ar,en}/privacy.mdx` | *(rewritten)* the retention section |
| `src/lib/legal/legal.test.ts` | *(extended)* the policy's deletion claims, pinned |
| 11 more files | nullable-owner fallout — see below |

---

#### The spec asks for two things that cannot both be literal

F28's deletion table says **drones deleted** *and* **Remote ID records retained, still resolving as "registration withdrawn"**. Those contradict each other in this schema: `remote_id.drone_id` is `not null`, and every fact a scan displays — build type, weight class, city — lives on the drone row. Deleting the drone takes the Remote ID with it and leaves a QR sticker on a real airframe resolving to nothing.

F03 had already anticipated the collision, in a comment on the column itself: *"a registration record is not the pilot's personal data to take with them … F28 has to offer a real path rather than quietly erasing an airframe that may be flying with an Ajniha sticker on it."* **That reasoning was right; the mechanism was not.** `restrict` does not protect the airframe — it only makes account deletion impossible, which is not a policy anybody chose, and which F27's privacy policy then had to disclose as *"there is no self-service deletion"*.

So: **`drone.owner_user_id` is nullable and `set null`.** The person goes, the accountability record stays, and the code answers `withdrawn` instead of 404. A null there means exactly one thing — the owner deleted their account — and nothing else in the app ever writes one.

**The migration is three statements and I read them before applying** (rule 1): drop the FK, drop `not null`, re-add with `set null`. No data touched.

---

#### Most of the deletion is the schema's, not the code's

Of the **22 foreign keys pointing at `user`**, six are `cascade` and fourteen are `set null` — including `audit_event.actor_user_id`, `email_log.user_id` and `remote_id_scan.viewer_user_id`. Deleting the row erases the personal record and anonymises the trail **in one statement**, which is what F28 asks for and is far more trustworthy than a hand-written sequence that has to remember all twenty-two.

`account-deletion.ts` therefore handles only the four things the schema deliberately leaves:

| | |
|---|---|
| `booking.pilot_user_id` | `restrict` — deleted first |
| `drone.owner_user_id` | `set null` — the aircraft survives, owner-less |
| `drone_photo` | hangs off `drone`, which survives — deleted explicitly |
| stored blobs | not in the database — deleted **before** the rows that name them |

**Blob order is deliberate.** Storage is not transactional. Files first means a failure leaves rows pointing at missing files — a broken image. The other order leaves files nothing can name — an orphaned blob nobody can find or delete, which is a privacy leak. F19b made the same call.

---

#### `withdrawn`, and where it ranks

`RegistrationStatus` gains `withdrawn`, derived from `ownerUserId === null` rather than from a new enum value — so it is true by construction and needed no second migration.

**Revocation outranks withdrawal.** Both mean "not authorised"; `revoked` additionally means *an authority grounded this aircraft*, which is the more actionable answer for an officer standing in front of it. A deleted account must not overwrite an enforcement decision in what a scan reports. Both orderings are now pinned by tests.

The nullable owner rippled through **11 files** — the review queue, the reviewer's drone page, the officer's disambiguation list, the QR job, the drone workflow, three probe scripts. Every one is handled by *not looking up an owner that is not there*, never by asserting one is. `src/lib/workflow/drone.ts` gained a guard at all seven entry points: a transition that notifies an owner refuses when there is none.

---

#### The two refusals

**An approved future booking blocks deletion**, and the refusal names the bookings with their dates — a pilot holding four cannot act on "you have approved bookings". An authorised flight with no accountable operator is precisely what this platform exists to prevent.

**The last admin is blocked**, because the first account created becomes admin and there is no promotion path back. Checked on `role`, not on a count of promotable people — there would be nobody left to do the promoting.

Both are re-checked **inside the action**, not trusted from the page: an action is an ordinary POST, the page may never have run, and a booking approved in the meantime must stop the deletion.

---

#### Verifying a destructive path without destroying anything

Account deletion cannot be checked by clicking it: the only accounts on this machine are the user's own admin and the reviewer, and deleting either to see what happens is the exact mistake the feature must be trusted not to make.

`scripts/probe-account-deletion.mts` builds a **synthetic pilot** with a drone, a Remote ID, an approved future booking, a co-pilot, a notification, a preference row and an audit event; then calls **the same functions the server action calls** — a probe that re-implemented the deletion would prove only that the probe works. **20 assertions, all passing**, and it cleans up after itself:

```
ok  blocked while an approved future booking stands
ok  the refusal names the booking
ok  a past approved booking does not block
ok  account / profile / preference / notification / booking / co-pilot / photo gone
ok  drone row SURVIVES … with no owner
ok  remote ID SURVIVES
ok  the pilot's audit event SURVIVES … with its actor cleared
ok  a user.deleted event was written … and it too has no actor
ok  the code now resolves as withdrawn
```

Run it with `NODE_OPTIONS="--conditions=react-server" pnpm exec tsx scripts/probe-account-deletion.mts` — **without that condition every probe in `scripts/` throws**, because `server-only` resolves to the entry that exists to throw. That is not new to this probe; the existing ones have the same requirement and none of them says so.

---

#### The policy said the opposite, yesterday

F27a's retention section stated — correctly at the time — that there was no self-service deletion and that the database refused to delete a pilot holding a booking. The day this feature landed that became the most misleading paragraph in the document.

It is rewritten in both languages: a table of what goes and what stays, both refusals named with their reasons, and the survival rule stated in the same words the settings page uses. `legal.test.ts` now pins it — the policy must contain `/settings/account`, must name both refusals, must say the Remote ID and audit log survive anonymised, and **must not contain the old sentence**. Three new tests, so the pair cannot drift a second time.

---

#### Deviated from spec

| What | Why |
|---|---|
| Drones **anonymised**, not deleted | Above. The two spec rows contradict; this satisfies the observable requirement — the code still resolves, as `withdrawn`. |
| `withdrawn` derived, not a new enum value | `ownerUserId === null` is the fact. An enum value would be a second copy of it that could disagree. |
| The probe moves a slot into the past rather than cancelling | ESLint rule 11 forbids a status write outside `src/lib/workflow/`, rightly. Testing that a **finished** booking does not block is also the better assertion — that an approved one does is obvious; the `slotStart > now` clause is what somebody could drop unnoticed. |

---

#### Verified

| Check | Result |
|---|---|
| `pnpm db:generate` → **read the SQL** → `pnpm db:migrate` | 3 statements, applied; `owner_user_id` now `YES` nullable, `SET NULL` |
| `pnpm test` | **1069 passed, 63 files** |
| `pnpm exec tsc --noEmit` | clean |
| `pnpm lint` | clean; `i18n:check` — 1994 keys in sync |
| `pnpm build` | compiled; `/settings/account` in the route list |
| **The deletion probe** | **20/20**, against the live database, self-cleaning |
| `/ar/settings/account` signed in as the only admin | the last-admin refusal renders, the consequence list renders, and **no delete button and no confirmation field exist on the page at all** |
| `/ar/privacy`, `/en/privacy` | 200; the new retention table renders; the old "no way to delete" sentence is **gone** from both |
| Database afterwards | 2 users (the real two), **0 probe rows, 0 owner-less drones** |
| The suite caught a missing audit label | `user.deleted` had no `review.auditActions` entry — two tests red until it did |

#### Not verified

- **The delete button has never been pressed in a browser**, and deliberately so — see above. The action wraps `deleteAccount`, which the probe drives directly; what is unexercised is the confirmation field, the refusal rendering *after* a failed attempt, and the sign-out-and-redirect. **A throwaway account through the real UI is the way to close this**, and it needs a sign-up.
- **`filesDeleted: 1` is weaker than it looks.** The probe pointed a photo row at a path that does not exist to prove the loop survives a failed delete — the local driver did not throw, so the `try/catch` was never actually exercised. On Vercel Blob it might. The resilience is written, not observed.
- **375 px** — five sessions now.
- The password change and the populated session list, still. Both still need one fresh sign-in.

#### Next session should know

- **F29 is the system / ops page**, and `SETTINGS_SECTIONS` is where its **admin-only** entry goes — the first one. `sectionsFor` already filters on `adminOnly` and `sections.test.ts` already asserts non-admins never see such a row; both were written in F28a for this.
- **F29 must not invent state.** The `job` table is real and F08 mirrors Inngest into it; the QR/`APP_URL` check is real. Anything else — uptime, queue depth, a health score — would be the empty-Billing-tab failure at ops scale.
- **`NODE_OPTIONS="--conditions=react-server"` is required to run anything in `scripts/`.** Worth putting in a `package.json` script the next time somebody touches that folder.
- A drone with `owner_user_id IS NULL` is a **withdrawn** registration and nothing else writes that null. Any new query joining drone → user must decide what to do with it; the eleven existing ones all skip the lookup rather than assert an owner.

---

### Session 40 — Wave 8 · F28b Security and notifications

**Date:** 2026-08-22
**Status:** ⚠️ done with deviations. **F28c is the danger zone, and it is the one to be careful with.**

---

#### What exists

| File | What |
|---|---|
| `src/app/[locale]/(app)/settings/security/page.tsx` | Password, email address, active sessions |
| `src/app/[locale]/(app)/settings/notifications/page.tsx` | The categories that are genuinely optional |
| `src/components/settings/password-form.tsx` | Better Auth's `changePassword`, `revokeOtherSessions: true` |
| `src/components/settings/session-list.tsx` | The device rows |
| `src/components/settings/revoke-session-button.tsx` | Two-click revoke |
| `src/components/settings/notification-toggles.tsx` | `useOptimistic` over F15's existing action |
| `src/components/ui/switch.tsx` | A native checkbox — see below |
| `src/lib/data/sessions.ts` | `listMySessions`, and the freshness refusal as a value |
| `src/lib/settings/user-agent.ts` + test | 9 tests, every case a real UA string |
| `src/lib/settings/notification-categories.ts` + test | Which categories may be switched, and the drift guard |
| `src/lib/validation/password.ts` | `MIN_PASSWORD_LENGTH`, de-duplicated |
| `src/lib/actions/settings.ts` | *(extended)* `revokeSessionAction` |

---

#### Two bugs that only a production serve could find

**1. `listSessions` threw and the page rendered blank.**

Better Auth puts `/list-sessions` behind `freshSessionMiddleware`: with `session.freshAge` non-zero — it defaults to `3600 * 24` and this app does not override it — a session older than 24 hours gets a **thrown** 403 `SESSION_NOT_FRESH`. Called straight from a Server Component that is an unhandled error, and the whole page renders as nothing at all. Type-check, lint, build and 1064 tests were all green.

**The freshness rule is right and was left alone** — a stolen laptop must not be able to enumerate and revoke the owner's other devices days later. What was wrong was the handling, so the refusal became a value the page renders: *sign out and sign in again to manage your devices*, with the reason.

Note the asymmetry, which is Better Auth's: **revoking** is behind `sensitiveSessionMiddleware`, which wants a valid session but **not** a fresh one. A stale session cannot see the list but could still revoke a token it already knew — which is why `revokeSessionAction` guards on its own rather than trusting the reader gated it.

**2. A function passed for an ICU value, not a tag.**

`t.rich("…", { address: () => <bdi>…</bdi> })` against a message reading `{address}`. A function may only be passed for a rich **tag** (`<addr>…</addr>`); passing one for a `{value}` hands React a function as a child and it fails at render with *"Functions cannot be passed directly to Client Components"*. The message now carries `<addr>{address}</addr>` — a value **and** a tag — which is also the better shape: the `<bdi>` isolation survives translation and the word order stays the translator's.

F27b's `AcceptanceLine` worked because its message was all tags and no values, so the pattern looked proven when it was not.

---

#### The switch that changed colour and never moved

`components/ui/switch.tsx` began as a sliding switch: a track with a knob travelling toward the end of the inline direction, which in Arabic is leftward. **Three implementations failed, and all three failed silently** — `checked:bg-primary` on the track works, so every version *looked* alive while the knob sat still:

| Attempt | What happened |
|---|---|
| `peer-checked:ltr:translate-x-4` + `rtl:` mirror | Stacked variant generated a rule that never matched |
| `peer-checked:start-[1.125rem]` | Rule generated **and** matched; resolved to the same used value in both states |
| Inline `insetInlineStart` from the `checked` prop | Style attribute updated on every toggle; `getBoundingClientRect()` never moved |

None failed a build, a lint, a type-check or a test, and none is visible in a screenshot of a switch that happens to be on. All three were caught by measuring the knob in both states — **the same instrument that caught the analytics axis anchors, and for the same reason: an RTL layout bug is a geometry question and only geometry answers it.**

The fix is the rule this project already had: **use the native control.** `Select` and `Slider` both made that call for RTL, mobile and accessibility reasons; the switch now does too. It is a checkbox with `accent-color`, the browser draws it correctly under `dir="rtl"` with no work from us, and there is no geometry left to get backwards. `role="switch"` is deliberately **not** set — it would announce a switch while showing a checkbox.

**Where this stopped:** three failed attempts is where a cosmetic detail stops being worth more probes. The native control is not a workaround dressed as a decision — it is the same call the two sibling components made on purpose.

---

#### The third notification category is a switch that would do nothing

`notification_category` has three values. **Only two are ever passed to `notify()`:**

| Category | Passed by | Switchable |
|---|---|---|
| `booking_reminder` | `inngest/functions/booking-reminders.ts` | yes |
| `registration_expiry` | `inngest/functions/expiry-reminders.ts` | yes |
| `zone_closure` | **nobody** | no |

F23c's closure fan-out sends `zoneClosed` with no category, and says why: *"A cancellation is not a preference — a pilot who muted it would turn up to a closed zone."* **That call is right.** So the spec's third toggle would have been a control that changes nothing — the empty-Billing-tab failure in miniature, and worse than absent because somebody who switches it off believes they have acted.

So the page offers **two** switches and names closures in the always-sent sentence instead. `SWITCHABLE_CATEGORIES` carries the reasoning and `notification-categories.test.ts` reads every `category:` literal out of `src/lib` and fails if the list and the code disagree **in either direction**. Proved it bites: adding `zone_closure` to the list turned two tests red, removing it turned them green.

The enum value stays. Dropping a value from a Postgres enum is a migration far larger than the tidiness is worth, and it is what a future closure *digest* would key on.

---

#### Deviated from spec

| What | Why |
|---|---|
| **Two** notification toggles, not three | Above. |
| No email-change control, only an explanation | Changing an address people are notified at needs a verification message first, and `RESEND_API_KEY` has never been set here. F28's criterion is that this *explains itself* rather than failing silently — so the address is shown, no control is offered, and the sentence names the reason. `emailConfigured` is read at request time, so the same build tells the truth on a deployment that has a key. **Enabling Better Auth's `changeEmail` would mean editing `src/lib/auth.ts`**, which per the CLAUDE.md rule means re-running the CLI and a migration; deferred until mail exists to verify with. |
| "Approximate location from `ipHash` region" — not built | An `ipHash` is `sha256(pepper + ip)`. It cannot be reversed, so there is no region to resolve from it; the spec line is not implementable as written. Better Auth's own `session` row stores the address **raw**, so the list shows that instead, to the only person entitled to see it. No geolocation service is called — that would send the user's address to a third party the privacy policy does not name. |
| `revokeOtherSessions: true` always, not a checkbox | A password change is what somebody does when they think a password is compromised. Offering to leave the other sessions signed in is offering to leave the intruder signed in. The form says it happens rather than asking. |
| Password change goes through **Better Auth**, not a server action | It is the thing that already verifies a password against the stored hash; a second comparison in this codebase would be worse than none. Its rate limit is declared in `src/lib/auth.ts` (`/change-password`, 5/min), which is why the form calls no `enforceLimit`. |
| `MIN_PASSWORD_LENGTH` extracted to `src/lib/validation/password.ts` | It was `const MIN_PASSWORD_LENGTH = 8` in `sign-up-form.tsx` **and** in `reset-password-form.tsx`; this form would have been the third copy. 8 is Better Auth's default, and `src/lib/auth.ts` does not override it. |

---

#### Verified

| Check | Result |
|---|---|
| `pnpm test` | **1064 passed, 63 files** (13 new) |
| `pnpm exec tsc --noEmit` | clean |
| `pnpm lint` | clean; `i18n:check` — 1973 keys in sync |
| `pnpm build` | compiled; `/settings/security` and `/settings/notifications` in the route list |
| Signed **out** — `/ar/settings/security`, `/ar/settings/notifications`, `/en/settings/security` | **307 → sign-in**, with `?next=` preserved |
| Security page, signed in | three headings; password form with its three labelled fields; the address shown; the email explanation; *"changing your password ends every session on your other devices"* |
| The freshness branch | **rendered** — this session is older than 24 h, which is exactly the case that used to blank the page |
| Notifications page | 2 categories × 2 channels = **4 controls**, all on (absent means on); the always-sent sentence includes closures; **no `zone_closure` toggle** |
| Toggle → `psql` | no rows → click *email* off → `booking_reminder / f / t`; clicked back → `t / t`. **A row is written only when somebody chooses** |
| The control toggles visibly, and labels are clickable | yes — `true → false → true`, every `<label>` contains its input |
| `pageScrollsSideways`, Arabic RTL, both pages | **false** |
| Category drift test bites | adding `zone_closure` → **2 tests red**; removing it → green |
| Account left as found | `preferred_locale = ar`; the one preference row back at its defaults |

#### Not verified

- **The password change itself was never executed.** It needs the account password, which is not mine to have. So *"a wrong current password is rejected"* and *"after a password change the other sessions are invalidated"* are **unverified** — the wiring is Better Auth's own endpoint with `revokeOtherSessions: true`, but nobody has watched it happen.
- **The session list has never been seen populated**, for the same reason the freshness branch renders: this session is stale. Revoking a device is therefore also unverified. Both need one fresh sign-in.
- **375 px** — still. `resize_window` has now failed in four consecutive sessions.
- **That a notification actually stops arriving** when switched off. The preference write is confirmed against the database; `notify()` reading it is F15's tested code, but the two have not been driven end to end.

#### Next session should know

- **A fresh sign-in unblocks three checks at once**: the session list, revoking a device, and the password change. Worth doing first.
- **F28c is the careful one.** `remote_id.droneId` is `on delete cascade`, so deleting a drone deletes its Remote ID — and F28 requires the Remote ID to **survive, anonymised, still resolving as "registration withdrawn"**. That needs a migration (nullable `droneId`, `on delete set null`, and a status the enum does not have) and it touches `redact.ts`'s `RegistrationStatus` and `registrationStatusOf` — F11's pure module, with its own tests. `booking.pilotUserId` and `drone.ownerUserId` are `on delete restrict`, so deletion must be ordered by hand.
- **F28c also rewrites the privacy policy's retention section** (agreed with the user in Session 39). It currently states there is no self-service deletion and that the database refuses to delete a pilot holding a booking — both true today, both false the moment F28c lands. Pin the policy's deletion claims to the code with a test, the way the terms are pinned to their constants.
- **`t.rich` takes a function for a `<tag>` and a value for a `{value}`.** Mixing them up is a render-time crash with every static check green.
- **Adding a settings section is two edits in one commit**: the route directory and `SETTINGS_SECTIONS`. `sections.test.ts` compares them both ways.

---

### Session 39 — Wave 8 · F28a The settings shell, the profile section and language

**Date:** 2026-08-22
**Status:** ⚠️ done with deviations. **F28b is security + notifications; F28c is the danger zone.**

---

#### What exists

| File | What |
|---|---|
| `src/lib/settings/sections.ts` | The section list, as data. Pure |
| `src/lib/settings/sections.test.ts` | 7 tests — the "no Billing, no Connected apps" criteria as assertions |
| `src/app/[locale]/(app)/settings/layout.tsx` | The shell: heading, section nav, content column |
| `src/app/[locale]/(app)/settings/page.tsx` | `/settings` — the index |
| `src/app/[locale]/(app)/settings/language/page.tsx` | `/settings/language` |
| `src/components/settings/section-nav.tsx` | The nav, marking the current section |
| `src/components/settings/language-form.tsx` | Persist **and** navigate |
| `src/components/profile/reveal-own-id.tsx` | Confirm → reveal → "this was recorded" |
| `src/lib/actions/settings.ts` | `setPreferredLocaleAction`, `revealOwnIdentityAction` |
| `src/lib/data/user.ts` | *(extended)* `getMyPreferredLocale` |
| `src/lib/rate-limit/rules.ts` | *(extended)* `settings.save` — 30/min |
| `src/app/[locale]/(app)/layout.tsx` | *(extended)* the Settings link |
| `src/app/[locale]/(app)/settings/profile/page.tsx` | *(adapted)* into the shell, plus the reveal |
| `src/proxy.ts` | *(extended)* `settings` in `PROTECTED_SEGMENTS` |

---

#### `/settings/profile` existed since F17 and nothing linked to it

The page has been shipped and reachable only by typing the URL since Session 17. **F28a adds the way in** — a Settings link in the signed-in header, and the shell that makes it a section rather than a loose page. A part of the app nothing navigates to is a part of the app nobody has.

Adapting it cost two changes worth naming: it rendered its own `<main>` and its own `<h1>`, and the layout now owns both. **Two `<main>` elements is not a style problem** — it gives the document two main landmarks, which a screen reader reports as a fault rather than as structure.

---

#### The language setting is not the language switcher

They look like the same control and they are not, which is the whole reason this section exists.

The header switcher (F02) changes the URL and nothing else — right for reading, because a pilot comparing a refusal reason in the other language must not thereby change what language their **approval notice** arrives in. `user.preferredLocale` is the durable choice that F06's mail and F15's notifications read, and until now **nothing wrote it after sign-up**: a pilot who switched to English in the header still received Arabic email, for ever, with no control anywhere that would change it.

So `/settings/language` does both — writes the preference, then navigates — and says so on the page in as many words, in both directions:

- *"This is not only the interface: the emails and notifications we send you will arrive in this language too."*
- *"The language buttons at the top of the page change only what you are reading now — they do not change the language of your mail."*

The page shows the **stored** preference, never the URL's locale. Showing the URL locale would report a choice the person never made.

**Verified against the database, end to end.** With `preferred_locale = 'ar'`, clicking English in the settings form moved the row to `'en'` *and* landed on `/en/settings/language` with the path preserved; clicking Arabic put it back. Both reads were `psql` against the running container, not the UI's own word for it. **The account was left as it was found (`ar`).**

---

#### The owner's reveal — and why it does not weaken F17's property

F28 asks for a Reveal on the owner's own document number. F17 had deliberately built the page with **no such branch**, and its comment is the reason to be careful: *"if there is no branch that ever renders the whole number, then no screen can display one."*

The property F17 actually claimed is narrower and survives intact — **no screen displays a full national ID *without a logged reveal***. `revealOwnIdentityAction` is a logged reveal:

```
getSession → rateLimit(identity.reveal, 20/hr)
  → audit_event 'pilot_profile.identity_revealed'   ← BEFORE the return
  → the unmasked number
```

**It takes no argument.** `revealPilotIdentityAction` takes a `userId` and a written reason because a reviewer has to justify exposing a stranger; asking somebody to justify seeing their own number, to themselves, is a form with no reader. Taking no parameter means there is no identifier to tamper with — the only row it can return is the session's own.

The audit row carries `reason: "owner"` and **no document number**: `before` and `after` are both null, because a reveal is a read and nothing changed. Copying the number into `audit_event` would put a second permanent unmasked copy in the one table the app never deletes from.

**Verified in the running app.** The confirmation appears first and the mask is still on the page at that point; confirming revealed the number and wrote exactly one new row —

```
action                          | actor_role | reason | before | after | ip_hash
pilot_profile.identity_revealed | admin      | owner  | null   | null  | present
```

— distinguishable at a glance from the reviewer reveal three days earlier, which carries a written Arabic reason. **While I was there I checked what that reviewer row stores in `after`: `{"userId": "…"}` and nothing else.** No document number in the log on either path.

---

#### Deviated from spec

| What | Why |
|---|---|
| The nav lists **two** sections, not six | Security, Notifications and Account do not exist yet, and System is F29's. F16's footer rule, again: a nav entry pointing at a 404 is worse than one fewer entry. `sections.test.ts` asserts the list and the route directory are the same set, so F28b/c cannot forget to add theirs and cannot add one early. |
| `settings` message namespace **rewritten** | It held placeholders from an earlier wave, including `preferredLanguage: "Interface language"` — which is precisely the framing this feature exists to correct. Nothing referenced any of them. |
| `preferredLocale` change is **not audited** | `audit_event` is the regulator's trail: registrations, bookings, identities. A pilot choosing to read in English is none of those, and putting it there dilutes a log whose value is that everything in it matters. |
| `settings` added to `PROTECTED_SEGMENTS` | The layout guard already protected these pages — that is what the signed-out 307s prove. The proxy entry only stops the flash. |
| `section-nav.tsx` is a **client** component | The docs sidebar (F26) is a Server Component because each page renders it and already knows its slug. A *layout* does not know which child is rendering, so the alternatives were one small `"use client"` boundary or five copies of a `<ul>` that must agree. |

---

#### Verified

| Check | Result |
|---|---|
| `pnpm test` | **1051 passed, 61 files** (7 new) |
| `pnpm exec tsc --noEmit` | clean |
| `pnpm lint` | clean; `i18n:check` — 1938 keys in sync |
| `pnpm build` | compiled; `/settings`, `/settings/language`, `/settings/profile` in the route list |
| Signed **out** — all four settings URLs, both locales | **307 → `/{locale}/sign-in`**, none rendered |
| Signed **in** — `/ar/settings`, `/ar/settings/profile`, `/ar/settings/language` | **200**; index lists exactly the two sections; nav marks the current one with `aria-current="page"` |
| Landmarks on `/ar/settings/profile` | **one `<main>`, one `<h1>`** |
| Language: click English → `psql` | `preferred_locale` `ar` → **`en`**, URL `/en/settings/language`, path preserved. Restored to `ar` |
| Reveal: confirmation step | shown first; **the mask is still the only number on the page at that point** |
| Reveal: after confirming | number shown, "this was recorded" notice, **exactly one new `audit_event`**, `reason='owner'`, `before`/`after` null, `ip_hash` present |
| Full document number anywhere on the profile page before a reveal | **no.** Mask reads `•••••2345`; the only bare 10-digit runs are the pilot's own mobile and emergency contact |
| `pageScrollsSideways` on both new pages, Arabic RTL | **false** |

#### Not verified

- **375 px.** `resize_window` still does not apply — third session running, same symptom (`window.innerWidth` stays 1440, `document.visibilityState` is `"hidden"`). The pages measured clean for sideways scroll at 1440 and the nav is a `overflow-x-auto` row below `md`, but **the breakpoint itself has not been seen.** This is now a standing gap across F27b and F28a and wants one pass on a real phone-width window.
- **Pilot B cannot reach pilot A's settings** — F28's access criterion. Every page here reads `session.user.id` and there is no route parameter to point at another account, so there is no surface to attempt it against; but it has not been *driven* with a second account. The reviewer account exists (`alshar55@hotmail.com`) and its password is not mine to have.
- **That an email actually arrives in the new language.** `preferred_locale` is what `src/lib/inngest/queries.ts` reads, and the write is confirmed; the delivery half needs `RESEND_API_KEY`, which has never been set (log line 32).

#### Next session should know

- **F28b is security + notifications.** Password change (current password required, other sessions invalidated, rate-limited), the active-session list from Better Auth's `session` table — which stores `ip_address` **raw**, so the list is the one place that data surfaces in the UI — and the email-change control, which must *explain* why it is unavailable with no `RESEND_API_KEY` rather than fail silently. Notification categories are exactly the three F15 sends, and the page must say in plain words that decision notices cannot be turned off.
- **Add the slug to `SETTINGS_SECTIONS` in the same commit as the page.** `sections.test.ts` compares the list against the route directory in both directions and will fail either way round.
- **F28c is the one to be careful with.** `remote_id.droneId` is `on delete cascade`, so deleting a drone deletes its Remote ID — and F28 requires the Remote ID to **survive, anonymised, still resolving as "registration withdrawn"**. That needs a migration (nullable `droneId`, `on delete set null`, and a status the enum does not yet have), and it touches `redact.ts`'s `RegistrationStatus` and `registrationStatusOf` — which is F11's pure module, with its own tests. `booking.pilotUserId` and `drone.ownerUserId` are `on delete restrict`, so deletion must be ordered by hand rather than left to a cascade.
- **F28c must also rewrite the privacy policy's retention section** (agreed with the user this session). It currently states there is no self-service deletion and that the database refuses to delete a pilot holding a booking — both true today, both false the moment F28c lands. Worth a test pinning the policy's deletion claims to what the code does, the way the terms are pinned to their constants.

---

### Session 38 — Wave 8 · F27b Terms, the footer links and the acceptance line (**F27 complete**)

**Date:** 2026-08-22
**Status:** ⚠️ done with deviations. **F27 is complete — every acceptance criterion verified.**

---

#### What exists

| File | What |
|---|---|
| `src/content/legal/{ar,en}/terms.mdx` | The terms, 14 sections, Arabic authored first |
| `src/app/[locale]/(public)/terms/page.tsx` | `/ar/terms`, `/en/terms` |
| `src/components/legal/legal-page.tsx` | The shared body + `legalMetadata`; both routes are now ~20-line wrappers |
| `src/components/legal/acceptance-line.tsx` | "By creating an account you agree to…", `t.rich` with two links |
| `src/lib/legal/documents.ts` | *(extended)* `"terms"` in `LEGAL_SLUGS` and its 14 section ids |
| `src/lib/legal/legal.test.ts` | *(extended)* 17 tests — the operational clauses now checked against the constants |
| `src/components/layout/site-footer.tsx` | *(extended)* Docs · Privacy · Terms |
| `src/app/[locale]/(public)/(auth)/sign-up/page.tsx` | *(extended)* the acceptance line under the button |
| `messages/{ar,en}.json` | `legal.acceptance`, `common.footerNavLabel` |

---

#### The terms are checked against the code, not written from memory

A terms page is the easiest document in this repository to write plausibly and get wrong: *"cancel up to an hour before"* is a sentence nobody would question and the code refuses at two hours. So every operational number was read out of the module that enforces it, and `legal.test.ts` now asserts the prose against the constant:

| Clause | Constant | Where |
|---|---|---|
| 18 or over | `MIN_AGE_YEARS = 18` | `src/lib/validation/profile.ts` |
| Registration lasts 3 years | `REGISTRATION_YEARS = 3` | `src/lib/workflow/rules.ts` |
| Pilot may cancel up to 2 hours before | `PILOT_CANCEL_LEAD_MS` | `src/lib/workflow/rules.ts` |
| No-show after 30 minutes' grace | `NO_SHOW_GRACE_MINUTES = 30` | `src/lib/inngest/rules.ts` |
| 3 no-shows in 90 days ends auto-approve | `NO_SHOW_LIMIT`, `NO_SHOW_WINDOW_DAYS` | `src/lib/data/pilot.ts` |
| **Revocation is an admin's power, not a reviewer's** | `TRANSITIONS["drone.revoked"].actors === ["admin"]` | `src/lib/workflow/transitions.ts` |

The first four constants come from pure modules and are imported. The two no-show numbers live behind `server-only` and a database connection, so they are **read out of the source as text** — the same call `docs.test.ts` made about `.mdx`, for the same reason.

**The cancellation window is the one number Arabic does not write as a digit.** Two of something is the dual — `ساعتين`, one word, no numeral — and writing `2 ساعات` to make it greppable would be broken Arabic on the page that most needs to be trusted. The test asserts the dual form, gated on `cancelHours === 2`, so changing `PILOT_CANCEL_LEAD_MS` fails the constants test first and points at the sentence a translator has to rewrite.

Three clauses came out of reading the workflow table rather than from the spec: **a reviewer cannot decide their own submission** (four-eyes, enforced in code), **an approved booking is sent back to `pending` rather than cancelled when a boundary moves under it** (`booking.flagged_for_review` — the seat is held), and **revocation is reversible** (`drone.reinstated`, admin, and both acts stay in the log).

---

#### The acceptance line

A sentence under the button, not a checkbox — and specifically not a pre-ticked one. **Verified: no `type="checkbox"` and no `checked` attribute anywhere on `/ar/sign-up` or `/en/sign-up`.**

`t.rich`, so the two links sit **inside** the sentence. Arabic and English put the noun phrases in different places, and a sentence assembled by concatenating a prefix, a link and a suffix can only be right in one of them — the same reasoning that produced `DOC_ANCHORS` in F26. Rendered Arabic:

```html
<p …>بإنشاء حساب فأنت توافق على <a href="/ar/terms">شروط الاستخدام</a> و<a href="/ar/privacy">سياسة الخصوصية</a>.</p>
```

It lives in the **page**, not in `SignUpForm`, so it stays a Server Component — `SignUpForm` is `"use client"` and pulling two links into that bundle would buy nothing.

---

#### Deviated from spec

| What | Why |
|---|---|
| `LegalPage` extracted; the two routes are wrappers | F27a's privacy page was ~60 lines and terms would have been the same 60 with one noun changed. The second copy is where the effective-date line silently stops matching the first. |
| `legal` namespace gained `acceptance`; `common` gained `footerNavLabel` | The footer `<ul>` has three members now and needed an `aria-label`. |
| Footer is a `flex-wrap` list, no `·` separators | A typed separator is read aloud by a screen reader and lands on the wrong side under RTL. `gap-x-4` is direction-aware for free. |

---

#### The `NEXT_LOCALE` trap has a second half

F27a turned off the cookie next-intl was writing but never reading. **Browsers that visited before the fix still carry the old `NEXT_LOCALE`** — a cookie has no way to un-set itself from the server once the code that wrote it is gone. It expires on its own; nothing reads it either way. But anyone re-running the devtools check on a browser that has used this app will still see it, and it is **not** evidence the fix failed.

#### And a third: localhost cookies ignore the port

Checking the signed-in load in the user's own Chrome, `document.cookie` on `localhost:3001` returned:

```
rl_anonymous_id, rl_user_id, rl_trait, rl_session,
ph_phc_…_posthog, NEXT_LOCALE
```

**RudderStack and PostHog — on the page whose privacy policy states there is no analytics anywhere.** They are not this app's. Verified three ways: nothing matching `rudder|posthog|segment|analytics` in `package.json`, nothing in the served HTML of a signed-in page, and nothing in the whole of `.next/static`. **Cookies are scoped by host and ignore the port**, so any other app that has ever run on `localhost` shares its jar with this one.

This is a booby trap for exactly the check F27's criteria ask for: open devtools on `localhost:3001`, see PostHog, conclude the app ships trackers. **It does not.** On a real deployment with its own hostname the jar is this app's alone.

---

#### Verified

| Check | Result |
|---|---|
| `pnpm test` | **1044 passed, 60 files** (17 in `legal.test.ts`) |
| `pnpm exec tsc --noEmit` | clean |
| `pnpm lint` | clean; `i18n:check` — 1935 keys in sync |
| `pnpm build` | compiled; `/[locale]/terms` in the route list |
| `/ar/privacy`, `/en/privacy`, `/ar/terms`, `/en/terms`, `/ar/sign-up`, `/en/sign-up` signed out | **200**, all six |
| Footer links | `/{ar,en}/{docs,privacy,terms}` — all six resolve |
| Acceptance line | links render inside the sentence; **no checkbox, no `checked`, either locale** |
| `Set-Cookie` on `/ar/terms` signed out | **none** |
| **Signed-in cookie check** — 5 page loads (`/ar/dashboard`, `/ar/privacy`, `/ar/terms`, `/ar/drones`, `/en/dashboard`) with `credentials: "include"` | **jar unchanged, zero new cookies** |
| Better Auth's session cookie | **`HttpOnly`** — absent from `document.cookie` while demonstrably signed in |
| Analytics / advertising / tracking anywhere in the app | **none** in `package.json`, served HTML, or `.next/static` |
| TOC vs headings, `/ar/terms` live DOM | 14 anchors, 14 `<h2 id>`, **0 broken** |
| `/en/terms`, `/ar/terms` heading ids | 14 each |
| `dir="ltr"` in rendered `/ar/terms` | the mailto only. **No Arabic inside one** |
| **375 px** — reading column squeezed to 343 px (375 minus gutters), both pages | **nothing overflows**; all four masking-table columns reflow inside 343 px, and no element that cannot scroll is wider than its box |

#### Not verified

- **The `md` breakpoint swap itself** — the TOC's `<details>`-below / sticky-column-above. `resize_window` reports success and does not apply: `window.innerWidth` stayed 1440 across two attempts, in two separate tab groups, and `document.visibilityState` was `"hidden"` both times. The 375 px row above tests **content overflow**, which is the failure that actually breaks an RTL page; it does **not** re-evaluate media queries. Worth one look on a real phone-width window.
- **No screenshots**, again — `Page.captureScreenshot` cannot run against a hidden tab. Everything above was measured with `getBoundingClientRect` and `document.cookie`.

#### Next session should know

- **F27 is closed. Next is F28 — account settings**, then F29, F30, F31, strictly in that order.
- **Nothing may be added to a settings page that the app does not do.** No billing, no SMS, no notification channel that does not exist. `notification_preference` is a real table — check what it actually holds before offering a control for it.
- The legal machinery generalises: a third document is `LEGAL_SLUGS` + `LEGAL_SECTIONS` + two `.mdx` files + a 20-line route. **Add the slug and the file in the same commit** — `legal.test.ts` asserts the slugs and the files are the same set in both locales.
- `EFFECTIVE_DATE` in `src/lib/legal/fields.ts` is **2026-08-22** and is set by hand. Any substantive edit to either document should move it; a typo fix should not.
- Killing the dev server: `TaskStop` alone left the listener running twice this session, and **a stale server serves the previous build and will cheerfully "confirm" a change you have not deployed.** `Get-NetTCPConnection -LocalPort 3001` then `Stop-Process -Force` is what actually clears it.

---

### Session 37 — Wave 8 · F27a Legal fields, the legal MDX loader, and the privacy policy

**Date:** 2026-08-22
**Status:** ⚠️ done with deviations. **F27 is half done — F27b is terms, the footer links, the sign-up acceptance line and the signed-in cookie check.**

---

#### What exists

| File | What |
|---|---|
| `src/lib/legal/fields.ts` | The five human-fillable values: `CONTACT_EMAIL`, `ORGANISATION_NAME`, `GOVERNING_LAW`, `JURISDICTION`, `EFFECTIVE_DATE` |
| `src/lib/legal/documents.ts` | `LEGAL_SLUGS`, `LEGAL_SECTIONS`, `LegalMeta` + guard, `legalSectionHref`. Pure |
| `src/lib/legal/load.ts` | `loadLegal(locale, slug)` — dynamic `import()`, not `readFile` |
| `src/lib/legal/index.ts` | Barrel |
| `src/lib/legal/legal.test.ts` | 13 tests — the thing that lets the TOC exist at all |
| `src/components/legal/toc.tsx` | Table of contents. No JavaScript |
| `src/app/[locale]/(public)/privacy/page.tsx` | `/ar/privacy`, `/en/privacy` |
| `src/content/legal/{ar,en}/privacy.mdx` | The policy, 12 sections, Arabic authored first |
| `src/mdx-components.tsx` | *(extended)* `<ContactEmail />`, `<Org />`, `<GoverningLaw />`, `<Jurisdiction />` |
| `src/i18n/routing.ts` | *(changed)* `localeCookie: false` — see below |
| `messages/{ar,en}.json` | `legal` namespace rewritten |

---

#### The finding: the app was setting a cookie nothing read

F27's acceptance criteria say *"Only the session cookie and the locale cookie are set — verified in devtools"*. Reading `src/i18n/routing.ts` first, I wrote the policy claiming the opposite — that the locale is in the URL and there is **no** locale cookie, since `localeDetection: false`.

Both were wrong, and a `curl -D -` against a production serve is what said so:

```
set-cookie: NEXT_LOCALE=ar; Path=/; SameSite=lax
```

**`localeDetection` and `localeCookie` are different options.** Turning detection off stops next-intl *reading* the cookie and leaves its middleware *writing* one on every response. Measured three ways against the production serve — `/` with `NEXT_LOCALE=en`, with `Accept-Language: en-US`, and with neither — the redirect was `→ /ar` every time. **The cookie decided nothing.**

A cookie nothing reads is the one kind this app must not set: it is not "strictly necessary", so it is the thing a consent banner would have to exist for, bought for no feature at all. Describing it in the policy would have been an awkward footnote on the one page that cannot afford one. So `localeCookie: false` — verified after a rebuild: **no `Set-Cookie` at all on `/ar/privacy`, `/en` or `/ar/sign-in` signed out**, both locales still serve, and `/` still redirects to `/ar` under `Accept-Language: en-US`.

The spec's cookie table is now wrong in the other direction and is left as-is deliberately — its *conclusion* (no banner) survives, and its reasoning is corrected here. **The build log wins.**

---

#### Deviated from spec

| What | Why |
|---|---|
| `src/lib/legal.ts` → **`src/lib/legal/`** | The feature needs the fields *and* a loader *and* a section table. One directory mirroring `src/lib/docs/` beats one file plus two oddly-named neighbours. `@/lib/legal` still resolves, so the criterion ("the pages read from it") is met unchanged. |
| `content/legal/…` → **`src/content/legal/…`** | The Files list says `content/`; the repo's actual MDX root is `src/content/`, and F26's loader is built on it. |
| **Two cookies → one.** | Above. |
| `LEGAL_SLUGS = ["privacy"]`, not `["privacy", "terms"]` | A slug listed before its file is a build-time import failure, and `legal.test.ts` asserts slugs and files are the same set. **F27b adds `"terms"` and the file in the same commit.** |
| No `DocsShell` twin for legal | The frame is identical; only the aside differs. A `LegalShell` would have bought a name and cost a second grid to fix. |
| `legal` message namespace **shrunk** | It already existed with placeholders from an earlier wave, including `cookieBannerBody` and `cookieAccept` — strings for a banner F27 forbids. Nothing referenced them (`grep` for `legal.` found nothing outside this feature). Kept `terms` and `privacy` for F27b's footer; added `tocLabel`, `effectiveDate`. |

---

#### The table of contents, and F26's objection to it

F26 **deliberately shipped no TOC** (log line 588): the `.mdx` sources are compiled into the bundle and unreadable at runtime in a deployed function, so a TOC needs a generated manifest that goes stale or a hand-kept list that drifts.

F27's criteria require one. The objection is answered rather than ignored:

- Section **ids** are fixed once, language-independently, in `LEGAL_SECTIONS`.
- Each `.mdx` exports its own localised titles against those ids, and writes its headings as `<H2 id="…">`.
- `legal.test.ts` reads the **source as text** (Vitest has no MDX loader — F26's call, unchanged) and fails if a file's TOC ids are not exactly `LEGAL_SECTIONS` in order, or if the `<H2 id>` list is not the same list.

A renamed heading, an entry with no heading, a section added to Arabic and forgotten in English: each is now a red test. **A hand-kept list that cannot drift silently is a different object from the one F26 turned down.**

---

#### The policy is assembled from the schema, not from a template

Every disclosure was read out of the code before it was written down. Three things the spec's own disclosure table does not list, found that way:

- **`booking_copilot` stores a third party's name, mobile and ID number** — a person who may have no account here at all. Disclosed, with a line telling the pilot not to enter someone's details without their knowledge.
- **Better Auth's `session` table stores the IP address raw.** Our own tables (`audit_event`, `remote_id_scan`, `drone_report`) store `sha256(pepper + ip)`. Rule 4 says the generated tables stay as the CLI wrote them, so this is a real exception — stated twice on purpose, in *what we collect* and again in *security*, because an exception missing from the security section is not a disclosed exception.
- **`booking.pilotUserId` and `drone.ownerUserId` are `on delete restrict`.** The database physically refuses to delete a pilot holding a registration or a booking, and there is no account-deletion path anywhere in `src/`. The policy therefore says plainly that **there is no self-service deletion**, rather than promising an erasure the app cannot perform.

Retention claims were checked against every `delete` in the codebase — there are six, and only two touch personal data: a **draft** drone (with its photos, from storage too) and a single photo. The rate-limit and review-presence sweeps are the only automatic deletion in the app, and the policy says exactly that.

The masking table was transcribed field by field from `redactRemoteId`, including the two things easy to get wrong: **a signed-in pilot scanning someone else's code sees exactly what an anonymous visitor sees** (`level === "anonymous" || level === "pilot"` take the same branch), and **the ID stays masked even for a reviewer** until an explicit reveal. `legal.test.ts` pins the mask string `•••••1234` against what `maskIdDocument` produces.

Named recipients: Resend, Vercel Blob, Inngest, OpenFreeMap — and the test asserts a forbidden list (Google Analytics, Sentry, PostHog, Plausible, Mixpanel, Cloudflare, Mapbox) appears in neither locale, so the day one of them is added the policy fails a test instead of going quietly out of date. The policy also states that **no mail has ever been sent through Resend and no file has ever been stored in Vercel Blob**, which is what log lines 32 and 332 say.

---

#### Verified

| Check | Result |
|---|---|
| `pnpm test` | **1040 passed, 60 files** (13 new) |
| `pnpm exec tsc --noEmit` | clean |
| `pnpm lint` | clean; `i18n:check` — 1933 keys in sync |
| `pnpm build` | compiled; `/[locale]/privacy` in the route list |
| `curl /ar/privacy`, `/en/privacy` on `next start` | **200** both, signed out |
| `Set-Cookie` on `/ar/privacy`, `/en`, `/ar/sign-in` signed out | **none** |
| `/` under `Accept-Language: en-US` | `→ /ar`, unchanged by the routing edit |
| 12 TOC anchors vs 12 `<h2 id>` in the live DOM | **0 broken** |
| `document.documentElement.scrollWidth > clientWidth` at 1440 | **false** — no sideways scroll |
| Every `dir="ltr"` in the rendered Arabic page | only Latin runs (`•••••1234`, `/ar/…`, the mailto). **No Arabic inside one** |
| Effective-date line, Arabic | `تاريخ النفاذ 22 أغسطس 2026` — Gregorian, Latin numerals |

#### Not verified

- **Rendering at 375 px.** `resize_window` did not take: the tab was backgrounded, `window.innerWidth` stayed 1440 after the call. Stopped rather than rabbit-holing. F27b does one browser pass covering privacy *and* terms.
- **The signed-in cookie load**, which is how F27's criterion is actually worded. Signed out sets nothing; the session cookie is the only remaining candidate. Needs an account password I don't have — **for the user, or F27b.**
- **No screenshot of either page.** `Page.captureScreenshot` timed out at 30 s; `document.visibilityState` was `"hidden"`, which is the trap CLAUDE.md already names. The layout was measured with `getBoundingClientRect` instead — the method that found the `text-anchor` bug that screenshots missed.

#### Next session should know

- **F27b is: `terms.mdx` ar+en, `"terms"` into `LEGAL_SLUGS` and `LEGAL_SECTIONS`, `/[locale]/terms/page.tsx`, footer links, the sign-up acceptance line (a line with links, *not* a pre-ticked checkbox), the 375 px pass, and the signed-in cookie check.** The loader, the TOC, the fields and the test harness are all built and take `"terms"` with no new machinery.
- The terms content has three clauses the criteria single out, and each must be checked against code rather than written from memory: revocation grounds and no-show consequences against `src/lib/workflow/`, cancellation against `booking.status`, and eligibility against `MIN_AGE_YEARS = 18` in `src/lib/validation/profile.ts`.
- **`<Org />` and friends cannot start a markdown block.** A line beginning `<Org /> is a …` is an MDX parse error (content after a self-closing flow element). Both files were reworded to put text first. Same applies to any component added later.
- `src/mdx-components.tsx` now imports `@/lib/legal/fields` **directly, not through the barrel** — it is reached from a compiled `.mdx`, and `load.ts` imports those modules back.
- Docker Desktop was not running at the start of this session; `pnpm db:up` fails with `npipe:////./pipe/dockerDesktopLinuxEngine` until it is. Started it from `C:\Program Files\Docker\Docker\Docker Desktop.exe`.
- `pnpm start -p 3001` left a listener behind after the task was stopped; `Get-NetTCPConnection -LocalPort 3001` then `Stop-Process` is what cleared `EADDRINUSE`. **A stale server serves the previous build and will happily "confirm" a change you have not deployed** — that is what briefly hid the `localeCookie` fix.

---

### Session 36 — Wave 8 · F26b Screenshots and the contextual deep links (**F26 complete**)

**Date:** 2026-08-22
**Status:** ⚠️ done with deviations. **F26 is complete.**

---

#### What exists

| File | What |
|---|---|
| `public/docs/screenshots/*.png` | **Five real captures**, Arabic, against a production serve. |
| `src/lib/docs/screenshots.ts` | Pure. The registry, with dimensions read off the PNG headers. |
| `src/components/docs/screenshot.tsx` | `next/image` in a `<figure>`; `alt` and `caption` are separate required props. |
| `src/lib/docs/slugs.ts` | `DOC_ANCHORS` and `docAnchorHref` — the sections the app links into, by an id that does not change with the language. |
| `src/mdx-components.tsx` | `<H2 id="…">`, a heading with an explicit anchor. |
| `src/content/docs/{ar,en}/registering-a-drone.mdx` | That heading now carries `id="common-rejection-reasons"` in both languages. |
| `src/components/drones/step-remote-id.tsx` | Links to `docs/remote-id`. |
| `src/components/drones/rejection-notice.tsx` | Links to the common-reasons section. |

**1027 tests** (+8), 1937 catalogue keys, `ar`/`en` in sync. No schema change.

---

#### The thing that was wrong in Session 35's entry

That entry told the next session to link a rejection notice at
`/docs/registering-a-drone#أسباب-الرفض-الشائعة`. **That href was wrong twice over**, and
writing the link is what found it:

1. **The fragment is not what the heading says.** `headingSlug` folds combining marks,
   which folds the hamza, so the real derived anchor was `اسباب-الرفض-الشايعة` — with a
   bare alef and `ئ` reduced to `ي`. The fold is correct and deliberate (Session 35 pinned
   it with a test); an anchor copied from the heading's own spelling is not.
2. **And it could never have been one href anyway.** The fragment is derived from the
   heading's *text*, so the same section is `اسباب-الرفض-الشايعة` on `/ar` and
   `common-rejection-reasons` on `/en`. A component in the app produces one `href`. A
   hardcoded Arabic fragment would have silently landed English readers at the top of the
   page — no error, no failing check, and nobody would notice because the page still
   loads.

**The fix is an explicit id in the content file**, the same string in both languages,
written as `<H2 id="common-rejection-reasons">` because a markdown `##` cannot carry a
prop. `DOC_ANCHORS` is the one place the app names it, and `docs.test.ts` asserts the id
is present in *every* locale's copy of that page — so a reworded heading keeps the link
and a deleted section fails the suite.

Putting the two fragments in the message catalogue was the obvious alternative and is
worse: it would work on the day it was written and rot in silence the first time somebody
reworded the Arabic heading.

There is a test whose whole job is to stop this being undone: it asserts the derived
Arabic and English slugs are **not** equal, so the explicit id cannot start looking
redundant.

---

#### Verified

- **The wizard link, end to end, on screen.** Resumed the existing draft
  (`/ar/drones/new?draft=…`), which reopens at **step 3 of 5, الهوية عن بُعد**; the link
  renders with the locale prefix, and clicking it lands on `/ar/docs/remote-id` with
  `<h1>` = `الهوية عن بُعد`. **No data was created or changed** — an existing draft was
  read, not written, precisely so the check cost nothing.
- **The explicit anchor renders in both locales**: `id="common-rejection-reasons"` and its
  copy-link `href="#common-rejection-reasons"`, identical on `/ar` and `/en`.
- **The app-side crawl**: 22 public pages (landing, the three concept pages, and all 14
  docs routes, both locales), 26 distinct internal hrefs, **every one 200**, and the
  footer's Docs link present on all 22.
- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (1937), `pnpm test` (**1023**),
  `pnpm build` — all pass. Both docs routes still build **dynamic**.

---

#### The screenshots, and the two errors they found

Five, all Arabic, all captured against a `next start` **production** serve so no dev
indicator sits in the corner: the wizard's type step and specifications step, the slot
picker, the zones map, and the airspace decision panel.

**Capture worked on the second attempt, in a genuinely fresh window** — and the diagnosis
from the failed attempt was exact. In the dead window `requestAnimationFrame` **never
fired** and the WebGL centre pixel read `[0,0,0,0]` with the context *not* lost: the tab
was `document.visibilityState === "hidden"`, so nothing was rendering and the compositor
had nothing to hand `Page.captureScreenshot`. In the fresh window the same page reported
`visible`, rAF fired, and both capture and the map worked first time.

**The screenshot pass paid for itself immediately by finding two factual errors in my own
prose**, neither of which any check could see:

1. **Propulsion is on step 1, not step 2.** `docs/registering-a-drone` put "نظام الدفع"
   under المواصفات. It is on النوع, and it is optional. Corrected in both languages.
2. **The serial-number field is on step 2, and only for a commercial build.** The page's
   step-1 table implied it was asked for there. Corrected: the column now reads "is a
   serial number asked for?" and says where, and step 2 states that a self-built or FPV
   aircraft never sees the field at all.

Both are exactly what this feature's own rule exists to prevent — a page sending somebody
to look for a control that is not where it says. **They were found by looking at a picture
of the screen, and by nothing else.**

**What is deliberately not photographed**, recorded so nobody adds it later thinking it
was an oversight:

- **No admin screen.** Every review surface carries a pilot's name, city and history, and
  these pages are public forever.
- **No public scan page.** The only browser that could capture it is signed in as the
  aircraft's **owner**, so the picture would show more than a "what a stranger sees"
  caption claims. The viewer table on `docs/remote-id` is more precise than the picture.
- **No aircraft list, and no booking drone step.** The demo aircraft are named
  `PROBE18B ملغاة`, `PROBE18B مرفوضة` and so on. Presentable demo data is a prerequisite
  for those shots.
- **The decision-panel capture is cropped above the altitude slider** — see thread 77.

`docs.test.ts` covers the two ways a screenshot rots: it **reads the PNG headers back** and
fails if a declared dimension is wrong (a wrong intrinsic size reserves the wrong space and
shifts the page as it loads), and it fails on a file no page shows.

---

#### A third thing the screenshots found: the app makes a claim the docs will not

The airspace panel's altitude control says, in both languages, *"الحد الوطني للارتفاع هو
120 مترًا"* — **the national altitude limit is 120 metres**, stated as fact.

Session 35 removed exactly that claim from `docs/zones-and-rules` and corrected the feature
file, because **no GACA document naming 120 m was ever fetched and read** and
`src/lib/landing/sources.ts` holds no such quotation. So the app asserts something its own
documentation deliberately will not, and a screenshot of that panel would have smuggled the
claim back in through a picture. **The capture is cropped above the slider for that
reason**, and the contradiction is **thread 77** — either the string is sourced and the docs
should say so, or it is not and the string should be softened. Not mine to decide.

---

#### Not done

**The rejection notice has still never been seen on a screen.** No aircraft is in
`rejected` — `PROBE18B مرفوضة` is named for a state it is not in — and putting one there
means a reviewer deciding it, while **every aircraft belongs to the admin**, so four eyes
refuses it. It needs somebody signed in as `alshar55@hotmail.com`. The link is a `Link`
with an `href` from the unit-tested `docAnchorHref`, and the target anchor is confirmed to
render in both locales; **nobody has seen the notice itself**, and this says so.

Its sibling — the drone wizard's link — **was** seen end to end: the existing draft reopens
at step 3, the link renders locale-prefixed, and clicking it lands on `/ar/docs/remote-id`.
No data was created or changed to check it.

---

#### One more thing that looked like a defect and was not

After embedding the images, `img.complete` was `false` and `naturalWidth` was `0` on both
screenshots — while `fetch(img.src)` **from the same page** returned 200 and 22 KB of PNG.
The images were fine. **`loading="lazy"` does not load in a hidden tab**, and the tab had
gone to the background again. Setting `loading = "eager"` loaded it instantly.

**This is thread 67 in its third costume** — after the dead map and the timing-out capture
— and `CLAUDE.md`'s `visibilityState` trap now names all three, with the `eager` flip as
the one-line way to tell it from a genuinely broken image.

**State of the machine at the end of the session:** 3001 is serving **`next dev`**,
restarted **after** the last `pnpm build` — the build clobbers the dev server's `.next` and
the running dev server then serves broken chunks, which is one of the reasons the images
first appeared not to load. Inngest is **not running**. Docker Postgres is up. **No demo
data was created, changed or deleted this session** — the wizard checks read an existing
draft rather than making one.

**Next session should know:**

- **F26 is complete. F27 is next**, and Wave 8 is strictly serial: F30's sitemap reads one
  list of public pages and both docs and legal add to it.
- **F27 should reuse `src/components/landing/source-list.tsx`**, which reads the
  `remoteIdPage` catalogue namespace — not write a second copy of seven translated
  citations.
- **F30 wants `listDocs`**, and `meta.description` was written to serve as the `llms.txt`
  line as well as the index card's.
- **Sort the demo aircraft names** (`PROBE18B *`) before any future screenshot of a list.
- **Two checks still wait on one thing**: thread 64's reviewer 404, and seeing the
  rejection notice. One sign-in as `alshar55@hotmail.com` closes both.

---

### Session 35 — Wave 8 · F26a Help documentation (`/docs`, six pages, ar + en)

**Date:** 2026-08-22
**Status:** ⚠️ done with deviations · **F26 is half done.** F26b is the screenshots, the
two contextual deep links, and the app-side link crawl.

**Six pages a stranger can read without an account**, in both languages, written against
the running app rather than against the plan. Plus the MDX machinery they run on and the
first footer link this project has ever had.

Split a/b with the user before starting: twelve files of real prose *and* a screenshot
session is more than one sitting, and the prose is the half that has to be true.

---

#### What exists

| File | What |
|---|---|
| `src/content/docs/{ar,en}/*.mdx` | Twelve files. Arabic authored first, English translated from it. |
| `src/lib/docs/slugs.ts` | **Pure.** `DOC_SLUGS`, `DocMeta`, `headingSlug`, `textOf`. |
| `src/lib/docs/load.ts` | `loadDoc` / `listDocs` — dynamic `import()` of one locale's `.mdx`. |
| `src/lib/docs/updated.ts` | **`server-only`.** `git log -1 --format=%cI`, mtime fallback. |
| `src/lib/docs/docs.test.ts` | The manifest ↔ file check, and `headingSlug`. **+18 tests → 1019.** |
| `src/mdx-components.tsx` | Element mapping. Two elements do real work — see below. |
| `src/app/[locale]/(public)/docs/{page.tsx,[slug]/page.tsx}` | |
| `src/components/docs/{shell,sidebar,doc-select,callout,last-updated}.tsx` | |
| `src/components/landing/{quotation,source-list}.tsx` | **Lifted out of `/remote-id`'s page**, which now imports them. |
| `next.config.ts` | `withNextIntl(withMDX(nextConfig))`, `remark-gfm`. |

Installed: `@next/mdx`, `@mdx-js/loader`, `@mdx-js/react`, `remark-gfm`, `@types/mdx` (dev).
1935 catalogue keys, `ar`/`en` in sync. **No schema change** — `pnpm db:generate` reported
nothing to migrate.

---

#### Deviations, and why

| Deviation | Why |
|---|---|
| Content lives at **`src/content/docs/`**, not `content/docs/`. | The dynamic import resolves through the `@/*` alias, which is `./src/*`. A sibling `content/` at the repo root would need a second alias for twelve files. |
| **`export const meta = {…}`, not YAML frontmatter.** | MDX has no native frontmatter. Synthesising it needs `remark-frontmatter` + `remark-mdx-frontmatter`, and under Turbopack a plugin must be *named as a string the bundler resolves* — so a local one cannot be passed at all. The ESM export is what those two plugins exist to produce, and it is type-checked where YAML is not. |
| **No `pageExtensions`**, though the Next guide adds `mdx` to it. | That is what makes an `app/**/page.mdx` a route, and this app must never have one: every route lives under `[locale]`, and a page that *is* a markdown file can only be written in one language. |
| **No table of contents**, though `toc.tsx` is in the feature file's Files list. | The `.mdx` sources are compiled into the bundle and are **not readable at runtime in a deployed function**, so a TOC needs either a generated manifest that goes stale or a hand-kept list per file that drifts. Anchored headings — which is what the acceptance criteria actually ask for — need no source at runtime. |
| `src/lib/docs.ts` → **`src/lib/docs/`**. | Same split as `src/lib/geo/` and `src/lib/rate-limit/`: `slugs.ts` must be importable by `mdx-components.tsx` and by a unit test, and `updated.ts` forks `git`. `index.ts` deliberately does **not** re-export `updated.ts`. |
| **`headingSlug` folds the hamza** — `الأصل` and `الاصل` produce the same anchor. | A consequence of dropping combining marks (NFKD splits `أ`), and a welcome one: Arabic is written with the hamza optional in practice, so an anchor that survives the variant spelling is worth more than one that does not. Pinned by a test so nobody "fixes" it. |
| The `zones-and-rules` page **does not name a "120 m GACAR limit"**, which the feature file asked for. | No GACA document stating that figure was ever fetched and read — `src/lib/landing/sources.ts` holds no such quotation, and F16b's research reached Part 107 and Volume 18 only. 120 m is the highest ceiling **we authored** for the Riyadh zones. Attributing it to the regulator would be exactly the borrowed authority the honesty rule bans. Feature file corrected. |
| `Quotation` and the sources list were **lifted out of `/remote-id`'s page** into `src/components/landing/`. | `docs/remote-id` quotes the same seven documents. Two components rendering the same regulator's words with their own markup is the drift that ends with one of them quietly losing its `dir="ltr"` — on the two pages whose entire argument is what the documents say. Same call F16b made for `zone-drawing.tsx`. |
| The `<h1>` is rendered from `meta.title`; **an `#` heading in a content file is a test failure.** | The sidebar, the index card and the page must show one string. A heading typed twice is a heading that drifts. |
| `docs.searchPlaceholder`, the five old page-name keys, and **`nav.help`** were **deleted** from both catalogues. | They were F02 scaffolding naming pages that never existed (`faq`, `forInspectors`). Page titles now come from each `.mdx`. There is no search box — six pages is fewer than a browser's own find handles better. And `nav.help` ("المساعدة") was unused and would have been a second name for the destination the footer calls "الدليل". |
| The footer's one link is a `<nav><ul><li>`. | F27 adds Privacy and Terms beside it, and a list that starts as a bare anchor gets rebuilt as a list the moment it has a second member. |

---

#### The defect that shipped for an hour with every check green

**Markdown tables rendered as literal pipe characters.** MDX parses CommonMark, which has
no tables; `remark-gfm` is not on by default. Eight tables across four pages came out as
paragraphs reading `| النوع | اللون | ماذا يعني |`, and `typecheck`, `lint`, `i18n:check`,
`pnpm build` and 1019 tests were **all green** the whole time. **Thread 11 again**, and
found the same way every previous instance was: by looking at the rendered page — here by
counting `<table>` elements in the HTML, which returned `0`.

The fix is one plugin, but it is one plugin **named as a string**: under Turbopack, remark
and rehype plugins cross into a Rust bundler and a JavaScript function cannot be passed.
That constraint is also why the frontmatter and heading-id plugins were never an option.

Two other things that looked like defects and were not, recorded so a later session does
not re-diagnose them:

- **`git log` on an uncommitted file returns nothing**, so "last updated" is the mtime
  until the first commit touches the file. Both are real dates; neither is invented.
- **An RTL heading beginning with a digit — `## 1 · النوع` — renders correctly.** It looks
  wrong in a low-resolution screenshot, where the digit appears to be on the left. It is
  not: `getBoundingClientRect` on a `Range` over the digit puts it at the heading box's
  right edge, with the Arabic to its left. Six bidi-isolation variants were measured and
  all six agree with the plain text. **Measure before fixing a bidi bug from a
  screenshot** — the `<bdi>` trap and the SVG `text-anchor` trap both cost a session, and
  this one would have cost one for nothing.

---

#### Two elements in `mdx-components.tsx` do real work

- **`a` routes every internal href through `@/i18n/navigation`'s `Link`.** A bare
  `<a href="/docs/remote-id">` drops the locale prefix, so an Arabic reader following a
  link inside an Arabic page lands in English — and **the ESLint rule that normally
  catches this cannot see a markdown link at all**, because in the `.mdx` it is
  `[نص](/docs/remote-id)` and not an import. Proven by getting it wrong first: `a` was
  missing from the components map and the page shipped `href="/zones"`.
- **`code` is `dir="ltr"`.** Every code-like value on these pages is a Latin run inside
  Arabic prose. The `dir` attribute isolates as well as directs, which is what makes it
  safe here and is **not** the same as `dir="ltr"` on a container holding Arabic.

No typography plugin, deliberately: a prose plugin ships `letter-spacing` on headings
(which severs Arabic letter joins — ESLint rule 4, from a place the rule cannot see) and
physical margins on lists (rule 1, same problem).

---

#### Verified over HTTP, both locales, signed out

Every check below ran through `curl` or a same-origin iframe, so no session was carried.

- **All 14 routes 200**, and an unknown slug 404s — on `next dev` **and** on a `next start`
  production serve.
- **Every internal link resolves**: 23 distinct hrefs crawled out of the 14 pages, all 200.
- **All seven cited sources re-fetched** (2026-08-22): three GACA PDFs `application/pdf`,
  four LII pages `text/html`. **A caution worth its own line:** a bare `fetch` to
  `gaca.gov.sa` gets a **200 with a WAF error page** and `content-type: text/html` — it
  looks exactly like a dead link. With browser-shaped headers the same URL returns
  752 KB of PDF. Never conclude a GACA link is dead from a plain fetch.
- **375 px, both locales, all 14 pages**: `body.scrollWidth === clientWidth` (360) and
  `scrollTo(9999, 0)` leaves `scrollX` at 0. Every table sits inside its own
  `overflow-x: auto` box and fits it (328/328) rather than pushing the page sideways.
- **The mobile select navigates** — `/ar/docs/zones-and-rules` → `/ar/docs/booking-a-flight`,
  locale prefix intact.
- **The locale switcher keeps the page** — `/en/docs/booking-a-flight` → `/ar/…`, `dir`
  flips to `rtl`, the `<h1>` becomes `حجز رحلة`.
- **Heading anchors**: 96 headings across the 12 pages, every id unique and non-empty, and
  every anchor's `href` matching its own heading's id. An Arabic fragment loaded **cold**
  resolves and lands 96 px from the top (`scroll-mt-24`).
- **Dark mode** by adding `.dark` by hand (thread 48): tables, callouts and the RTL border
  stripes all legible.
- **Zero console errors** across every page opened.
- `AJN-XXXX-XXXX` inside an Arabic sentence, read at zoom: correct order, comma in the
  right place.
- Honesty greps clean: no payments, no AI, no MCP, no admin URL, no key, no `localhost`.
  The only two matches for "text message" are the sentences that **deny** sending one.
- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (1935), `pnpm test` (**1019**),
  `pnpm build` — all pass. `/[locale]/docs` and `/[locale]/docs/[slug]` build **dynamic**,
  which they must: each reads the session for the header.

---

#### A finding about the app, not about the docs

Writing a page is the app's second review, and one thing did not survive it.

**Two rejection templates promise an upload that does not exist.**
`review.templates.identity_unreadable` and `review.identityTemplates.document_unreadable`
both tell a pilot *"أرفق صورة واضحة للوثيقة"* — attach a clearer photograph of your
document. **There is no identity-document upload anywhere in the app.** F17's profile
wizard collects a document *type*, *number* and *date of birth*, and nothing else; the
reviewer compares typed data. A pilot who receives either message is being told to use a
control that has never been built. **Thread 76**, raised rather than papered over: the
docs page describes that rejection as being about the typed details, which is what the app
actually does, and the templates are F17/F22 copy and somebody's decision to change.

---

**State of the machine at the end of the session:** 3001 is serving the **production
build** (`pnpm start`, PID 28468 at the time of writing), not `next dev` — left that way
deliberately, because **thread 64 needs a production serve** and the code is now built and
running for it. Any session that wants to *edit* must kill that PID first and run
`pnpm dev --port 3001`; `next start` and `next dev` both fail silently onto a port already
held, and the old process keeps answering. Inngest is **not running**; nothing in F26
needs it. Docker Postgres is up.
**F26a is committed and pushed** (`6430ee8` on `main`), so the "last updated" line is now
the **git committer date** rather than the mtime fallback — the production path is
exercised, not just implemented.

**No demo data was changed.** No rows written, no migration, no seed run.

**Next session should know:**

- **F26b is the rest of F26**: real screenshots of the Arabic UI, a `Screenshot`
  component, `public/docs/screenshots/`, the drone wizard's Remote ID step linking to
  `docs/remote-id`, and a rejection notice linking to the common-reasons section.
  **Corrected in Session 36:** the fragment named here was wrong — `headingSlug` folds the
  hamza, and the derived anchor is language-dependent in any case. That section now
  carries an explicit `id="common-rejection-reasons"` in both locales, reached through
  `docAnchorHref`.
- **F30 wants `listDocs`.** The sitemap and `llms.txt` need one list of public pages and
  `src/lib/docs/load.ts` already is it — `meta.description` was written to serve as the
  `llms.txt` line as well as the index card's.
- **`src/components/landing/source-list.tsx` reads the `remoteIdPage` catalogue
  namespace**, not a `docs` one. F27's legal pages will want the same component; give it
  the same treatment rather than a second copy of seven translated citations.
- **Thread 64 is still open** and still needs you: a reviewer 404ing on `/admin/audit`
  while reaching `/admin/analytics`, against a production serve. F26 touched nothing near
  it.

---

### Session 34 — Wave 7 · F25b The audit browser (`/admin/audit`) — **F25 complete, Wave 7 complete**

**Date:** 2026-08-21
**Status:** ⚠️ done with deviations

**The whole log, and the proof that nothing rewrites it.** Admin-only, newest first,
keyset-paginated, nine filters, a field-level before/after diff, an overlay map for the
one diff that is a picture, and a CSV export that writes its own audit row. Plus the
inline trail `/admin/zones/[id]` never had.

**Reused, not rebuilt** (as briefed): `src/lib/analytics/csv.ts` writes the export —
BOM, CRLF, quoting and formula-defusing all F25a's. `ChartCard`/`ChartTable` were not
needed here at all; this screen is a table, not a chart.

---

#### What exists

| File | What |
|---|---|
| `src/lib/admin/audit-filters.ts` | Filters + cursor. **Plain module** — the page, the client date control and the CSV route all parse the identical shape (thread 59). |
| `src/lib/admin/audit-diff.ts` | Pure field-level diff and a **structural** geometry reader. |
| `src/lib/admin/audit-export.ts` | The CSV columns. `getTranslations({ locale })` with the locale passed in (thread 4). |
| `src/lib/data/audit.ts` | `listAuditEvents` (keyset), `listAuditActors`, `listAuditActionCodes`, `listAuditForZone`. `listRecentEvents` **deleted** — it was unused and is what `listAuditEvents` replaces. |
| `src/components/admin/audit/{filters,table,diff-view,geometry-diff-map,geometry-diff-mount,date-filter,entity-timeline}.tsx` | |
| `src/app/[locale]/(admin)/admin/audit/page.tsx` | `requireAdmin()` on the page — `(admin)/layout.tsx` only requires a reviewer. |
| `src/app/api/admin/audit/route.ts` | The audited export. |
| `src/lib/admin/audit-integrity.test.ts` | The append-only grep. |
| + `audit-filters.test.ts`, `audit-diff.test.ts` | |

**1001 tests across 58 files.** 1931 catalogue keys, `ar`/`en` in sync.

---

#### Deviations, and why

| Deviation | Why |
|---|---|
| **`GET /api/admin/audit` writes a row.** A GET that mutates. | The alternative — an action returning a string plus a client component manufacturing an object URL — is more code doing less, breaks middle-click and "save link as", and would write the same row anyway. It is not a mutation a reader can observe: the export is repeatable and each repetition is honestly recorded. Named here rather than hidden. |
| Filters offered are read from **the data** (`selectDistinct`), not from `audit-actions.ts`. | The catalogue lists what this build *can* write; the filter must offer what the table *holds*. An option that can only ever return nothing is a broken control. |
| An unrecognised `?entityType=` becomes **no filter**, not a refusal. | `entityType` is a pg enum; an unknown string reaching `eq()` is a database error. A hand-edited URL must show the unfiltered log, not 500 the one screen whose job is to work when something else has gone wrong. Verified: `?entityType=nonsense` returns page one. |
| `entityId` links to a **filtered view of the log** always; "open record" only for `drone`, `booking`, `zone`, `user`. | `pilot_profile` events carry the *profile* id while `/admin/pilots/[id]` takes a **user** id, and `remote_id`, `zone_closure`, `city`, `drone_report` have no detail route. A link that 404s on an append-only log reads as a fault in the log. |
| Each event renders as **two `<tr>`s** — data, then a full-width `colSpan={5}` row holding the diff. | The boundary diff is a *map*, and a map in the reason cell gets that column's width: **75 px**. Found by measuring the canvas, not from a screenshot — a 75×254 MapLibre canvas looks like a scrollbar. |
| No "previous page" control. | A keyset cursor knows how to go forward; back is what the back button is for, and every page is its own link. |
| `zone.geometry_changed` is named in the CSV's changes column rather than serialised. | Four hundred coordinates in a spreadsheet cell is not information. |

---

#### Four defects found only by opening the page

**1. `<input type="date">` — the rule I broke.** The filter bar's date range shipped as
two native date inputs; the Arabic page drew Chrome's own placeholder as `ةنس/رهش/موي`
— `يوم/شهر/سنة` reversed and unjoined. **Thread 46 already forbids this control** and
`DateSelect` already existed. Before finding that, I tried `dir="ltr"`, then `lang="en"`,
then an inline `style.direction`: `getComputedStyle` reported `direction: rtl` over all
three, because the UA sheet's rule on `input[type=date]` carries `!important` and beats
author styles including inline ones. New `date-filter.tsx` wraps `DateSelect` behind a
hidden input, so the form stays a plain GET and the filtered log stays a link.

**2. Two audited actions have been printing as raw dotted codes** —
`drone.expiry_reminded` and `booking.reminded`. Both are written by Inngest through a
**constant** (`EXPIRY_REMINDER_ACTION`, `BOOKING_REMINDER_ACTION`), and
`audit-actions.test.ts` matched only quoted literals near an `action:`. They had no
label in either catalogue and no screen had ever rendered them; the audit browser
renders everything. Both now labelled, both folded into the drone and booking trails,
and **the scan now also reads `*_ACTION` declarations** — that suffix exists in this
codebase for no other purpose.

**3. The geometry diff map, which took four wrong fixes.** Symptoms in order: correct
polygons on a flat grey ground (the offline fallback, with the tile host answering
perfectly — a convincing impersonation of the `setWorkerUrl` trap in `config.ts`); then
right style, wrong camera; then right camera, no polygons; then nothing at all. What
was actually true:

- The map is inside a `<details>`. **A `ResizeObserver` on the container never fires** —
  a closed `<details>` still reports a box through `getBoundingClientRect`, so there is
  no size *change* on opening, and an observer skips a subtree whose rendering is
  skipped. Replaced with a `toggle` listener on the nearest `<details>`, which also
  means MapLibre is not downloaded until somebody expands a boundary change.
- **`load` never fires on this surface, and `styledata` is worse** — it fires *while* a
  style installs, so a handler gated on `isStyleLoaded()` reads false every time and the
  flag flips afterwards with no further event. `map.on("idle", draw)` is the trigger
  that works; `addBoundary` is idempotent so repeated calls cost nothing.
- The fallback timer tested **`map.loaded()`**, which is false until every tile in view
  has arrived. It fired on a healthy host mid-download and threw away the real style.
  It now tests `isStyleLoaded()` — the question is "can we reach OpenFreeMap", and a
  style that has parsed is a host that answered.

**4. And the one that wasted the most time was not a defect at all.**
`document.visibilityState === "hidden"` for the automation tab. rAF is suspended in a
hidden tab, so MapLibre never renders, never fires `load` or `idle`, and the tile
deadline expires on a perfectly healthy map. **Thread 67 in a new costume**: not "the
screenshot didn't repaint" but "the render loop was never running". Any future session
debugging a map through CDP should check `document.visibilityState` **first** — before
the worker URL, before the style, before anything.

---

#### The integrity criterion

`audit-integrity.test.ts` greps every `.ts`/`.tsx` under `src/` for `.update(auditEvent)`
/ `.delete(auditEvent)`, the relational spellings, and raw SQL against `audit_event`;
and for any *declaration* of `updateAuditEvent`-shaped names. **`src/` only, and the
boundary is the point** — `scripts/probe-*.mts` do delete audit rows to clean up their
own fixtures, and they are not the application. Its first version matched the bare name
anywhere and failed on `data/audit.ts`'s header comment promising the guarantee: a test
that refuses the sentence stating the rule is arguing with itself.

---

#### Verified over HTTP, both locales

Admin session, dev serve on 3001, `ar` and `en`:

- Every filter alone and combined — actor, role, action, entity type, entity id, date
  range, system/people, free text over `reason`. Counts: system-only 5, people-only 50,
  `entityType=zone_closure` 4, `system=no&role=admin&entityType=remote_id` 10, Arabic
  free-text search 1.
- **Cursor pagination: 50 + 20 rows, zero overlap**, compared by id.
- Field-level diff renders (`الرمز — → AJN-7Q4M-31KD`); absent-vs-`null` distinguished.
- **Geometry diff map**: real basemap, Arabic labels (`سدوس`, `العيينة`), old boundary
  dashed, new solid and filled, three layers added, colours through `resolveZoneColors`.
- System events show the **System** badge; `actorRole` is the row's, not a join.
- Zone trail on `/admin/zones/[id]` shows the RUH-P-07 **closure** events — proving the
  zone-id ∪ closure-ids union.
- **CSV export**: 200, `EF BB BF` read off `arrayBuffer()`, CRLF, Arabic reason intact,
  and — **closing thread 73** — `Content-Type: text/csv; charset=utf-8`,
  `Content-Disposition: attachment; filename="ajniha-audit-…csv"`,
  `Cache-Control: private, no-store` all read back from the live response. The export
  wrote its `user.audit_exported` row with the filters, row count and `truncated: false`.
- 1024 px in a same-origin iframe: `body.scrollWidth === clientWidth`, `scrollTo(9999,0)`
  leaves `scrollX` at 0 — no page-level horizontal scroll under RTL (thread 62).
- `tsc --noEmit`, `lint`, `i18n:check`, `test` (1001), `pnpm build` all pass.

**Not verified, and it needs you:** *"a reviewer gets 404 on `/admin/audit` but CAN
reach `/admin/analytics`"* — **thread 64**. `requireAdmin()` is on the page and
independently on the route handler, and `/admin/analytics` calls `requireReviewer()`.

**Addendum, later the same session (2026-08-22).** The second staff account now exists:
the user signed up **`alshar55@hotmail.com`** and promoted it to **reviewer**. So half
the criterion is now done and half is not:

- ✅ **An admin reaches `/admin/audit` on a `next start` serve.** Built, served on 3001,
  page renders — the control case, and it is deliberately against a *production* serve
  because a `next dev` 404 embeds a stack trace naming the guard (thread 16).
- ⬜ **A reviewer 404ing on `/admin/audit` while reaching `/admin/analytics` is still
  unrun.** It needs a reviewer *session*, which means the user signing in; the assistant
  may not enter a password. Thread 64 stays open for that reason alone — the code is
  there, the account is there, nobody has been that reviewer in a browser yet.

Two diagnoses along the way, recorded because each is a plausible wrong turn a later
session could repeat. When the account first appeared absent, **the port-3000 trap
(thread 3) was not the cause** — nothing was listening on 3000, and 3001 served Ajniha —
and **`BETTER_AUTH_URL` was not the cause either** (thread 12): it reads
`http://localhost:3001` and matches the origin. The account simply had not been created
yet. And when the promotion appeared not to take: the role control is a `<select>` **plus
a separate submit button**, and changing the dropdown alone does nothing.

The promotion wrote **two** `user.role_changed` rows for one real change — see **thread
75**, raised from this.

**State of the machine at the end of the session:** 3001 is serving the **production
build**, not `next dev`. Inngest is **not running**. Docker Postgres is up. A next
session must stop 3001 by PID and run `pnpm dev --port 3001` rather than assume dev
survived.

---

#### Demo data changed

Two things were added to the database this session, deliberately, and the next session
should not be surprised by them:

- **One `zone.geometry_changed` event on `RUH-P-20` "حقل تجربة الرسم"** (Abha, archived).
  The diff map had nothing to render — the table held no boundary change at all — and a
  map cannot be verified without one. Chosen because it is archived, is named "drawing
  test field", and the save-confirm panel reported **no upcoming bookings** in it. No
  published zone was touched.
- **Two `user.audit_exported` rows** from testing the export.

Plus **two `user.role_changed` rows** from the promotion in the addendum above. The log
therefore holds ~73 rows, not the 68 the session started with.

---

### Session 33 — Wave 7 · F25a Compliance analytics (`/admin/analytics`)

**Date:** 2026-08-21
**Status:** ⚠️ done with deviations

**The pitch screen.** Six tiles, seven charts, a 7/30/90/all range, and a CSV export —
every number an aggregate query against live rows, nothing precomputed, seeded or
mocked. The headline chart is the product's evidence: over the **all** range this
database reports **80% of issued registrations (4 of 5) are aircraft with no
manufacturer serial number**, drawn as a share rather than asserted in prose.

**The open decision, settled with the user before any chart code:** **hand-rolled SVG,
no charting library, and none installed.** Reasoning is written into
`F25-compliance-analytics.md` so it is not re-litigated; the short version is that two
of the seven forms (histogram, heatmap) have no primitive in any library anyway, and
that server-rendered SVG makes rule 6 hold *by construction* — a library's own tick and
tooltip formatters are a second route to `Intl` that ESLint's ban cannot see. **Six of
the seven charts render entirely on the server.** One `"use client"` module ships:
`chart-hover.tsx`, the shared hover layer.

**Built:**

- `/[locale]/(admin)/admin/analytics` — reviewer-level, dynamic, read-only. Adds the
  **`analytics`** tab to `QueueTabs` (reviewer-level, no count — it is not a queue).
- `GET /api/admin/analytics` — the CSV. A route handler and a plain `<a download>`,
  because a download is a navigation: keyboard, middle-click, "save link as", and a URL
  that can be pasted to a colleague. The **locale travels in the query string** —
  `next/root-params` throws in a route handler (thread 4).
- `src/lib/analytics/` — `queries.ts` (8 aggregates in one `Promise.all`), `range.ts`,
  `buckets.ts`, `scale.ts`, `layout.ts`, `palette.ts`, `labels.ts`, `csv.ts`,
  `export.ts`. Everything but `queries.ts` and `export.ts` is pure and unit-tested.
- `src/components/admin/analytics/` — `chart-card.tsx` (frame + table + legend),
  `chart-axes.tsx`, `chart-hover.tsx`, `stat-tiles.tsx`, `date-range.tsx`,
  `export-csv.tsx`, and the seven charts.
- **The chart palette, validated rather than chosen.** `--chart-1..8`, `--status-good`,
  `--status-critical` and `--seq-1..6` in `globals.css`, both modes, replacing the five
  greyscale `--chart-*` shadcn had left there unused. Run through the `dataviz`
  validator against **this app's own surfaces** (`#ffffff` and the dark card `#12181d`,
  converted from their oklch tokens): lightness band, chroma floor, protan/deutan
  separation and contrast all PASS in both modes; slots 1–3 clear the stricter
  *all-pairs* gate. Three light-mode slots sit below 3:1 — a known, accepted result that
  **obligates a relief channel**, which is why every chart ships direct labels *and* a
  table, and why `ChartTable` is not optional chrome.
- `formatDayMonth`, `formatMonthYear`, `formatPercent` in `format.ts`.
- 64 catalogue keys (**1831**); **973 tests** across 55 files.

**Deviations, each with its reason:**

- **The resolutions chart is public-against-staff, not the spec's "anonymous /
  reviewer".** `remote_id_scan.viewer_level` takes five values and the other three —
  `pilot`, `owner`, `admin` — are 26 of the 30 scans here. Charting two of five would
  draw a total that is not the total, on the one screen whose whole claim is that the
  numbers are real. Feature file corrected.
- **Direct labels live in the legend, not at the end of each series.** Written at the
  ends first, per the spec and the `dataviz` convention, and it did not survive real
  data: two series whose last non-empty bucket is a month apart printed their numbers
  fifteen pixels apart on a three-year axis. A **series total beside its swatch** cannot
  collide, is present even when a series is empty for the whole window, and still binds
  the number to the colour. The histogram and the horizontal bar chart, where collision
  is impossible, label every mark in place. Feature file corrected.
- **The tiles do not follow the date range,** and the page says so in a sentence under
  the control. Five of them are a *current state*, which has no range; the sixth is
  pinned to 30 days by F25 itself. The tile also always prints its **sample size** — a
  median of "3 days" over two decisions and over two hundred are different claims.
- **One chart IS mirrored in Arabic: bookings by zone.** Its x axis is a *count* and its
  y axis a list of names; bars growing away from their own labels are back to front in
  any language. The page states the distinction (a time axis is fixed; reading order is
  not) rather than leaving it looking like an oversight. Mirrored by reflecting each x
  about the box centre, not by `scaleX(-1)`, which would reverse the glyphs too.
- **A sixth `--chart-*` through `--chart-8`, and the shadcn greyscale five overwritten
  rather than left beside a new set.** Five dead tokens named `--chart-*` sitting next
  to the real chart palette is thread 65's trap in a new costume: a name that reads like
  a colour and is not.
- **Bar widths are capped at 44 px** (`MAX_BAR_WIDTH`). A band scale gives one bucket
  the whole plot, and the "all" range drew a single month of decisions as a 200 px slab
  that read as a background rather than a bar.
- **`niceTicks` floors its step at 1.** Every axis here counts things; a maximum of 1 —
  the ordinary case on a young deployment — produced ticks at 0, 0.5 and 1, and the
  axis of the product's most important chart offered to measure half an aircraft.
  **Caught by a unit test, not by the screen.**
- **The utilisation ramp uses as many steps as there are values to tell apart.** Six
  shades over a maximum of one is six shades that all mean "1" — and the legend printed
  that number six times.
- **`getApprovalOutcomes` reads `audit_event`, not `drone.status`.** A drone approved in
  March and revoked in August has `status = 'revoked'` today; counting current status
  would erase March's approval. The audit trail records the decision as it was made,
  which is what an outcomes chart asks about.
- **`decided_at >= submitted_at` on the median and the histogram, and it is load-bearing.**
  `submitted_at` is rewritten on resubmission while `decided_at` still holds the previous
  decision, so a resubmitted aircraft carries a **negative** interval — this database has
  one right now, at −0.6 hours. Without the predicate it drags the median down and puts a
  bar to the left of zero, and nothing about either would look wrong.
- **The no-show denominator is `completed + no_show` only.** Including `cancelled` would
  count a pilot who cancelled in advance as a compliance failure; including `approved`
  would count every future flight as attended. Buckets with no denominator are drawn as
  a **gap in the line**, not a zero.
- **This CSV export is not audited.** F25's audited export is F25b's — a full dump of who
  decided what and why. This one is aggregate counts with no personal data in it at all,
  and auditing every bar-chart download would bury the exports that matter.

**Four defects found by opening the page, none visible to any check we run — thread 11
again, and the RTL one is new to this build.**

1. **SVG `text-anchor` is direction-relative, so every y-axis tick was anchored
   backwards in Arabic** and printed into the plot area. `end` means "end of the inline
   base direction", which on an RTL page is the **left** edge. Found by reading the
   labels' `getBoundingClientRect()` out of the page — at chart scale a six-pixel
   numeral's overhang is not obvious in a screenshot. `anchorAtMinX` / `anchorAtMaxX` in
   `layout.ts` now say what they mean. **`dir="ltr"` on the SVG is not the fix**: it
   repairs the anchors and simultaneously reorders every Arabic date label on the
   category axis, which is the `SlotTime` trap. Zone-bar had the same bug twice over —
   written as `rtl ? "start" : "end"`, which flipped it a second time and printed every
   zone name on top of its own bar.
2. **The heatmap's hour axis ran 23 → 0.** It is a CSS grid and inherited the page's
   RTL flow, so the one chart where the page's own promise is most visible was the one
   breaking it. `dir="ltr"` on the grid — here the container's job *is* geometry — with
   the page's direction restored on every element under it that carries words.
3. **The headline chart rendered no direct label at all.** The label sat on the last
   bucket, and nothing is registered *today* on most days, so every band was empty
   there. Superseded by the legend-total fix above.
4. **X-axis labels collided at the right-hand end.** `thinLabels`' regular stride and
   its always-kept final index did not know about each other; 39 monthly buckets picked
   both 36 and 38, and `أغسطس 2026` printed on top of `يونيو 2026`. Now pinned by
   `chart-axes.test.ts`.

Also fixed, beyond F25a: **four hard-coded Arabic-Indic `٣٠`s in `messages/ar.json`** —
two mine, **two pre-existing in F24's `lookup.revealsWindow*`**. A literal `٣٠` in a
catalogue string walks straight past `format.ts`, which is the one thing that file
exists to prevent, and it sat next to a tile printing `30 يومًا` through `formatDays`.
The whole `ar` catalogue is now clean of Arabic-Indic digits.

**Verified — in Chrome, over HTTP, both locales:**

| Criterion | Result |
|---|---|
| Every tile and chart from a live query, nothing mocked | OK — `queries.ts` is the only source; the page and the CSV call the *same* `getAnalytics` |
| Build-type split first and largest, showing the serial-less share | OK — `HEADLINE`'s taller box, the only `text-lg` heading, **80% (4 of 5)** over "all" |
| Median turnaround matches a hand check | OK — **97 days**. Two decisions inside 30 days, at 4,584 h and 93.6 h; `percentile_cont` interpolates to 2,338.8 h = 97.5 d. The resubmitted drone's −0.6 h row is correctly excluded |
| All seven charts render with real data | OK — in `ar` and `en`, at 7 / 30 / 90 / all |
| One shared palette; `self_built` the same colour everywhere | OK — asserted in `palette.test.ts`, plus "no colour carries two meanings on this page" and "no status colour is also a slot" |
| Legible in light **and** dark | OK — dark verified by stamping `.dark` on `<html>` and screenshotting; the dark hexes are a separately validated set, and the sequential ramp **inverts** rather than lightening |
| Distinguishable in greyscale | OK by construction — the palette passed protan/deutan ΔE, and every series carries a written label beside its swatch |
| Arabic axis labels and tooltips, right-aligned; Latin numerals; Gregorian dates | OK — `يونيو 2023 … أغسطس 2026`; the tooltip reads `فبراير 2026 — تجارية 0، مصنّعة ذاتياً 1، FPV 0`, which matches the row in `drone` |
| The time axis is **not** reversed in RTL, and the page says why | OK — two sentences under the range control, naming the bookings-by-zone exception |
| Date range switching updates every chart | OK — and it is four **links**, so a range is bookmarkable and the back button works |
| CSV opens in Excel with Arabic intact | OK — first three bytes `EF BB BF`, CRLF endings, `الثمامة` unescaped. **Note for whoever re-checks this: `Response.text()` strips the BOM per the encoding spec**, so `charCodeAt(0) === 0xFEFF` reports `false` on a file that has one. Read `arrayBuffer()` |
| A field containing a comma survives | OK — `"2,339 ساعة"` quoted; formula-injection prefixes are defused and tested |
| **Empty database: every chart a purposeful empty state, not a broken axis** | OK — verified for real. `pg_dump`ed `app` into a throwaway `app_empty`, truncated the domain tables (keeping the one account so the page could be reached), pointed `.env` at it, restarted dev, and screenshotted: seven dashed empty boxes with sentences, **no axis drawn at all**, tiles at 0 and the median tile a dash reading *"لا قرارات خلال 30 يومًا"*. CSV still 200 with its BOM. **`app_empty` dropped, `.env` restored byte-identical, `app` confirmed untouched** (7 drones, 4 bookings, 68 audit events, 13 zones, 30 scans, 3 closures) |
| Long Arabic zone names do not overflow or truncate mid-word | OK — `نطاق مطار الملك خالد الدولي` fits its own row; the 200 px label margin is why the form is horizontal |
| Tables readable at 1024 px | OK — measured in a 1024 px same-origin frame: `body.scrollWidth === clientWidth` (1009) and `scrollX` still 0 after `scrollTo(9999, 0)`, which is thread 62's trustworthy pair. Wide charts scroll **inside their own card**, never the page |
| Hover layer works in both directions | OK — the overlay measures to exactly `box.start`/`plotWidth` (44 / 560) under RTL too, and the tooltip names the right bucket in both locales |
| No raw catalogue keys in either language | OK — zero matches for `analytics.*` / `review.*` / `drones.*` in the rendered text |
| Console | OK — **zero errors** in both locales; only HMR and React-devtools notices |
| Signed out | OK — the page 307s to sign-in; the CSV route answers **404 with an empty body**, no guard named |

- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (**1831**), `pnpm test` (**973**),
  `pnpm build` — all green. **Both new routes build `ƒ` (dynamic)**, which they must.
  **No schema change**; `pnpm db:generate` reported *"No schema changes, nothing to
  migrate"*.
- **`pnpm build` clobbers dev's `.next` as warned.** Dev was stopped by PID and
  restarted with `pnpm dev --port 3001` afterwards; Inngest re-registered
  (`PUT /api/inngest 200`).

**Not verified:**

- **A reviewer who is not an admin opening this page**, and a **pilot** getting a 404
  from it. **Thread 64** — still one account. The guard is `requireReviewer()`, the same
  one F24 drove against a real probe pilot account over HTTP, so the *mechanism* is
  proven; this route's use of it is not. F25b needs the second account anyway, for the
  reviewer-gets-404-on-`/admin/audit` half.
- **The CSV response headers.** Status and body bytes were read from a live response;
  `Content-Type`, `Content-Disposition` and `Cache-Control` were **not** — the browser
  extension blocks reading response headers, and they are literals in the route. Nothing
  has confirmed the filename a browser actually saves.
- **Excel itself.** The BOM, the CRLFs and the quoting are verified as bytes; no
  spreadsheet has opened the file.
- **A chart with enough series to exercise slots 4–8 adjacently**, and any chart with
  more than three simultaneous categorical series.
- **Volume.** Every chart here is drawn from single-digit data. Nothing has been seen at
  a hundred buckets or eight zones, so label thinning and the zone cap are exercised by
  unit test and by reasoning, not by a full screen.

**Next session should know:**

- **F25b is the last feature in Wave 7**, and the two estimate corrections from the split
  still hold: `/admin/zones/[id]` is the only page missing an inline `AuditTrail`, and the
  **geometry diff map** is the second MapLibre surface and carries every F20 trap
  (`setRTLTextPlugin` once, `setWorkerUrl` before the worker pool, `ensureRtlTextPlugin`
  rather than `new Map()`, and **click the canvas before believing a blank screenshot**).
- **F25b reuses three things F25a built** and should not rebuild them: `csv.ts` (BOM,
  CRLF, quoting, formula defusing — all tested), `date-range.tsx`, and `ChartCard` /
  `ChartTable`. The audited export differs from this one only in writing its audit event.
- **`src/lib/analytics/layout.ts` now owns the RTL text-anchoring rule.** Anything that
  draws SVG text on an Arabic page goes through `anchorAtMinX` / `anchorAtMaxX` — the
  geometry-diff map's own labels included.
- **The demo content is intact and is still F25b's material**: F23c's published closure
  on RUH-P-07 for 10 September 2026, the city of Tabuk, and F24's 21 `remote_id.lookup`
  events plus the one identity reveal on `AJN-7Q4M-31KD`. 68 `audit_event` rows in total.

---

### Session 32 — Wave 7 · F24 Remote ID lookup and identity reveal (**F24 complete**)

**Date:** 2026-08-20
**Status:** ⚠️ done with deviations

**The enforcement half of the Remote ID proposition.** Every reveal, redaction and scan-log mechanism this feature needed already existed — F11 built the masking and the code-keyed reveal, F22a the profile-keyed one. What did not exist was the surface an officer standing beside an aircraft actually uses, and the accountability that makes it usable at all: **every search is now written to the audit trail, and an administrator can read who searched for what.**

**Built:**

- `/[locale]/(admin)/admin/lookup` — one box, reviewer-level. Renders no data server-side and takes **no `searchParams`**; every result arrives through a POST, because a lookup term may be a national ID.
- `/[locale]/(admin)/admin/reveals` — **admin only.** Every identity reveal with reviewer, reason and timestamp, a per-reviewer rolling 30-day count ordered highest first, and a reviewer filter that *is* a GET (a staff user id is not a member of the public's personal data).
- `src/lib/lookup/detect.ts` — pure. Six kinds behind one box, code-first.
- `src/lib/lookup/search.ts` — the queries. Session first, reviewer-guarded, and **a candidate carries no owner identity at all.**
- `src/lib/lookup/authorisation.ts` — pure. `flightAuthorisationOf`, the one-word answer.
- `src/lib/actions/lookup.ts` — `lookupAction`, `openCandidateAction`.
- `src/components/admin/lookup/{search-bar,qr-scan-button,result-card,disambiguation-list,reveal-dialog,recent-lookups}.tsx`.
- `src/components/proposal-notice.tsx` — see the cross-cutting defect below.
- `listIdentityReveals` / `countRevealsByReviewer` in `src/lib/data/audit.ts`; `listAuditForDrone` exported from `src/lib/data/review.ts`; a `lookup` tab in `QueueTabs`; `USER_TRAIL_ACTIONS` in `audit-actions.ts`.
- `scripts/probe-authorised-now.mts` — throwaway, documented, and **already cleaned**.
- 54 catalogue keys (**1765**); **898 tests** across 50 files.

**Deviations, each with its reason:**

- **`revealIdentity` and `reportUnregistered` are not in `src/lib/actions/lookup.ts`.** F24's spec puts them there; `revealIdentityAction` and `reportDroneAction` already exist in `src/lib/actions/remote-id.ts`, keyed on a code, which is exactly the shape this page needs. A second reveal path would be a second place the "write the audit event *before* returning" discipline has to be right, and the entire value of that discipline is that it lives in one function. `ReportDialog` gained an optional `openLabel` so the same component can say *"report an unregistered drone"* here — one call site for an action whose "the code need not resolve" behaviour is the subtle part.
- **A sixth query kind, `module_serial`**, beyond the spec's five audited types. It is cleanly detectable (a digit, no whitespace) and telling a reviewer their module serial was read as "a name" would be a lie on screen.
- **`remote_id.lookup` is filed against `entityType: "user"` with the reviewer's own id.** A search that resolved to nothing has no other entity to hang on — and those are precisely the searches worth being able to see. It appears on no aircraft's trail; `USER_TRAIL_ACTIONS` exists so F25's audit browser can name it and so the source scan does not fail.
- **The audit row carries `{ queryType, resultCount }` and nothing else**, and `echoOf` returns **`""`** for a national ID or a mobile number so neither can reach `drone_report.reportedCode` through the "report unregistered" flow either.
- **The classifier is decisive, and the screen says how it read the term** — with a control to re-run it the other way. The Crockford alphabet is ordinary Latin, so `Alshehri` normalises to the valid code `AJN-A1SH-EHR1`. Code-first is correct on a page whose common case is a sticker; the alternative (demanding a digit) would refuse about one real code in twenty typed without its prefix. **The collision is asserted in a test** so a future "fix" to the ordering sees the escape hatch it is about to strand.
- **`resolveRemoteId` is called for the single-match case**, not a bespoke select — so a reviewer's lookup writes a `remote_id_scan` row like any other resolution, which is what a subsequent reveal attaches itself to.
- **`useSyncExternalStore`, not `useState` + `useEffect`**, for the recent-lookups list and for `BarcodeDetector` detection. `react-hooks/set-state-in-effect` rejects the obvious version and is right to; both are readings of an external system with a distinct server snapshot.
- **Recent lookups store resolved *codes* only** — never a name, a mobile or a national ID. `sessionStorage`, not `localStorage`: a shared or confiscated phone must not carry a list of the people a reviewer looked for.

**Two defects fixed beyond F24, both found by opening the page.**

1. **A duplicate React key on the declared-modules list** — the key was `kind` plus `moduleSerial ?? index`. `remote_id_declaration` is a **history table**: re-declaring the same hardware writes a second row with the same kind *and* the same serial, so the key collides in the ordinary case. Seven console errors on `/admin/lookup`, and **the identical expression was in F11's `scan-result.tsx`** — the public scan page, with the same data. Both now carry the index unconditionally.
2. **The GACA disclaimer was clipped on every narrow screen, on all ten surfaces that show it.** `Badge` is `h-5 overflow-hidden whitespace-nowrap`; every call site added `whitespace-normal`, which wraps the sentence and then has its second line clipped away. On a desktop it fits on one line and nothing looks wrong — **it only failed below about 640 px**, which is a phone, which is where a field inspector opens `/rid/[code]` and where somebody signs up. Now one `ProposalNotice` component with `h-auto`, at all nine page call sites plus two other multi-line badges. `lint`, `typecheck`, `build` and 894 tests were green throughout. **Thread 11 again, and the closest it has come to breaking an honesty constraint.**

**One rule-10 correction, in F11's code, found by driving it.** `revealIdentityAction` guarded with `requireReviewer()`, which **throws `notFound()`**. The guard worked — a pilot POSTing it got a 404 and no identity — but rule 10 says a refusal is never an exception, and a thrown 404 inside a `startTransition` reaches the caller as an error boundary rather than a message. Both it and `lookupAction` now read the session and `return refuse("not_found")`, matching `searchPilotsAction`. Verified against a production serve, below.

**Verified — in Chrome, over HTTP, both locales:**

| Criterion | Result |
|---|---|
| `AJN-4F2K-91XZ` / `ajn 4f2k 91xz` / `AJN4F2K91XZ` are one code | OK — plus `AJN_4F2K_91XZ` and the bare 8 symbols, in `detect.test.ts` |
| A misread `O`/`I`/`L`/`U` still resolves | OK — `AJN-7Q4M-3IKD` opened the record in the browser |
| The last 4 symbols return candidates | OK — `31KD`; and **`M-31`, spanning the group dash**, resolved too (the dashes are stripped from the column) |
| A module serial finds the drone | OK — `RID-MOD-88421` → `AJN-7Q4M-31KD` |
| A 10-digit national ID finds the pilot **via the hash** | OK — 5 candidates; `hashIdDocument`, no `ilike` over documents (mutation-tested) |
| `+9665…` finds the pilot by mobile | OK — and the `05…`, `966…` and `00966…` spellings, and **Arabic-Indic digits** |
| A partial name finds pilots in Arabic and English | OK — `الشهري` → 5 candidates |
| Detection is code-first and does not misclassify a code | OK — and the one genuine collision is documented and given an escape hatch |
| Results render through `redactRemoteId`; no bespoke select | OK — **and it is now a test**, not a grep: the candidate projection carries no identity column, and the action reaches `resolveRemoteId` and nothing else. Both mutation-checked |
| The national ID is masked until revealed | OK — five bullets and the last four digits on the page; the whole number only after the reveal |
| "Authorised right now?" is one prominent yes/no with zone and slot | OK — **Yes** with الثمامة and its window, in `ar` and `en`; **No** the moment the slot ended |
| The same drone outside its slot reads no | OK — *"the registration is valid, but no approved booking covers this moment"*, distinct from the not-registered wording |
| Several candidates show a list with **no owner identity** | OK — 5 rows: code, make, model, city, build, weight, status, and nothing about a person until one is opened |
| No result is explicit, with a report action | OK — `AJN-0000-0000` → *"no registration found"* + **report an unregistered drone** |
| An expired registration reads *expired* | OK — `تسجيل منتهٍ` on the candidate list, beside a revoked and three valid ones |
| Reveal without a reason is refused; with one it returns the identity | OK — the control is disabled under 10 characters **and the action refuses independently** (`reveal_reason_required`, proven over HTTP) |
| **Forcing the audit write to fail makes the reveal fail** | OK — a `BEFORE INSERT` trigger raising on `remote_id.identity_revealed`: the page answered *"the reveal could not be logged"*, the ID stayed masked, **`revealed_identity` stayed `false`** and `audit_event` was unchanged. Trigger removed |
| The reveal dialog states the action is logged | OK — before it is performed, and in the past tense after |
| Every search writes an audit event, **including one with no results** | OK — `queryType: "code"`, `resultCount: 0` |
| Audit events carry the **type** and no raw ID or mobile | OK — the whole table scanned for the number and the mobile: the only hit is **F17's `pilot_profile.contact_updated`**, which records a contact change and is meant to. Nothing F24 writes carries either |
| `/admin/reveals` lists every reveal with reviewer, reason, timestamp | OK — **both kinds**, code-keyed and profile-keyed, with a 30-day count of 2 and a working reviewer filter |
| Reveals are rate-limited at 20/hour | OK — refused at the 20th call in the window. Driven with a **too-short reason**, since the limiter runs before the reason check: 22 calls, **zero audit events and zero reveals** |
| The QR button degrades rather than breaking | OK — Chrome on Windows has **no `BarcodeDetector`** and the button is simply absent; stubbing one in makes a 48 px button appear |
| Usable one-handed at 375 px in Arabic RTL | OK — measured in a 371 px same-origin frame with the full result rendered: `body.scrollWidth === clientWidth`, `scrollX` still 0 after a real scroll attempt, **nothing overflowing**. Two 28 px ghost controls were raised to 44 px |
| No raw catalogue keys in either language | OK — and the pilot's Arabic aircraft name and manufacturer stay Arabic under `/en` |
| Console | OK — **zero errors** after the duplicate-key fix (it was seven) |

**Verified against a production serve (`next start`, port 3002) — thread 16's rule:**

| Criterion | Result |
|---|---|
| A **pilot** gets 404 on `/ar/admin/lookup`, `/en/admin/lookup`, `/ar/admin/reveals` | OK with a real probe pilot account — **no guard named**, no registration or identity data in the body |
| A pilot POSTing `lookupAction` directly | OK — `not_found`, never `forbidden` |
| A pilot POSTing `revealIdentityAction` directly | OK — `not_found`, and **not a single identity field in the response** |
| Signed out | `lookupAction` → `not_authenticated`; the proxy 307s the page to sign-in |
| A **reviewer** can look up | OK — the probe account was promoted to `reviewer` and `lookupAction` answered `ok: true` |
| `/admin/reveals` is **admin-only** | OK — 404 for the reviewer in both locales, **and the link to it is not drawn for them** (`isAdmin` on the page) |
| A reviewer's reveal is refused without a reason | OK — `reveal_reason_required`, straight at the action |

- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (**1765**), `pnpm test` (**898**), `pnpm build` — all green. Both routes build **dynamic**, which they must. **No schema change**; `pnpm db:generate` reported nothing to migrate.
- **Three mutations run, all three caught**: an identity column added to the candidate projection; `getRemoteIdRecordByCode` imported into the action; and the eight-letter-name collision.
- The probe pilot account was **deleted** (`user` is back to the one admin row) along with its `rate_limit_bucket` rows, and the probe booking removed.

**A caution about the production probe, for whoever repeats it.** `next start` on a port that is already listening **fails and leaves the old process serving**, and the failure is only in the log. Two rounds of "the fix did not take effect" were that, not the fix. Kill the listener by PID first, and check `Ready in …` before trusting a result.

**Not verified:**

- **The camera path.** `BarcodeDetector` does not exist in Chrome on Windows, so the *absence* branch is proven and the decode loop is not. It needs Chrome on Android or macOS.
- **A reviewer who is not an admin using the reveal in the browser.** Proven over HTTP only; the probe account was deleted afterwards. **Thread 64 is still open** — four eyes is also why `/admin/bookings/[id]` offers this build's single account no decision at all, which is how the "yes, authorised" case came to need a probe.
- **A second reviewer's rows on `/admin/reveals`.** The per-reviewer count is a list of one.
- **Dark mode**, and the disambiguation list beyond five candidates.

**Left in the database as demo content** (in addition to F23c's closure on RUH-P-07 and the city of Tabuk): **21 `remote_id.lookup` audit events and one `remote_id.identity_revealed`** on `AJN-7Q4M-31KD`, all genuinely performed by the admin through the UI during this session. They are what `/admin/reveals` and F25's audit browser will render.

**Next session should know:**

- **F25 is the last of Wave 7, and it is split a/b — settled with the user after F24 was
  committed, recorded at the top of `F25-compliance-analytics.md`.** **F25a** is
  `/admin/analytics`: the tiles, all seven charts, the date range and the CSV export.
  **F25b** is `/admin/audit`: cursor pagination, the filters, the field-level diff, the
  geometry diff map and the integrity grep. Nothing in a points at a route b builds.
- **F25a owns an open decision: there is no charting library installed.** No `recharts`,
  no `d3`, nothing — checked against `package.json` at the split. Choose one (current
  stable, no version number written anywhere) or hand-roll SVG the way F16a's landing page
  already draws the twelve seeded polygons. **Settle it with the user before writing chart
  code**, and load the `dataviz` skill first.
- **F25b is smaller than its spec reads.** `AuditTrail` (F22a) is already inline on
  `/admin/drones/[id]`, `/admin/bookings/[id]` and `/admin/pilots/[id]` — **only
  `/admin/zones/[id]` is missing one.** And `USER_TRAIL_ACTIONS` plus `hasTrailLabel` are
  ready: the audit browser is the first screen to render all five trail lists at once,
  which is exactly what `audit-actions.test.ts` exists to make safe. `remote_id.lookup` is
  the first action written against a `user` entity that a screen will show.
- **F25b's geometry diff map is the second MapLibre surface in the build** and inherits
  every trap F20 paid for: `setRTLTextPlugin` once, `setWorkerUrl` before the worker pool
  is touched, `ensureRtlTextPlugin` rather than a bare `new Map()` — and a blank map in a
  screenshot is usually not a blank map, so click the canvas first.
- **`ProposalNotice` is the only way to render the GACA disclaimer.** Ten hand-written copies were the bug; do not write an eleventh.
- **`Badge` is `h-5 overflow-hidden`.** Any badge whose text can wrap needs `h-auto py-1`, or the second line is silently clipped below `sm`.
- **`scripts/probe-authorised-now.mts` exists** for re-creating the "authorised right now" render. Run it, look, then run it with `clean`.
- **The 375 px technique that works on this machine**: the browser tool's `resize_window` does not change `innerWidth` here. A **same-origin `<iframe>` sized to 375 px** does — media queries and all — and `body.scrollWidth === clientWidth` plus a real scroll attempt inside it is the assertion. Never `documentElement.scrollWidth` (thread 44).
- **The dev server on 3001 and the Inngest CLI on :8288 were both stopped at the end of this session.** Restart with `pnpm dev --port 3001` and `npx inngest-cli@latest dev -u http://localhost:3001/api/inngest`.

---

### Session 31 — Wave 7 · F23c Closures, the cancellation fan-out and `/admin/cities` (**F23 complete**)

**Date:** 2026-08-20
**Status:** ⚠️ done with deviations · **F23 is complete.** Wave 7 continues with F24 (Remote ID lookup) and F25 (analytics).

**Inngest ran on this machine for the first time — and so `closure-fanout` ran.** `npx inngest-cli@latest dev -u http://localhost:3001/api/inngest` connected the `ajniha` app with **11 functions**, and a closure published from the browser cancelled a real booking end to end: `booking.cancelled_by_closure` with `actorIsSystem`, a `zoneClosed` notification carrying **both** languages as params, a `booking-cancelled-by-authority` email rendered and logged, and a `closure-fanout` row in `job` with status `completed`. **Thread 68 is closed.** Nothing about `zone-suspended.ts` was re-run, but the wall it was behind is gone: an Inngest dev server is now a documented one-line command away.

**A closure is written in two acts, and that is the feature.** `createZoneClosure` saves a row with `published_at` null — invisible to the engine, refusing nothing, cancelling nobody. `publishZoneClosure` stamps the date once and the action sends the event afterwards. The reason the seam exists: the acceptance criterion is *"previews exactly which bookings it will cancel, with pilot names, **before** publishing"*, and a one-shot create would make that preview a prediction about a row that does not exist yet rather than a statement about one that does. The preview is shown twice — in the form, and again on the unpublished row inside the publish confirmation.

**The preview is the fan-out's own query, and the probe asserts it.** `listBookingsInClosureWindow` and `listBookingsOverlapping` are two functions in two files, and the whole value of the preview is that they cannot disagree. `probe-zone-closures.mts` seeds three bookings — one inside the window, one ending exactly when it starts, one starting exactly when it ends — and asserts both return the identical set. Half-open: adjacent is not overlapping. A preview that under-reported by one row would have an admin confirm against a list that omits somebody whose flight is about to be cancelled.

**Built:**

- `src/lib/validation/zone-closure.ts` + tests — `closureInstant` (Riyadh civil date + typed `HH:mm` → instant, through `riyadhInstant`, so a closure edge and a slot edge cannot land a millisecond apart), `validateClosure`, and `closureOverlaps` / `overlappingClosures`.
- `src/lib/validation/city.ts` + tests — the three-letter code, both names, and the centroid **bounds check against Saudi Arabia**, whose one real job is catching a swapped `lat`/`lng`.
- `src/lib/workflow/zone.ts` grew `createZoneClosure`, `publishZoneClosure`, `withdrawZoneClosure`.
- `src/lib/data/zone-admin.ts` grew `listZoneClosures`, `getZoneClosureForAdmin`, `listBookingsInClosureWindow`, `listCitiesWithZoneCounts`.
- `src/lib/actions/admin.ts` grew `createZoneClosureAction`, `publishZoneClosureAction`, `withdrawZoneClosureAction`, `previewClosureImpactAction`, `createCityAction`.
- `/[locale]/(admin)/admin/zones/[id]/closures` and `/[locale]/(admin)/admin/cities`, with `closure-form.tsx`, `closure-list.tsx`, `impact-table.tsx` and `city-form.tsx`.
- `scripts/probe-zone-closures.mts` — 23 checks against a real database, every row deleted afterwards.
- 26 new pure tests (**857 total**), and three deliberate mutations each proven to fail: making `closureOverlaps` closed rather than half-open → 2 failures; allowing a zero-length window → 3; letting a blank coordinate through as `Number("") === 0` → 1. All reverted.

**Three decisions worth their reasons:**

1. **A published closure cannot be deleted.** Publishing cancels flights and emails pilots; removing the row afterwards would reopen the airspace while leaving every cancellation standing and erasing the only record of why they happened. `withdrawZoneClosure` refuses with `closure_published`, and the list draws no control for it. **Lifting a closure already in force is not built** — it is a different act with different consequences (does it un-cancel? it cannot) and nothing in F23 asked for it. Named here rather than half-built.
2. **A closure over a `draft` or `archived` zone is refused.** Either would be a row that can never refuse anything, and an audit trail with acts in it that did nothing is harder to read than one without them.
3. **Ninety days is where "temporary" stops.** A longer closure is not a NOTAM, it is a change of mind about the zone — and the honest way to say that is to suspend the zone, which is reversible and tells every pilot why. The refusal says exactly that.

**`isModelled` is deliberately not on the city form.** It claims a city carries authored airspace, and creating a row does not make that true. The cities table shows a **zone count** beside the flag instead, which is what makes the claim checkable. Nothing edits or deletes a city either: a city is referenced by every zone drawn in it, and renaming one silently rewrites the name on a published map and in every booking confirmation already sent.

**Two defects found by looking at the screen, not by any check** — thread 11's tally goes on:

1. **`zoneAdmin.closureReasonHint` printed as a raw key** under both reason boxes. The message takes `{min}` and the call site passed nothing; next-intl raises `FORMATTING_ERROR` and renders the whole dotted path. `typecheck`, `lint`, `i18n:check` and 857 tests were all green — `i18n:check` compares placeholders **between catalogues**, and both had `{min}`, so it was consistent and wrong. Thread 60's shape, and the console carried the error the whole time.
2. **`ستُلغى 1 رحلات`** on the confirmation an admin reads before cancelling somebody's flight. Arabic has six plural categories and the message hard-coded one. Fixed by selecting on a numeric `n` that is never printed while the **formatted** `count` string is what appears — thread 22 forbids a bare numeric ICU argument, which would render Arabic-Indic digits. `zoneAdmin.impactCount` (F23b's) had the same defect and was fixed with it. **`zoneAdmin.previewCount` and any other `{count}` message still hard-code a plural** — thread 72.

**Deviations and things not done:**

- **No schema change.** `zone_closure` and the `city` and `zone_closure` audit entity types were already in the schema from F03. `pnpm db:generate` reports nothing to migrate. **25 tables.**
- **`suspendZone` checked only the English reason.** Twenty characters were required of the English and nothing of the Arabic — the panel disables its button until both are long enough, so nothing on screen could reach it, but an action is an ordinary POST and a suspension with a blank Arabic reason would quote an empty string to every Arabic-reading pilot. Now both. F23b's, fixed here.
- **`data/zone.ts`'s `listClosures` did not filter `published_at`.** It had no caller, so nothing was wrong yet — but it is the *pilot-facing* reader, and the first caller would have announced closures nobody published. It now filters, matching `listClosuresForZones` beside it. The probe asserts both directions.
- **`ImpactTable` was extracted from `lifecycle-panel.tsx`** rather than copied — three surfaces need "whose flights does this touch, by name" and three tables would drift in what they omit.
- **One published closure and one city are left in the database as demo content**: `RUH-P-07` closed 17:00–20:00 on 10 September 2026 (a security exercise, with its authority reference and its trail), and **Tabuk**, added through the form. Both were created through the real path. The probe booking that the fan-out cancelled was seeded by SQL and **deleted afterwards**, along with its audit event, notification and `email_log` row.
- **The pilot's booking page shows the cancellation reason in Arabic to an English reader.** `booking.cancellationReason` is one column and holds the authored language by design; the *email* quotes the pilot's own. Seen on `/en/bookings/[id]`. Thread 71.
- **The reviewer-404 half is still unrun** — thread 64, one account. What *was* run: all five new actions POSTed directly with a **forged cookie**, every one answering `not_authenticated` and writing nothing (no city row appeared), and a cookieless POST redirected by the proxy with no data in the body.

**Next:** F24 — Remote ID lookup and identity reveal.

---

### Session 30 — Wave 7 · F23b The operating-hours grid, the live slot preview and the publish lifecycle

**Date:** 2026-08-20
**Status:** ⚠️ done with deviations · **F23b complete.** F23c (closures, cities) is what remains of F23.

**The zone became the workflow's third entity.** Rule 11 says no status is written outside `src/lib/workflow/`, and a zone's status is a status — so `apply.ts` learned to lock and write a `zone` row alongside a drone and a booking, and `transitions.ts` gained `zone.published`, `zone.suspended` and `zone.archived`. **A zone has no owner**: `lockRow` returns `ownerUserId: null` for one, which is what makes `actorKindsFor` never award `owner` on that entity — both sides must be present, deliberately. `createdByUserId` records who drew a zone; it grants them nothing.

**Publishing is where two long-standing threads got their answer.**

- **Threads 37 and 55** — a booking names a zone and carries no coordinate, so `createBookingAction` cannot see a no-fly zone sitting inside a permitted one while the map, which always has a point, can. `publishReadiness` now **refuses to publish a permitted zone overlapping a published no-fly zone**, and names the zones in the way. The state can no longer be *created* through the app. It is not retroactive: **the seeded `RUH-P-01` and `RUH-NF-KKIA` still touch in their ~50 m sliver**, because they were published before the rule existed.
- **Thread 38** — the seeded zones open at 06:00 and Riyadh sunrise is 06:34 in December, so a `nightAllowed: false` zone refuses its own first slot for part of the year. The slot preview now runs the real `deriveSlots` and then **marks every slot `isNightWindow` would refuse**, naming that day's sunrise and sunset. Said rather than changed: the hours are not wrong, they are optimistic about the sun.

**A moved boundary flags, it does not cancel — and it cannot be selective.** `geometryShrinks` is `areaWithinGeometry` asked of the old polygon against the new one: if the new boundary contains the old, nothing can have fallen outside and the save goes straight through. When it does not, the admin is shown **every approved flight still ahead in the zone**, by name and time, with a sentence saying why it is all of them. A booking has no launch point, so *"was this flight in the part you cut away"* is unanswerable from the row, and a confident subset would be a guess about whose authorisation to disturb. On confirmation they go `approved → pending` — seat kept, pilot told — never to `cancelled`. `updateZoneAction` refuses with `geometry_impact_unconfirmed` until the caller has asked; **the server decides whether confirmation is needed**, and the form learns it by being refused.

**Built:**

- `src/lib/validation/zone-hours.ts` + tests — `parseHhMm`/`toHhMm`, and the week's rules: half-open overlap (12:00–12:00 is a prayer break, not an overlap), `closes > opens`, a per-day cap.
- `src/lib/validation/zone-publish.ts` + tests — `publishReadiness` and `geometryShrinks`, both pure, both run by the screen and by the action.
- `src/lib/workflow/zone.ts` — `publishZone`, `suspendZone`, `archiveZone`, `setZoneHours`, `flagBookingsForGeometryReview`.
- `src/lib/inngest/functions/zone-suspended.ts` — the fan-out, a near-copy of `closure-fanout.ts`, driving `booking.cancelled_by_closure`. **A suspension and a closure are the same thing to a pilot**, so the trail uses one word for it.
- `hours-grid.tsx` (Sunday first), `slot-preview.tsx`, `lifecycle-panel.tsx`; the geometry-impact confirmation inside `zone-form.tsx`.
- `scripts/probe-zone-lifecycle.mts` — 19 checks against a real database, every row deleted afterwards.
- 10 new transition tests, 29 new pure ones. **831 tests**, and three deliberate mutations each proven to fail: making the overlap rule closed rather than half-open → 1 failure; dropping the "a permitted zone needs hours" clause → 1; letting a reviewer drive `zone.suspended` → 1. All reverted.

**Four defects found by looking at the screen or the console, not by any check** — thread 11's tally goes on:

1. **A hydration mismatch from a module-level counter.** Row keys came from `let counter = 0` at module scope, so the server rendered `w1` and the browser `w2` and React reported mismatched `id`/`htmlFor`. Every static check green. Now an index in the `useState` initialiser plus a `useRef` for rows added after mount. Thread 70.
2. **`zoneAdmin.statusActiveNotice` printed as a raw dotted key** the moment a zone went live — the notice key was built by interpolating the status and that one member had never been written. Thread 60's shape exactly. Now a `Record`, so a missing member is a type error.
3. **`inngest.send` threw over a committed suspension.** With no Inngest listening, the admin got a `fetch failed` stack trace while the zone *was* suspended — the worst pair available. The send is now guarded and its failure **reported**, not swallowed: `fanOutQueued: false` renders a sentence saying the pilots have not been told. Thread 69, which also names the unguarded sends still in `actions/drone.ts`.
4. **The day name and "closed" ran together** as `الأحدمغلقة` — `sm:block` made two inline spans with nothing between them.

**And one non-defect that cost the most time.** Both maps screenshotted as flat beige rectangles. Style loaded, sprites and glyphs fetched, attribution and scale populated, the worker starting cleanly, console empty — and, misleadingly, **zero tile requests in the page's resource timeline**, which looked like the silent-worker trap `CLAUDE.md` warns about. It is not: MapLibre fetches tiles **inside the worker**, whose timeline the window cannot see. **One click on the canvas and the map drew, complete.** MapLibre repaints on demand and the capture does not force one. Thread 67 — click a map before screenshotting it, and never read the main-thread resource list as evidence about tiles.

**Deviations and things not done:**

- **No schema change, deliberately.** A suspension reason is required in both languages and lives in `audit_event.reason` and on the Inngest event — not in a `suspensionReason` pair on `zone`, which the next suspension would silently overwrite. `pnpm db:generate` reports nothing to migrate.
- **`geometry_locked_until_draft` is gone** from `updateZoneAction` and from both catalogues, replaced by `geometry_impact_unconfirmed`. Thread 66 closed.
- **`zone-suspended.ts` has never run** — no `inngest-cli` on this machine. Thread 68.
- **The geometry-edit handshake is unrun in a browser.** The server half is covered by the probe; dragging a terra-draw vertex through CDP could not be made to land (the drags panned and zoomed the map instead). Thread 69's neighbour, recorded on the criterion itself.
- **`RUH-P-20`, F23a's hand-drawn draft, is now `archived`.** It was the fixture for this session's lifecycle run — hours saved, published, suspended, republished, suspended again, archived — and archived is where it belongs: invisible to pilots, and a real row with a real trail behind it.
- **A copy fix on F23a's form**: `requiresBroadcastRidHint` carried literal `**verified**` asterisks into the rendered page in both languages. No message in either catalogue contains `**` now.

**Next:** F23c — `/admin/zones/[id]/closures` with its cancellation preview and fan-out, and `/admin/cities`.

---

### Session 29 — Wave 7 · F23a The geometry layer, the zone list, and drawing a zone

**Date:** 2026-08-19
**Status:** ⚠️ done with deviations · **F23a complete.** F23 is split three ways; F23b (hours, slot preview, publish lifecycle) and F23c (closures, cities) remain.

**The split, settled first.** F23 is F22's size again, so it is three sessions, by the same seam rule: nothing in a part points at a route a later part builds. What makes the split *safe* rather than merely convenient is that **everything F23a writes is a draft** — invisible to pilots, producing no slots — so nothing drawn this session can reach a flight until F23b gives somebody the publish button.

**Admin only, from the first line.** Every other admin surface in this build is a reviewer's: a queue of what pilots submitted. This is where somebody decides where anybody may fly at all, so `requireAdmin` guards each route and each action refuses independently. The zones tab is drawn for every staff member and 404s for a reviewer, which is better than a navigation control that changes shape by role.

**The geometry layer is the feature.** Everything else here is a form.

- `geo/segments.ts` — `orientation`, `onSegment`, `segmentsIntersect`, **moved out of `airspace/geometry.ts`** rather than copied. F12 needs them for "does this area touch a no-fly zone", F23 needs them for "does this ring cross itself", and two implementations would let *touching denies* and *this polygon is valid* drift apart on what an intersection is. `airspace/geometry.ts` re-exports the name its callers use.
- `geo/winding.ts` — `ensureWinding`, outer ring counter-clockwise and holes clockwise. This app's own `pointInRing` is winding-blind; almost everything that will ever read the exported GeoJSON is not, and a hole wound the wrong way renders as a solid island. It returns the **same object** when nothing changed, which is how the validator decides whether to warn.
- `geo/area.ts` — an equirectangular area about the polygon's mean latitude. A degree of longitude at Riyadh is 101 km against latitude's 111, so taking the shoelace sum as an area overstates every zone by a tenth. Only used for a mis-click floor, and the comment says so, so nobody believes it to the square metre.
- `geo/validate.ts` — the whole check, ordered so it stays cheap and its messages stay useful: structure, then the **vertex cap before any O(n²) work**, then the two repairs, then the geometric refusals. Ring closure and winding are repaired and reported; a self-intersection is refused with no repair, because nobody can guess which loop was meant.

**Built:**

- `/[locale]/(admin)/admin/zones` — every zone, drafts first, with vertex count, boundary version and the future-booking count that decides whether a zone can be suspended at all.
- `/admin/zones/new` and `/admin/zones/[id]` — the editor: terra-draw over MapLibre with polygon, rectangle and vertex-edit modes, snap-to-coordinate, the neighbouring zones drawn faintly underneath, the bilingual form, and every rule field carrying a line about what it does to pilots.
- `src/lib/actions/admin.ts` — `createZoneAction`, `updateZoneAction`. **`bbox` and `vertexCount` are computed, never accepted**; a caller's own bbox is a claim about which map viewports will find the zone.
- `src/lib/validation/zone.ts` + tests, `src/lib/data/zone-admin.ts`, `zone.write` rate-limit rule, and the `zoneAdmin` catalogue in both languages.

**Two defects found by looking at the screen, not by any check:**

1. **The polygon drew grey.** `ZONE_FILL` holds `var(--zone-permitted)` — MapLibre's own layers only work because the app resolves those first. terra-draw, handed a `var(...)`, falls back to its default and says nothing. `resolveZoneColors` was already there from F20; now this uses it. Thread 65.
2. **The editor was inert on the second visit.** `map.on("load")` never fired, because with the basemap style in the browser cache MapLibre finished loading before the listener attached — so the draw instance was never created and the toolbar sat there enabled over a map that ignored every click. Fixed by asking `isStyleLoaded()` first. It worked the first time and not the second, which is exactly what a warm cache looks like and exactly the kind of thing only opening the page twice finds.

**Deviations and things not done:**

- **A published zone's boundary cannot be edited**, and the action refuses it with `geometry_locked_until_draft` rather than doing it quietly. Moving a live boundary has to re-evaluate the bookings inside it and show the admin which would fall outside *before* saving — F23b's, and thread 66 until then.
- **No publish, suspend or archive.** Rule 11 puts every status change in `src/lib/workflow/`, and F23b builds them there.
- **Snap-to-vertex is configured but unproven.** `snapping: { toCoordinate: true }` is set on the polygon mode; nothing has yet drawn a zone deliberately abutting another and checked that the shared coordinate is identical.
- **A reviewer's 404 on these routes is unrun** — the same one-account problem as thread 64. `requireAdmin` is the same guard `/admin`'s role table already uses, but nobody has followed the link as a non-admin.
- **One drawn zone is left in the database**: `RUH-P-20`, a draft, 193.7 km² of nothing north-west of Riyadh. It is the zone this session drew by hand, and it is harmless where it is — a draft is invisible to pilots. Every probe row from the direct POSTs was deleted.

**Next:** F23b — the operating-hours grid, the live slot preview through the real `deriveSlots`, and the publish lifecycle with its impact warnings.

---

### Session 28 — Wave 7 · F22c The pilots directory, identity verification, the soft lock, four eyes and report triage (**F22 complete**)

**Date:** 2026-08-19
**Status:** ⚠️ done with deviations · **F22 is complete.** Wave 7 continues with F23 (zones), F24 (Remote ID lookup) and F25 (analytics).

**The rule that makes an approval mean something.** Staff hold `owner` alongside `reviewer` in this build on purpose — staff use the product as pilots, which is how they find out what it is like — and until this session nothing structural kept a reviewer away from their own paperwork (thread 42). Now `isOwnSubmission` gates **six** decisions: drone approve and reject, booking approve, reject and authority-cancel, module verify, and identity verify. It is checked in `src/lib/workflow/`, **before** the transition, so a refused self-decision writes nothing at all — no status change, no audit event, no notification. The screens replace the decision panel with an explanation rather than greying a button, because a disabled control with no sentence beside it reads as a broken page.

**The authority-cancel case is the one worth naming.** An authority cancellation has no lead-time limit — that is what it is for — so a reviewer cancelling their own flight twenty minutes before the slot would be walking round `pilotMayCancel`'s two-hour cutoff using a power granted for somebody else's emergency. Their own booking is cancelled with the pilot control, under the pilot rule.

**The user chose strict enforcement over an admin override**, knowing the cost: the single account in this database can now decide nothing of its own. That is thread 64, and it needs a second account only the user can create.

**Built:**

- `/[locale]/(admin)/admin/pilots` and `/admin/pilots/[id]` — the directory and the person: profile with the masked document and its audited reveal, identity decision, pilot history, registered aircraft, bookings, and the pilot's own audit trail.
- `src/lib/workflow/identity.ts` — `verifyIdentity` / `rejectIdentity`, each locking the profile row, clearing the opposite column, and writing its audit event. **This is the human check the product rests on**, and there is still no SMS, no scanner and no score anywhere near it.
- `src/lib/workflow/report.ts` — `triageReport`, closing thread 35.
- `isOwnSubmission` in `workflow/rules.ts`, enforced in `drone.ts`, `booking.ts`, `declaration.ts` and `identity.ts`.
- `src/lib/data/presence.ts` + `review_presence` — the soft lock, wired into all three detail screens.
- `searchPilots`, `getPilotForReview`, `listReports` in `data/review.ts`; five actions in `actions/review.ts`.
- `src/components/admin/{pilot-search,identity-decision,report-triage,review-presence,own-submission-notice}.tsx`, a third tab on `QueueTabs`, and `formatList` in `format.ts`.
- Migration `0005_old_komodo` — `drone_report_status`, `drone_report` triage columns, `review_presence`, and `drone_report` added to `audit_entity_type`. **25 tables.**

**The pilots search is a POST, and every other filter in this build is a GET.** That is a deliberate break with the pattern: the term may be a national ID or an iqama number, and a GET puts it in the address bar, the history, the access log and any referrer that leaves the origin. It costs the shareable link and the back button. The number never reaches a query either — `searchPilots` hashes a whole document number and matches `idDocumentHash`, so **there is no substring search over identity documents anywhere in this codebase**, and a partial one cannot be added by accident because there is nothing to add it to. The screen says how the term was read, so a mistyped ID cannot masquerade as "this person is not registered".

**The soft lock is named `review_presence`, not `review_lock`.** It locks nothing and refuses nothing: what stops two reviewers overwriting each other is `applyTransition`'s row lock and the `already_applied` the second one gets. A table called `review_lock` would invite the next reader to believe a decision consults it. One row per (record, reviewer) rather than one per record, because two people reading the same submission is the situation worth showing and a single-holder row has to decide which of them "has" it — a question with no true answer and a stolen lock as the usual outcome. Rows expire by time, because a closed laptop sends no unlock.

**A raw dotted code reached a screen again, and the test that exists for it did not fire.** `pilot_profile.completed` is written by a **ternary**, and `audit-actions.test.ts`'s scan matched `action: "x.y"` as a literal — so it never saw it, and the English pilot page printed the path. Found by reading the page, not by any check (thread 11, again). The scan now reads a 200-character window after each `action:`; widening it to *any* quoted action-shaped string was tried first and pulled in rate-limit keys like `booking.create`, which no trail renders.

**Deviations and things not done:**

- **Four eyes is proven against the database, not over HTTP** — thread 64. `probe-four-eyes.mts` is 22/22 with two user *rows*; a second reviewer signing in and deciding in a browser needs an account the assistant may not create.
- **No `in_progress` state for reports.** Two closing states and no third: nothing would set it that "a reviewer has the page open" does not already say, and an enum member nothing writes is the lie thread 35 spent three waves being.
- **A report's note reaches nobody**, unlike every other reason field, and is therefore optional. A report is usually filed by a member of the public who left no address; requiring a note nobody reads is how a queue fills with the word "handled".
- **Revoke and reinstate are still not on any screen.** They are admin-only acts on an approved registration and are not decisions the review screens exist for; F28 or F29 owns wherever they belong.
- **The report filed during verification is left in the database** as demo content — a real row, filed through the public page and closed through the queue.

**Next:** F23 — zone and closure management, with terra-draw and `ssr: false`.

---

### Session 27 — Wave 7 · F22b The bookings tab, the tab strip and the booking decision

**Date:** 2026-08-19
**Status:** ⚠️ done with deviations · **F22b complete.** F22c (pilots, `verifyIdentity`, the soft lock, four-eyes, thread 35's report triage) is what remains of F22.

**The re-run is the feature.** A booking is a request about the future, and the future moves. `booking.decisionSnapshot` records what was true when the pilot asked; between then and the reviewer's arrival a closure may be published or a registration may lapse. So `/admin/bookings/[id]` evaluates the airspace **again**, at the top of the page, before the buttons — and `approveBooking` evaluates a **third** time inside the transaction that writes the approval, which is the one that counts. Session 27 proved the gap between them is real by opening it deliberately: a closure inserted over the booked slot flipped the page to *denied*, and Approve came back refused with `zone_closed_window` rather than authorising the flight.

**The tab strip arrives now, not in F22a.** F22a shipped the drone queue bare on purpose — a two-tab control whose second tab links to a route that does not exist is worse than one tab. `/admin/bookings` exists, so `QueueTabs` is here, with both counts **counted in SQL** by `countPendingReviews` rather than taken from `.length` of a page bounded by a `limit`. The lone count badge beside the drone queue's heading was removed: with both totals on the tabs it was the same number said twice, and the tab's is the truer one.

**Built:**

- `/[locale]/(admin)/admin/bookings` — the pending-booking queue, **soonest slot first**, with time-until-slot, zone, pilot, Remote ID, filters over zone/urgency/free text, and two distinct empty states.
- `/[locale]/(admin)/admin/bookings/[id]` — the live re-run, the zone drawn among its neighbours, the aircraft with its Remote ID and **registration validity at the slot**, the pilot panel with masked ID and reveal, pilot history, slot occupancy, the audit trail, and the decision panel.
- `src/lib/admin/urgency.ts` — the pure mirror of `queue.ts`: signed `msUntil`, four buckets with closed-open boundaries, `isUrgent`. Tested.
- `registrationAtSlot` in `src/lib/admin/validity.ts` — `valid` / `expires_during` / `expired` / `unknown`, with **the engine's own boundaries** (`<= slotEnd`) rather than a second opinion. Tested.
- `parseBookingFilters` / `applyBookingFilters` in `src/lib/admin/filters.ts` — a separate shape from the drone queue's, narrowed against the zones that exist.
- `listBookingQueue`, `countPendingReviews`, `listSlotOccupancy`, `getBookingForReview` in `src/lib/data/review.ts`.
- `BOOKING_TRAIL_ACTIONS` in `src/lib/admin/audit-actions.ts`, and ten catalogue labels.
- `src/components/admin/{queue-tabs,time-until-badge,booking-queue-table,booking-queue-filters,airspace-recheck,booking-zone-map,booking-decision-panel}.tsx`.
- `formatHours` in `format.ts`.
- `revalidateReviewSurfaces()` in `actions/booking.ts` — the three reviewer actions revalidated `/admin` alone, which was right while `/admin` was the only reviewer surface and wrong the moment this screen existed.

**Reused rather than rebuilt.** The countdown is `src/lib/dashboard/countdown.ts` — the pilot's dashboard counts down to the same slot with the same two functions, so reviewer and pilot cannot be shown different numbers of hours. The refusal is `DecisionReasons`, so an airspace "no" reads identically on the map, in the wizard, in the re-run panel and in the transactional refusal. The status colours are `ZONE_FILL`, the map's palette. The three decision *actions* already existed from F14 and needed no changes; F22b is a surface over them, plus the revalidation fix.

**Two audit actions had no label and nothing had noticed.** `booking.requested` (written by `booking/create.ts`) and `booking.checked_in` (written by `workflow/booking.ts`) are not transitions — a check-in changes no status — so writing out `transitions.ts`'s eight `booking.*` edges missed both. **`audit-actions.test.ts`'s source scan caught them**, which is the test F22a wrote for exactly this and the first time it has fired on something real. Without it the *first* row of every booking trail would have printed `booking.requested` at a regulator.

**Deviations and things not done:**

- **No launch point on the map** (thread 37). A booking has no coordinate — it is made against a zone — so the page draws the zone among its neighbours and *says* there is no point to plot, rather than dropping a pin in the middle of a polygon that a reviewer would read as an intended take-off site.
- **`BookingZoneMap` is a new component, not `ZoneDrawing`.** The latter draws every zone with equal weight under a three-kind legend, which would be a caption for a different picture here. Same projection, same path builder, same palette; only the emphasis differs.
- **Slot occupancy shows Remote IDs and seats, never names.** A reviewer asking who else is in the air is asking about aircraft; every identity on the screen that nothing needed is one that should not have been read.
- **No soft lock and no four-eyes** — F22c's, deliberately, as settled in Session 26. Thread 42 grew a second half in the process: this session approved and then authority-cancelled a booking it had made itself, from the one account, with nothing in the way.
- **Nothing sends the cancellation email.** `booking-cancelled-by-authority` is a written, registered template with no caller — the exact shape of thread 61's `drone-rejected`. The pilot got a notification and nothing else. Thread 61 now names both.
- **`review.airspaceAllowed/Denied/NeedsReview` were written and then deleted**: `airspace.decisionAllowed` and its siblings already existed, and three parallel keys would have been three chances for the map and the reviewer to disagree about what "denied" is called.

**Verified by pressing the buttons, not by reading the code.** Approve, authority-cancel and the reject panel's floor were all driven in Chrome in Arabic; the closure refusal was driven twice, before and after the closure was removed. The pending booking consumed by that testing was **replaced through the pilot wizard**, not by SQL — a `pending` row inserted by hand would be a status that appeared with nobody having decided it, which is what `src/lib/workflow/` exists to prevent. The cancelled booking stays cancelled; its trail is a true record.

**Next:** F22c — `/admin/pilots` and its detail, `verifyIdentity`, the soft lock, the four-eyes rule (thread 42, both halves) and `drone_report` triage (thread 35).

---

### Session 26 — Wave 7 · F22a Review queue and the drone decision screen

**Date:** 2026-08-19
**Status:** ⚠️ done with deviations · **F22 is split three ways; F22a is complete.** The split was settled with the user before any code was written and is recorded at the top of the feature file.

**The decision loop closes here.** Every reviewer action in this codebase had been written in Wave 5 and driven by nobody — `approveDroneAction`, `rejectDroneAction` and their siblings had no caller, and F18b's `approved` / `rejected` rows were seeded by SQL. This session gave them a surface and pressed the buttons.

**The split.** F22a is the queue and the *drone* decision; **F22b** is the bookings tab and `/admin/bookings/[id]`; **F22c** is `/admin/pilots`, `verifyIdentity`, the soft lock, four-eyes and thread 35's report triage. The seam is the rule F16/F19/F20/F21 were split by — nothing in a part points at a route a later part builds — which is why **the tab strip arrives in F22b**: a two-tab control whose second tab links nowhere is worse than one tab.

**Almost all of F22a's server side already existed.** F14 shipped the five decision actions and `applyTransition` already enforced `reasonMinLength: 20` against the locked row. The genuinely new server code is small: `src/lib/workflow/declaration.ts` (rule 11 — `verifiedAt` / `rejectedAt` are a status), `src/lib/actions/review.ts` (three actions), and `src/lib/data/review.ts`.

**Built:**

- `/[locale]/(admin)/admin` — rebuilt from the Wave 3 placeholder into the pending-drone queue: oldest first, per-row age, filters and free-text search, counts. Role assignment and F11's report list stay below it.
- `/[locale]/(admin)/admin/drones/[id]` — photos with a zooming lightbox, specifications, the serial framing, the pilot panel with the masked ID and a reveal, pilot history, declared modules, the audit trail, and the decision panel.
- `src/lib/admin/{queue,filters,audit-actions,validity}.ts` — the pure layer: age arithmetic, URL-filter narrowing, the trail's label map, and the validity-window conversion. All four tested.
- `src/lib/workflow/declaration.ts` — `verifyDeclaration` / `rejectDeclaration`, each locking its row `for update`, writing the audit event, and recomputing `remote_id.broadcastCapable`.
- `src/lib/actions/review.ts` — `verifyDeclarationAction`, `rejectDeclarationAction`, `revealPilotIdentityAction`.
- `src/components/admin/{age-badge,queue-filters,queue-table,decision-panel,photo-lightbox,pilot-history,audit-trail,module-review,pilot-identity-reveal}.tsx`.
- `src/components/form/date-select.tsx` — F17's three-select date control, generalised. `DateOfBirthInput` is now a thin wrapper over it.
- `formatDays` in `format.ts`; `BUILD_TYPES` exported from `validation/drone.ts` (the wizard had a private copy).
- 148 catalogue keys (**1303**).

**Three threads closed, and all three needed the browser to close them.**

- **Thread 40 / "a decision driven over HTTP" — closed.** A rejection was written from the reject panel with an edited template: status `rejected`, `rejectionCount` 1 → 2, **exactly one** `drone.rejected` audit event with `actorRole: admin` captured at the time, and the reason stored byte-for-byte as typed.
- **Thread 41 — closed.** "A reviewer approves and the pilot gets an email with a QR" ran as **one flow** for the first time, from a button: `approveDroneAction` → status `approved`, registration 2026-08-19 → 2029-08-19, Remote ID `AJN-GCBR-3KJN` issued with its own audit event, the Inngest event reaching a live dev server, `qr-render` storing `qrPathname`, and `email_log` recording `drone-approved` / `skipped` (no Resend key — the expected degraded path). The action→event seam was the untested half; it is tested now.
- **Threads 45 and 49 — closed.** `revealPilotIdentityAction` is the profile-keyed sibling F11's code-keyed reveal could not be (a `pending` drone has no Remote ID at all), and it wrote its audit event — reason included, **no part of the document number** — before returning the identity. `verifyDeclaration` wrote all four columns thread 49 said nobody wrote, and flipped `broadcastCapable` with its own event.

**Four defects, three found by looking and one by measuring.**

1. **The audit trail printed `review.auditActions.drone.resubmitted` at a reviewer.** `next-intl` reads a `.` in a key path as a **namespace separator**, so a flat catalogue key `"drone.approved"` is unreachable from `t("auditActions.drone.approved")` — it renders the whole path as literal text. `typecheck`, `lint`, `i18n:check` and *the first version of my own test* were all green: the test asserted the JSON **had** a key called `drone.resubmitted`, which it did. What no check saw is that next-intl could not reach it. Keys are now underscored through `trailLabelKey()`, shared by the component and the test, and the test asserts the property that actually broke — **no key under `auditActions` may contain a dot**. Mutation-checked: restoring the dots fails three tests.
2. **A doubled preposition in the Arabic header.** `formatDateTime` already emits `في` between the date and the time under `ar`, so `قُدِّم في {at}` rendered *"قُدِّم في 19 أغسطس 2026 في 12:17"*. Now a label — `تاريخ التقديم: {at}`.
3. **A verified module read back a day late.** `validUntil` is stored as an **exclusive** bound (midnight starting the next day, which is how `broadcastCapableAt` reads it), so the page printed *"until 1 January 2030"* to a reviewer who had typed 31 December 2029. The row was right and the render was wrong. `src/lib/admin/validity.ts` now owns both directions and is tested across month ends and a leap day.
4. **Redundant empty states.** A pending first registration showed *"no Remote ID has been issued yet"* and then *"no modules declared"* immediately beneath — the second reads as though the pilot omitted something. The module list now renders only when there is a Remote ID to hang one off.

**A non-defect worth recording, because it cost twenty minutes and will again.** The 375 px probe reported `documentElement.scrollWidth` 696 against a 360 viewport on `/admin` and I "fixed" it with `min-w-0` on the table's scroll container. **The fix changed nothing and there was no defect**: the wrapper measures 328 px either way, the table scrolls inside it, `document.body.scrollWidth === clientWidth`, and `scrollTo(9999, 0)` leaves `scrollX` at 0. `documentElement.scrollWidth` is simply unreliable under RTL with a clipped overflowing descendant. The `min-w-0` was reverted rather than left in with a comment claiming a fix. **Thread 44's technique needs amending: assert `body.scrollWidth` and a real scroll attempt, never `documentElement.scrollWidth`.**

**Deviations, each with its reason:**

- **One tab, no tab strip** — see the split above.
- **Oldest-first is not configurable.** It is in `listDroneQueue`, not in a control: a queue a reviewer can sort newest-first is a queue that buries what has waited longest.
- **Filters are a plain GET form**, so the filtered queue is a link, the back button returns to the previous filter, and the control ships no JavaScript. Every value is narrowed against a closed list in `parseQueueFilters` — a `build=<script>` in the URL becomes `""` before anything renders it.
- **Two empty states, not one.** *"Nothing is waiting for review"* and *"No submissions match these filters"* mean different things, and telling somebody the queue is empty when it is not is a lie they act on.
- **The header count is the unfiltered total**, with the filtered count beside the filter that caused it.
- **The reviewer's serial panel says the thing out loud.** `DroneSpecTable` omits the serial row entirely for a self-built airframe — right on the pilot's screen, where nothing is missing so nothing should read as missing. On a reviewer's screen silence invites "incomplete submission", so this surface carries the badge **and** the sentence.
- **The decision panel is at the top**, above everything the reviewer has finished reading, and it states the three consequences of approval before the button is pressed.
- **A decided submission keeps its screen.** `getDroneForReview` returns a drone in any status: a reviewer following a stale queue link must see what happened, not a 404 that reads as a deleted row. The panel is replaced by the outcome and its reason.
- **`review.decide` and `identity.reveal` rate limits are reused**, not new ones.
- **No email is sent on rejection.** See the new thread below — the template exists and nobody sends it.
- **Four-eyes deferred to F22c**, deliberately: every pending drone here is owned by the only account, which is also the only reviewer, so the rule would have made every decision in this feature untestable.

**Verified — in Chrome, over HTTP, both locales:**

| Criterion | Result |
|---|---|
| **Oldest first** | OK — 15 August above 19 August, and the order is in the reader |
| **Age per row, over 7 days flagged** | OK — *"بانتظار 3 أيام"* and *"وصل اليوم"*; the threshold sentence is printed once under the table |
| **No-serial badge, not an empty cell** | OK in both locales — badge on the self-built row, the real serial on the commercial one |
| **Filters and free-text search** | OK from the URL — `?q=alshehri&build=self_built&age=today` → *"1 of 1"*; `?q=zzz&build=commercial&age=overdue` → *"0 of 1"* and the no-matches state. Form state reflects the URL; the reset is a link |
| **Photos open full-size and zoom** | OK — ×1 → ×3, the zoom-out control disabled at ×1, and **the left arrow moves forward in RTL** |
| **Reject under 20 characters** | OK — refused in the panel (`aria-invalid`, disabled confirm) **and independently at the action**: `reason_required` |
| **Templates pre-fill an editable field** | OK — pre-filled, then edited, and **the edit is what the pilot got** |
| **The reason reaches the pilot verbatim** | OK — stored byte-for-byte, rendered on `/drones/[id]`, and a `droneRejected` notification written in the same transaction |
| **Approve issues a Remote ID, 3-year validity, QR, email** | OK — thread 41 above |
| **Modules verify and reject; verifying sets `broadcastCapable`** | OK — and a window the wrong way round is refused with `invalid_validity`. Superseded rows show their history and **no controls** |
| **The national ID is masked; revealing is logged first** | OK — `•••••2345` on the page, the whole number only after the reveal, audit event carrying the reason and **no digits** |
| **Pilot history shows prior rejections with reasons** | OK — and the aircraft on screen is excluded from its own history |
| **One audit event per decision, actor and role-at-the-time** | OK — `count = 1` for `drone.rejected`, `actorRole: admin` |
| **Arabic RTL and English** | OK — no raw keys on either screen in either language; the pilot's Arabic aircraft nickname stays Arabic under `/en`, correctly |
| **375 px** | OK — `body.scrollWidth === clientWidth` on the queue and both review screens; the table scrolls inside its own box |
| **Console** | OK — 15 messages, all React DevTools / HMR / Fast Refresh, **zero errors, zero warnings** |

**Verified against a production serve (`next start`, port 3002) — thread 16's rule:**

| Criterion | Result |
|---|---|
| **A pilot gets 404 on `/ar/admin`, `/en/admin` and `/admin/drones/[id]`** | OK with a **real probe pilot account** — 404 on all three, **no guard named**, no drone or pilot data in the body |
| **The same request against `next dev`** | 404 but **the guard *is* named** (2 matches) — thread 16 reconfirmed; this check is only meaningful against `next start` |
| **A forged cookie sails past the proxy** | OK — `src/proxy.ts` 307s a cookie-less POST to sign-in, but with a fabricated cookie every action is reached and every one answers `not_authenticated`. **The proxy is not the boundary; the guard in the action is** |
| **A pilot POSTing the reviewer actions directly** | OK — `approveDroneAction`, `rejectDroneAction`, `verifyDeclarationAction`, `rejectDeclarationAction` and `revealPilotIdentityAction` all answer `not_found`, never `forbidden` |
| **Revoke and reinstate absent from the reviewer UI** | OK — the only two mentions in `src/components` and `src/app` are comments; no control renders either |
| **Refusals write nothing** | OK — six refused calls (short reason, already decided, illegal edge, bad validity, short reveal reason, missing declaration) left `audit_event` at 25 and both declarations untouched |

- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (**1303**), `pnpm test` (**729**, 40 files — 28 new), `pnpm build` — all green. Both admin routes build **dynamic**, which they must: each reads the session.
- **Four mutations run, all four caught**: a label dropped from *both* catalogues; a newly-audited action with no entry in `DRONE_TRAIL_ACTIONS`, caught by the source scan; `isOverdue` flipped from `>` to `>=`; and the dotted catalogue keys restored.
- The probe pilot account was **deleted** afterwards — `user` is back to the one owner row, and its `rate_limit` rows were cleared.

**Not verified:**

- **Two reviewers on one item.** The soft lock is F22c's, and `already_applied` was proved by a second POST rather than by two people.
- **A reviewer who is not an admin.** Every decision here was made by the single admin account, so the `reviewer`-only branch of `actorKindsFor` is still unexercised — and so is thread 36's "a reviewer who is also the drone's owner", which is in fact what every decision this session was.
- **A real approval email.** `email_log` says `skipped`; no Resend key exists.
- **Dark mode**, and the queue with more than two rows.

**Next session should know:**

- **F22b is the bookings tab and `/admin/bookings/[id]`.** It owns the tab strip, and it unblocks the four things Sessions 24–25 could not verify: booking rejection, authority cancellation, the `completed` / `no_show` statuses, and the verbatim-reason rendering already built on `/bookings/[id]`.
- **`audit-actions.ts` is now the guard against a raw dotted key on the trail.** Add booking actions to `DRONE_TRAIL_ACTIONS` when F22b builds the booking trail — the source scan currently excludes them on purpose, so adding the screen without the labels fails a test rather than a reviewer.
- **`next-intl` treats `.` as a namespace separator.** Any catalogue key that is also a dotted domain code must be underscored. This has now been wrong once.
- **The dev database:** one pending self-built drone (2 photographs, `rejectionCount` 3, a prior rejection in its trail), three approved — one of them freshly approved with Remote ID `AJN-GCBR-3KJN` and a stored QR — one draft, one expired, one revoked; three bookings untouched; a verified profile; one verified declaration with a real validity window.
- **`pnpm dev` was already running on 3001** and refused to start a second time. Check before launching one.

---

### Session 25 — Wave 6 · F21b Bookings list and pilot dashboard (**F21 complete — Wave 6 is done**)

**Date:** 2026-08-19
**Status:** ⚠️ done with deviations · **F21 is complete, and with it Wave 6.** Ran straight on from Session 24 without a `/clear`, at the user's request.

**Wave 3's dashboard placeholder is gone.** It said hello and printed the account's role. The real one answers the three questions a pilot arrives with — is anything blocking me, when am I next flying, what do I own — and it reads live rows to do it.

**Built:**

- `/[locale]/(app)/bookings` — four tabs, the tab in the URL rather than in client state, so back returns to the tab you were on and the page ships no JavaScript for its own navigation.
- `/[locale]/(app)/dashboard` — action-required, next flight with a live countdown, aircraft summary, recent flights, quick actions, and the day-one onboarding.
- `src/components/dashboard/{action-required,next-flight,drone-summary,onboarding}.tsx`.
- `src/components/booking/{booking-row,status-badge,slot-time}.tsx`.
- `src/lib/dashboard/countdown.ts` — the countdown arithmetic, pure.
- `listZoneAndRemoteIdForBookings` in `src/lib/data/booking.ts` — two queries for a whole list, scoped by re-reading the caller's own bookings rather than trusting the ids passed in.
- `src/lib/db/status-labels.test.ts` — see below.
- 52 catalogue keys, 12 dead ones deleted (**1155**).

**Three defects, and two of them are new instances of failures this build has already had.**

1. **The dashboard 500'd on first open: a Server Component calling an export of a `"use client"` module.** `countdownParts` and `formatCountdown` started life inside `next-flight.tsx`, which is `"use client"` — and **every export of a client module is a client *reference***, so calling one during the server render throws at request time. `typecheck`, `lint` and `test` were all green. This is the exact mirror of the `"use server"` trap recorded in `validation/declaration.ts` (a `"use server"` module may export only async functions), and the fix is the same shape: the pure arithmetic moved to `src/lib/dashboard/countdown.ts`, imported by both sides. **The countdown has to be computed on both** — the server renders the first value so the markup matches, the client re-renders it every minute — which is exactly why it could not live in either.

2. **`bookings.statusPending` rendered as a raw key beside a flight.** `BookingStatusBadge` looks up `statusPending` / `statusApproved` / `statusRejected`; the catalogue carried `statusConfirmed` — a name matching no value `booking_status` can hold — and nothing else. **`i18n:check` cannot see this**: it compares the catalogues to each other, so a key missing from *both* is missing consistently. Same failure as `nav.dashboard` in F16a. Keys added, `statusConfirmed` deleted, **and this time it is tested**: `src/lib/db/status-labels.test.ts` asserts every `bookingStatus` and `droneStatus` enum value has a label in both catalogues, and that no stray `status*` key survives for a value the column cannot hold. Mutation-checked — removing a key and reinstating `statusConfirmed` killed two tests.

3. **A bidi defect that no text assertion can catch.** `<span dir="ltr">{date} {time} – {time}</span>` renders `19 أغسطس 2026 15:00 – 17:00` as **`19 17:00 – 15:00 2026 أغسطس`**. The Arabic month is a strong RTL run and the numerals around it are neutral, so forcing the *container* to LTR resolves the whole line into an order nobody wrote. **`innerText` is correct in every one of these cases** — the logical order is fine and only the visual order is wrong — so it is invisible to any test that reads text, and it was found by looking at a screenshot. Fixed with `<bdi>`, which *isolates*: the date resolves in its own context, the range in another with its own `dir="ltr"` inside. `src/components/booking/slot-time.tsx` is the one implementation, and the same fix was applied to the map's `nextOpenAt`, which had it too.

**Deviations, each with its reason:**

- **`rejected` shares the "cancelled" tab.** F21 names four tabs. A rejected booking is a flight that is not happening, exactly like a cancelled one; a fifth tab would leave five mostly empty to distinguish two states the badge on the row already distinguishes.
- **Cancelled and rejected are pulled out of *both* time buckets.** A booking cancelled yesterday for a slot next week is still cancelled — leaving it under "upcoming" would have the tab promise a flight that is not happening.
- **The Remote ID is on every row and every aircraft card**, not only on the detail pages. A pilot scanning for the booking an inspector just asked about is matching a code on a sticker; making them open each row turns a list into an index.
- **Onboarding replaces the dashboard only while the journey is untouched** — no aircraft *and* no bookings. The moment either exists the real cards are more useful, and a tutorial that lingers is one people learn to scroll past.
- **Exactly one onboarding step is ever actionable.** Registering an aircraft before the profile is complete is a route F18's guard bounces; offering it would be offering a door that closes in your face. Later steps show as numbered text with no control, rather than as disabled buttons that invite a click doing nothing.
- **`ActionRequired` renders nothing when nothing is required** — no "you're all set" card. A heading that is always there is a heading people stop reading, and then the one week it matters they skip it too.
- **The countdown ticks every minute, not every second.** The card answers "how long have I got", which is a question asked in minutes.
- **Twelve dead catalogue keys deleted** — `dashboard.placeholder`, `bookings.{upcoming,past,reference}`, `booking.{selectDrone,selectZone,selectDate,selectSlot,review,slotsRemaining,noSlots,success}` — all left over from screens that were planned differently. A key nothing renders is a claim about a screen that does not exist.

**Verified — in Chrome, over HTTP, both locales:**

| Criterion | Result |
|---|---|
| **Four tabs, each with its own empty state** | OK — upcoming shows two approved flights soonest-first; pending shows the Ammariyah request; past reads *"No flights have happened yet"*; cancelled reads *"Nothing cancelled or rejected"* |
| **The tab is in the URL** | OK — `?tab=pending` is a real link, so back and middle-click both behave |
| **Action required appears only when required** | OK — three items for this account (a rejected aircraft, a registration expiring 29 August, a flight today) and no "complete your profile" or "awaiting verification", which are the two that no longer apply |
| **A registration expiring within 30 days appears** | OK — `EXPIRY_WARNING_DAYS` is F18's constant, reused rather than restated |
| **Next flight with a live countdown** | OK — *"In 3h 30m"*, ticking, with the zone, the slot and the Remote ID; Latin numerals in Arabic |
| **Day-one onboarding, not an empty grid** | OK — by **temporarily forcing `dayOne`**, then reverting: three numbered steps, step 1 struck through as done, step 2 the only one carrying a link (`/drones/new`), step 3 with no control |
| **Empty states read as intentional** | OK in both languages — a sentence per tab rather than one shared "nothing here" |
| **Bidi** | OK after the fix — `19 أغسطس 2026 15:00 – 17:00` renders in that order in an Arabic page, checked against a screenshot rather than against `innerText` |
| **English** | OK — no raw keys anywhere on either screen. Aircraft nicknames stay Arabic, correctly: they are the pilot's own words, not chrome |
| **375 px** | OK — via the iframe (thread 44): `scrollWidth === clientWidth` on both, nothing wider than the viewport |
| **Ownership** | OK by construction — every read goes through `src/lib/data/*` with the session first; nothing on either screen can reach another pilot's rows |

- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (**1155**), `pnpm test` (**701**), `pnpm build` — all green. All four booking and dashboard routes build **dynamic**, which they must: every one reads the session.

**Not verified:**

- **A genuinely new account's dashboard.** The day-one state was reached by forcing the flag, not by signing up — **the first account created becomes admin**, so a probe account is forbidden here. The branch was exercised; the *condition* reaching it was not.
- **The no-show and completed statuses on a row.** Nothing sets them yet: `no_show` needs the slot to pass unattended and `completed` needs F22's lifecycle. Their labels are asserted by `status-labels.test.ts` but have never been rendered.
- **Dark mode and 1440 px** on both screens.
- **A dashboard with more than five recent flights**, so the `RECENT_LIMIT` cut and the "see all" link have not been seen doing their job.

**Next session should know:**

- **Wave 6 is complete. Wave 7 — the admin side, F22–F25 — is next, and F22 is the one that unblocks the most.** Four items across Sessions 24 and 25 are waiting on it: identity verification, booking rejection, authority cancellation, and the `completed` / `no_show` statuses.
- **`status-labels.test.ts` is the guard against a whole class of bug** — a status label missing from both catalogues. Extend it when a new enum grows a badge, rather than discovering it on a page.
- **`slot-time.tsx` is the one way to render a slot.** Do not put `dir="ltr"` on an element containing a formatted Arabic date; isolate with `<bdi>` instead. This has now been wrong once and will be again.
- **The dev database holds three bookings and a verified profile**, so both new screens have data. The empty states need checking *around* that, not instead of it.
- **The profile's ID number is still fabricated** (`1055512345`), and threads 50 and 51 are open. All three are the user's to resolve.

---

### Session 24 — Wave 6 · F21a Booking wizard, submission and booking detail

**Date:** 2026-08-19
**Status:** ⚠️ done with deviations · **F21 is split; F21a is complete.** Ran straight on from Session 23 without a `/clear`, at the user's request.

**F21 is split, and this is the seam.** F21a is *making a booking* — the wizard, the submission, and the detail page a confirmation lands on. **F21b is living with them** — the `/bookings` list with its four tabs, and the pilot dashboard. The split is where it is because nothing in F21a points at a route that does not exist: the confirmation links to `/bookings/[id]`, which this session built. Same precedent as F16a/b, F19a/b and F20a/b.

**Almost all of F21's server side already existed.** F13 and F14 shipped `listSlotsAction`, `createBookingAction`, `cancelBookingAction` and `checkInBookingAction`, and `createBookingAction` already ended with `revalidatePath("/[locale]/bookings")` for a route nothing had built yet. **The one gap was the crew** — `booking_copilot` had a table, a reader and no writer, which is the unreachable-code shape F19b found in the declaration upload. It is written now.

**Built:**

- `/[locale]/(app)/bookings/new` + `src/components/booking/{wizard,new-booking,date-strip,slot-picker,capacity-meter,drone-select,copilots,safety-ack,confirmation}.tsx` — six steps.
- `/[locale]/(app)/bookings/[id]` + `{booking-actions,status-timeline}.tsx` — the detail page, its timeline, check-in and cancel.
- `src/lib/validation/booking.ts` + 21 tests — the purpose whitelist, the crew rules, and Saudi mobile normalisation.
- `createBookingAction` now takes `copilots` and re-validates them; `createBookingWithSeat` writes them **inside the seat transaction**.
- **The map's *Book this zone* button**, deferred in F20b, now exists and carries zone, altitude, slot and aircraft into the wizard as query parameters.
- 100 catalogue keys (**1113**).

**The crew insert is outside the retry's `catch`, deliberately.** That `catch` reads a unique violation as seat contention and loops to the next seat. A `booking_copilot` insert cannot hit those constraints today — but a second statement under a catch that means *"try the next seat"* is how a future index turns one booking into several. It stays inside the transaction, so a crew that fails to write takes the booking with it rather than authorising a flight whose crew was never recorded.

**Deviations, each with its reason:**

- **Both co-pilot names are required, or the row is dropped.** `full_name_ar` and `full_name_en` are both `NOT NULL`. The alternative — copying whichever was given into the other column — puts Latin letters in an Arabic field and makes the pair a lie the first time a reviewer reads it. A *wholly* empty row is dropped rather than refused, because most flights have no crew and treating the commonest case as an error is the wrong default.
- **Co-pilot rows are added on request, not rendered three deep.** Six empty fields tell every solo pilot they have left something blank.
- **Mobile numbers are Saudi-only and normalised.** `05…`, `00966…`, `+966 5x …` all become `+9665xxxxxxxx`. A permissive international regex would accept a mistyped local number nobody can ever call, and a co-pilot is somebody standing in the same field as the pilot.
- **`booking.purpose` is a plain `text` column**, so the action whitelists against `FLIGHT_PURPOSES`. Without it a hand-made POST puts an arbitrary string on the detail page and in the reviewer's queue.
- **The wizard opens on the first step the map has *not* answered.** Arriving with a slot and an aircraft opens on step 4. Pressing "next" four times past questions already answered is the failure the pre-fill exists to prevent.
- **Unavailable slots and ineligible aircraft are real `disabled` controls, not dimmed divs.** A keyboard skips them and a screen reader announces them; F20's criterion is "never merely dimmed". Each carries *which* kind of unavailable it is — passed, closed, full, or already held by this pilot.
- **The detail page draws the zone, not a point.** `booking` has no coordinate column: a seat is in a zone. Drawing a marker would invent a location the record does not hold. It reuses F16b's SVG with a single zone.
- **The cancellation cutoff is printed as an absolute instant**, not "two hours before". A pilot reading the relative form has to do arithmetic about a slot in a timezone that may not be their phone's.
- **No zone picker beyond a `<select>`.** F21 says the zone is "changeable"; it is, from a list of active permitted zones. Restricted and no-fly zones are not offered — they have no slot grid, and listing one so it can refuse is a control that exists to say no.

**Verified — in Chrome, over HTTP, both locales:**

| Criterion | Result |
|---|---|
| **The date strip is exactly `maxAdvanceDays`** | OK — 15 buttons for a zone with `maxAdvanceDays: 14`, today first |
| **Full, closed and past slots are distinct and unclickable** | OK — passed slots render dashed, struck through and `disabled` with *"Already passed"*; the available one carries `0 / 6` |
| **`blocked` is its own state** | OK, and found by using it: after booking 15:00 in Thumamah, the 15:00 slot in **Ammariyah** read *"You already hold this time"* rather than "full". That is `pilotBusySlots` reaching the picker through `listSlotsAction` |
| **The capacity meter shows real counts** | OK — `0 / 6`, `dir="ltr"` so it does not reorder to `6 / 0` in Arabic |
| **Ineligible aircraft are disabled with the reason** | OK — revoked, expired and not-yet-approved drones all listed, greyed, each with its own sentence; bookable ones first with their Remote ID |
| **The acknowledgement starts unchecked and blocks submission** | OK — "next" was `disabled: true` before the tick and `false` after |
| **The safety card restates the zone's own rules** | OK — ceiling 120 m, and **the chosen day's** hours: `06:00 – 11:00, 15:00 – 18:00` on a Wednesday, `06:00 – 11:00, 15:00 – 20:00` on the Thursday |
| **The review says which outcome is coming** | OK — Thumamah: *"This zone approves automatically"*; Ammariyah: *"…sends a request, and a GACA reviewer decides"* |
| **Auto-approve lands `approved`, a normal zone lands `pending`** | OK — two bookings in `RUH-P-01` are `approved`, one in `RUH-P-06` is `pending`, and the audit table holds 3 × `booking.requested` + 2 × `booking.auto_approved` |
| **The confirmation says which** | OK — *"Your flight is booked / The slot is yours"* against *"Your request has been sent / A GACA reviewer will decide"* |
| **Refusals render in place with the form intact** | OK — a landline typed as a co-pilot mobile bounced from step 6 back to **step 4** with the message under the field and every other answer still set |
| **The server refuses independently of the form** | OK — before the profile was verified, a form that passed every client check was refused by the action with `identity_unverified` **on the review step**, with its fix |
| **Co-pilots are written** | OK — `سارة العتيبي` / `Sara Al-Otaibi`, and `0512345678` stored as `+966512345678` |
| **The detail page leads with the Remote ID** | OK — `AJN-7Q4M-31KD`, monospace, `ltr`, above everything else |
| **The timeline shows only what happened** | OK — requested and approved carry instants; checked-in and completed are present and unfilled |
| **Cancel until `slotStart − 2h`, as an absolute time** | OK — a 15:00 slot showed *"until 19 August 2026 at 13:00"*; a 06:00 slot showed 04:00 |
| **Check-in is absent outside the window** | OK — no check-in control on a slot starting six hours later |
| **Someone else's booking is a 404** | OK — a well-formed but nonexistent id renders Next's 404, not a permission error |
| **All times Riyadh, Gregorian, Latin numerals** | OK in both locales, throughout |
| **375 px** | OK — via the iframe (thread 44): `scrollWidth === clientWidth` on the wizard and the detail page, nothing wider than the viewport |

- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (**1113**), `pnpm test` (**695**), `pnpm build` — all green.

**The pilot profile was verified in the dev database, with the user's agreement.** `pilot_profile.verified_at` was `null`, which is correct — a human reviewer sets it and **F22's review queue does not exist** — but it meant `identity_unverified` refused every booking *and* every green map answer, so the happy path of both F20b and F21a was unreachable. One `UPDATE` on the local Docker database, which is exactly what F22's reviewer will do. It stays verified: that is the realistic demo state.

**Not verified:**

- **The last-seat race.** Capacity is 4–6 on the seeded zones and losing the race needs concurrent pilots; the alternatives UI is wired and F13's suite covers the transaction, but no seat was actually contended in a browser. **The `slot_full` toast with three alternatives is therefore code that has been read, not run.**
- **Pilot B opening pilot A's booking.** A nonexistent id 404s, which exercises the same branch — but the *ownership* half needs a second account, and **the first account created becomes admin**, so probe accounts are forbidden here.
- **Rate-limited booking attempts.** The countdown toast is wired to `errors.rateLimited`; no burst was staged against `booking.create`.
- **A rejected or authority-cancelled booking rendering its reason verbatim.** Both need a reviewer, which is F22.
- **Check-in inside the window.** It needs a slot starting within fifteen minutes; the window is computed on the server clock and the control was confirmed absent outside it, but never seen present.
- **Dark mode and 1440 px** on these two screens.

**Next session should know:**

- **F21b finishes Wave 6**: `/bookings` with its four tabs, and the pilot dashboard — action-required, next flight with a countdown, drone summary, recent bookings, and the day-one onboarding state. `listMyUpcomingBookings` and `listMyPastBookings` already exist in `src/lib/data/booking.ts`.
- **Three real bookings now sit in the dev database** (two approved in Thumamah, one pending in Ammariyah, one with a co-pilot). The dashboard and the list have data to render on their first run, which the empty states will need to be checked *around* rather than instead of.
- **`validateCopilots` and `FLIGHT_PURPOSES` are pure and shared.** F22's reviewer screen shows both; read them from `src/lib/validation/booking.ts` rather than restating the purpose list.
- **F22 is what makes `verified_at`, rejections and cancellations reachable**, and four of this session's unverified items are waiting on it.
- **The profile's ID number is still fabricated** (`1055512345`), and threads 50 and 51 are open. All three are the user's to resolve.

---

### Session 23 — Wave 6 · F20b Tap-to-evaluate, the status panel and the controls (**F20 complete**)

**Date:** 2026-08-19
**Status:** ⚠️ done with deviations · **F20 is complete.** Ran straight on from Session 22 without a `/clear`, at the user's request. **F21 is now unblocked and is the last feature in Wave 6.**

**The map answers now.** Tap a point and the panel says allowed, needs review, or denied, with the zone's ceiling, capacity and today's hours — or with every reason it refused and what would fix each one.

**Two evaluations, and they are the same function.** Every change runs `evaluateAirspace` in the browser against the zones already in memory, so the panel answers on the frame of the tap; 250 ms later `checkAirspaceAction` runs the identical function on the server over a context it assembles itself, and its answer replaces the local one. This is the whole reason `evaluate.ts` is pure, and it is what F20's consistency claim rests on.

**What the local pass is short of, and why that is safe.** It has the zones, the aircraft and the pilot; it does **not** have `availability`, `pilotBusySlots` or `pilotBookingsOnDay` — facts about *other people's bookings* that no browser should hold. Every reason those three produce is a refusal, so their absence can only make the local answer **more permissive**, never less. `map-consistency.test.ts` asserts that direction rather than leaving it as a claim, and it is why a green panel still says *"confirming with the server"*.

**Built:**

- `src/components/map/airspace-explorer.tsx` — the one owner of point, altitude, aircraft, time, zones and decision. `AirspaceMap` became a **controlled renderer**: the viewport fetch and its bbox cache moved up here, because a component that draws zones and a component that evaluates against them holding separate copies is how a map ends up answering about polygons it is not showing.
- `src/components/map/status-panel.tsx` — the three states, and `DecisionReasons` (F12's shared component) gets its **first consumer**, exactly as its docstring anticipated.
- `src/components/map/map-controls.tsx` — altitude slider, aircraft select, day + time selects.
- `src/components/ui/slider.tsx` — a **native** `<input type="range">`, styled. Same argument as `Select`: the browser reverses the track under `dir="rtl"` by itself, the touch target is the platform's, and arrow keys / Home / End / `aria-valuenow` come free. A div-and-pointer-maths slider gets RTL wrong in exactly one language, and it is this app's primary one.
- `src/lib/maps/probe.ts` + 16 tests — day options, the time grid, and `selectionForInstant`. Pure, and built on `deriveSlots` / `riyadhInstant` rather than a second date arithmetic written for the map.
- `probeGeoJson` / `probeHaloLayer` / `probeMarkerLayer` in `layer-styles.ts` — the marker and its halo, coloured by a `match` on the decision status using **the same three `--zone-*` tokens the polygons use**. Green already means "you may fly here" everywhere else; a fourth palette would ask the reader to learn the scheme twice.
- `src/lib/airspace/map-consistency.test.ts` — 12 tests, below.
- 22 catalogue keys (**1010**).

**The consistency proof, and the one place the two paths cannot agree.**

`map-consistency.test.ts` runs the map's query (`point` + altitude + slot) and `createBookingAction`'s query (`zoneId` + the same altitude and slot) over **one** context, and asserts the same status *and the same reason codes* for allowed, needs-review, and six denials — above the ceiling, outside opening hours, off the slot grid, weight class, build type, and a suspended zone.

**They differ in exactly one case, and it is a property of the data.** A `booking` row has no coordinate, so the booking action names a zone — and a zone query cannot test containment, so a **no-fly overlay inside a permitted zone is invisible to it** while the map, which always has a point, refuses. The direction is the safe one: the map is *stricter*, so it never shows green where booking would refuse. The inverse is real, and the test pins it, because it is the argument for **F23 refusing to publish a permitted zone that overlaps a no-fly one**, and for F21 carrying the point forward rather than only the zone.

**A fixture that was wrong, and the engine that was right.** The first draft anchored every case at 06:00 and everything failed. On 15 March, sunrise in Riyadh is 06:04 — so a 06:00 slot begins four minutes before dawn and `night_operation_not_permitted` rode along with whatever each case meant to test. The suite moved to the 15:00 afternoon anchor and says why.

**Deviations, each with its reason:**

- **The time control offers the whole day, not only bookable slots.** Two `<optgroup>`s: the zone's real grid anchors first, then every other half hour. A control that only permitted valid times could never produce *"the zone is closed at this time, it next opens at…"*, which is one of F20's acceptance criteria and is the answer a pilot most often wants. The off-grid times are honest too: `slot_not_on_grid`'s fix says *"choose a slot from the grid shown"*, and the grid is literally the group above it.
- **The time defaults to "any time", not to the next open slot.** Before a tap there is no zone, so there is no slot grid to default into, and forcing a time would answer a question the reader has not asked. Instead the panel turns the engine's own `nextOpenAt` into a button — *"use the next opening"* — which sets the day and time in one press. That is the F20 intent with the ordering fixed.
- **The aircraft selector defaults to the pilot's only approved drone — and only when there is exactly one.** With two or more it opens on "no aircraft", because the answer changes with the airframe and picking the first of several answers for a drone nobody chose.
- **Every drone is listed, not only the approved ones**, with its status in the label. Choosing a rejected airframe is how a pilot finds out that `drone_not_approved` — rather than the airspace — is what stands in their way.
- **The altitude slider stops at 400 m and marks 120 m rather than enforcing it.** The engine refuses on the *zone's* ceiling, which is often lower — Wadi Namar's is 80 m. A slider capped at the national limit would hide that; one that said nothing would let a pilot drift past it.
- **No "Book this zone" button.** Settled with the user beforehand: F21 does not exist, and a button to a route that 404s is worse than none. The allowed panel names the next step in words. Same call as F16a's footer.
- **No full-screen map with a bottom sheet at 375 px.** F20 asks for one; `/zones` is a *document with a map in it* — header, disclaimer, legend, and the full zone table — and a full-screen map with a drag-up sheet fights every one of those. The panel stacks under the map instead and works at 375 px. The bottom sheet belongs to the signed-in `/map` surface in F20's file list, which this build has not created; **F21 needs that surface and should build it there.**
- **`/zones` reads the zones twice.** `zonesForViewport` returns full `ZoneRule`s because the browser evaluates against them; `listActiveZones` returns the display rows the list has always used, which carry the district and the notes. Same table, same filter, two projections — collapsing them means either pushing prose into the engine's context or dropping it from the page.

**Two defects found by opening the page:**

1. **The zone name was printed twice in every refusal.** `DecisionReasons` captions each reason with its zone, which is right for F21's list where reasons can cite *different* zones — but the map's panel already names the zone as its heading, so a reader saw *العمارية* and then *العمارية* again under each line. The caption now appears only when the reasons cite more than one distinct zone, which is better everywhere.
2. **The fixture-level one above** — recorded here too because it is the same class: a check that looked broken and was the code being right.

*(A third was investigated and was not a defect: the tab appeared to freeze after the first tap, and a screenshot timed out. Network showed **one** request for one tap, no loop; the renderer was busy with a dev-mode RSC refresh and the WebGL canvas screenshots blank mid-repaint. Recorded because "the map froze" was one step from becoming a second thread 53.)*

**Verified — in Chrome, on the dev server *and* on a production `next start`:**

| Criterion | Result |
|---|---|
| **Tap a permitted zone** | OK — **مسموح**, with the zone name, ceiling 120 m, requested altitude, capacity *6 aircraft per slot*, and Wednesday's hours `06:00 – 11:00, 15:00 – 18:00` |
| **The third state exists and is distinct** | OK — Ammariyah (`autoApprove: false`) gives **يحتاج مراجعة** with the "a GACA reviewer decides" note, visibly different from both green and red |
| **Default-deny is visible** | OK — empty desert gives `outside_permitted_zone` with "pick a point inside a permitted zone", and **no zone name**, because there is no zone |
| **A no-fly zone** | OK — KKIA CTR gives `inside_no_fly_zone`, *"there is no exception here"* |
| **The restricted ground** | OK — Greater Riyadh gives `inside_restricted_zone` |
| **Above the ceiling** | OK — 400 m over Ammariyah: *"the requested 400 m exceeds the zone ceiling of 120 m"*, fix *"reduce to 120 m or below"*. Wadi Namar refuses **120 m** against its own 80 m ceiling, which is the whole reason the slider does not enforce the national limit |
| **Outside operating hours** | OK — 03:00 gives `zone_closed_now` **and** `slot_in_past`, with the next opening as **19 أغسطس 2026 في 15:00** — Gregorian, Latin numerals, inside an Arabic page |
| **The fix is an action** | OK — *"use the next opening"* moved the day and time to 19 Aug / 15:00, **and 15:00 landed in the "bookable slots" group**, so the control's grid and the engine's `nextOpenAt` agree |
| **The aircraft selector changes the answer** | OK — the revoked drone adds `drone_revoked` + `remote_id_not_active` with their fixes; the approved one clears both |
| **Every denial offers a next step** | OK — every refusal seen rendered its `airspace.fixes.*` line |
| **Panning fires one debounced fetch** | OK — one request per tap and per gesture; no per-frame traffic |
| **375 px** | OK — via the iframe (thread 44): `scrollWidth === clientWidth`, nothing wider than the viewport, tap works inside the frame, panel and controls legible and mirrored |
| **English** | OK — a real translation throughout, including the optgroup labels |
| **Dark mode** | OK for the panel and controls, by adding `.dark` by hand (thread 48): lifted status edge, legible reasons, slider and selects styled. The **basemap** stays light — thread 54, unchanged |
| **Production** | OK — the same tap, the same local-then-confirmed answer, and `window.__ajnihaMap` still `undefined` |
| **Console** | OK — zero errors from the app (two from an unrelated Chrome extension) |

- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (**1010**), `pnpm test` (**674**), `pnpm build` — all green.

**Not verified:**

- **A green answer end to end as this signed-in pilot.** The seeded profile is not identity-verified, so `identity_unverified` accompanies every answer for this account — correct behaviour, and it means the allowed and needs-review panels were confirmed by **temporarily** rendering the page with `pilot={null}` (the signed-out path) and reading the local decision inside the 250 ms confirmation window. The edit was reverted in the same session. **F22's review queue is what makes this reachable normally.**
- **Rate limiting under rapid tapping.** The debounce means a burst of taps produces one request per settled point, but no burst was actually staged against `airspace.check`'s limit.
- **`slot_full`, `duplicate_booking` and `max_slots_per_day` in the browser.** They need real bookings in the slot; they are covered by `map-consistency.test.ts` and by F13's suite, and the server confirmation is what would surface them.
- **The cache invalidation criterion.** It names F23, which does not exist.
- **1440 px was looked at by me only.**

**Next session should know:**

- **F21 is the last feature in Wave 6 and nothing blocks it.** The explorer already holds the point, altitude, aircraft and slot in the shape `createBookingAction` wants; the *Book this zone* control is the only thing deliberately missing.
- **F21 should build the signed-in `/map` surface**, and put the full-screen-plus-bottom-sheet layout there. `nav.map` has existed in both catalogues since F16a and still points at nothing.
- **`AirspaceMap` is controlled now.** It takes `zones`, `probePoint`, `probeStatus` and reports `onPointSelected` / `onViewportChange`. Do not give it state of its own again.
- **F23 must refuse a permitted zone that overlaps a no-fly zone.** `map-consistency.test.ts` documents why: a zone query has no point, so the overlay is invisible to the booking path.
- **The profile's ID number is still fabricated** (`1055512345`), and threads 50 and 51 are open. All three are the user's to resolve.

---

### Session 22 — Wave 6 · F20a Airspace Map (**thread 53 closed — the map draws**)

**Date:** 2026-08-19
**Status:** ✅ **F20a is done.** `/zones` renders the interactive MapLibre map; F20b (tap-to-evaluate, the three-state panel, the controls) is untouched and is the next feature.

**The bug was one line of MapLibre's, and it was invisible from every angle the last session looked from.**

`maplibre-gl.mjs` locates its own worker by resolving `./maplibre-gl-worker.mjs` against its `import.meta.url`. Bundled, that module is a hashed chunk, so the computed URL is `/_next/static/chunks/maplibre-gl-worker.mjs` — **404**. MapLibre attaches no `error` listener to the `Worker` it has just constructed, so nothing throws and nothing logs: the worker pool exists, and answers nothing, for ever. Every symptom followed from that:

- `ajniha-zones` sat at `_isUpdatingWorker: true` with a `_pendingWorkerUpdate` that never resolved, so `GeoJSONSource.loaded()` was false for ever.
- `Style.loaded()` is `_loaded && no updated sources && every tile manager loaded && imageManager.isLoaded()`, so it was false for ever too.
- **`openmaptiles` reporting `loaded: true` was a false negative, not a clue.** A vector source with *zero* requested tiles is trivially loaded — and no tiles were ever requested, because nothing rendered. Last session read that as "vector tiles parse fine in the same worker", which pointed the search at the GeoJSON path, and the GeoJSON path was innocent. **A `loaded()` that is true because nothing was asked for looks exactly like a `loaded()` that is true because everything succeeded.**
- Bypassing the RTL plugin flipped `areTilesLoaded()` because registering the plugin is itself a worker round-trip. Two symptoms, one cause — not two issues stacked.

**Proved before fixing**, by fetching the URL MapLibre computes: `/_next/static/chunks/maplibre-gl-worker.mjs` → 404, while the four chunks the bundler *did* emit for `maplibre-gl` are all present under mangled names.

**The fix — `setWorkerUrl` at a vendored copy**, which was untried step 1 in the thread.

- `scripts/vendor-rtl-plugin.mts` became **`scripts/vendor-map-assets.mts`** (`pnpm vendor:map`, replacing `pnpm vendor:rtl`) and now copies three files, not one: the RTL plugin as before, plus `maplibre-gl-worker.mjs` **and `maplibre-gl-shared.mjs`** into `public/vendor/maplibre/`. The pair is not optional — the worker's first line is `import … from "./maplibre-gl-shared.mjs"`, and vendoring the worker alone reproduces the same silent hang one directory along.
- `src/lib/maps/worker-url.ts` — `setMapWorkerUrl()`, called as the **first statement of `ensureRtlTextPlugin`, before its own guard**. The ordering is load-bearing and is not obvious: the pool is built once from whatever URL is set at that moment, and `setRTLTextPlugin` is what builds it. Set it after and it is ignored.
- `src/lib/maps/worker-url.test.ts` — the vendored worker and shared module are byte-identical to the installed package, the worker still carries the relative import, and the URL is same-origin and not the `-dev` build.

**`pnpm vendor:rtl` no longer exists.** Earlier entries in this log that name it describe what was true then; the command today is `pnpm vendor:map`.

**Then the map was mounted, and opening it found one more defect** — thread 11 again, and one more page that was wrong with every check green:

- **`DEFAULT_CENTER` / `DEFAULT_ZOOM` cut off the airspace.** At zoom 9 on `[46.68, 24.72]` the northern and southern zones fell outside the frame, so a page whose entire job is to publish the airspace opened showing about three quarters of it. The camera now fits the union of the zones actually being drawn (`fitToZones`, from `computeBbox` + `unionBounds` — the same primitives the SVG uses), **once, on first style load only**: refitting on the viewport refetch would yank the camera back on every pan, and refitting after a fallback style swap would move the ground under somebody already reading it.

**Built / changed:**

- `/zones` renders `MapMount` + `ZoneLegend` in place of `ZoneDrawing`. **The zone list, its hours and its permissions are untouched**, as F16b said they should be. The landing page keeps the SVG.
- `map.ariaLabel` and `map.tileFailure` added to both catalogues (**988**). The three map strings are passed in pre-translated — `MapMount` is a client component with no next-intl provider — and they come from the `map` namespace rather than `zones`, because F20b's panel will read the same one.
- `AirspaceMap`'s docstring no longer says it does not render.

**Verified — in Chrome, on the dev server *and* on a production `next start`:**

| Criterion | Result |
|---|---|
| **The map draws at all** | OK — and **in production**, which is where last session reproduced the failure. `/vendor/maplibre/*.mjs` both 200 with `application/javascript` |
| **All 12 seeded zones** | OK — `querySourceFeatures` returns 12 distinct codes: 7 permitted, 4 no-fly, 1 restricted |
| **KKIA's interior ring is a hole** | OK — the annulus renders as a ring, over tiles and over the fallback ground |
| **Arabic labels connected and in order** | OK — *نطاق مطار الملك خالد الدولي* reads correctly. This is `setRTLTextPlugin` working, from the vendored copy |
| **The `coalesce` fallback** | OK, in both directions — every basemap symbol layer is rewritten to the coalesce expression, an English page shows *طريق الملك عبد العزيز* for a feature with no `name:en`, and an Arabic page shows *Eastern Ring Road* for one with no `name:ar`. Without the fallback both would render blank |
| **Colours match the tokens** | OK — resolved to `#e4a339` / `#3d9c5e` / `#d73337` through the canvas pixel read-back, matching the legend swatches beside them |
| **Tile failure** | OK — `fetch` to `tiles.openfreemap.org` rejected and the map remounted: plain ground, **all 12 zones still drawn with the no-fly hatch and KKIA's hole**, bilingual notice below, exactly one console error and it is our own diagnostic |
| **375 px** | OK — via the iframe (thread 44): `scrollWidth === clientWidth`, no element wider than the viewport, whole extent visible, legend mirrored |
| **Dark mode** | Partly — by adding `.dark` by hand and soft-navigating to force a remount (thread 48). Zone fills take the dark `--zone-*` values and stay legible; **the basemap does not**, see thread 54 |
| **`dir="ltr"` container** | OK — geography not mirrored in Arabic; the chrome around it is |
| **The dev-only map handle** | OK — `window.__ajnihaMap` is `undefined` on the production serve |
| **The landing page is unchanged** | OK — 12 SVG paths, **zero** map or vendor requests. The two-renderer split holds |
| **No API key** | OK — nothing added to `.env`; the tile host, the fonts, the sprite and now the worker are all keyless |

- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (**988**), `pnpm test` (**646**), `pnpm build` — all green.

**Not verified:**

- **Everything under F20's *Interaction* heading**, which is F20b: tap-to-evaluate, the three-state panel, the altitude slider, the drone selector, the time selector, and the map-versus-`createBooking` consistency proof.
- **The mobile bottom sheet.** 375 px was checked for overflow and legibility; the full-screen-map-plus-sheet layout is F20b's, because the sheet *is* the panel.
- **A cold tile failure.** The fallback was exercised in a tab that had already fetched the glyph ranges, so its labels drew. On a genuinely cold failure the glyph host is unreachable too and the zone labels will be absent — which `FALLBACK_STYLE`'s comment already accepts, but it has not been seen.
- **MapLibre's attribution control wraps to two lines at 375 px** and covers the scale bar. It is MapLibre's own control and the attribution stays legible, which is what ODbL asks for, but nobody has decided it looks right.

**A trap that cost time and will again:** a **stale production server on 3002** answered the first probe of this session, serving a build from before the vendoring — which looked exactly like the fix failing in production. It was the previous session's process, still running from the day before. `next start` will not serve a `public/` file that appeared after its own build, so check *which* server is answering before believing a 404.

**Next session should know:**

- **F20b is next, and F21 is blocked on it.** `evaluate.ts` is pure and the map already holds the viewport's `ZoneRule`s in `cacheRef`, so the tap handler has everything it needs without a round trip.
- **`src/lib/maps/worker-url.ts` is not optional and its call order is not decorative.** Any second map surface — F23's terra-draw admin map — must go through `ensureRtlTextPlugin` (which sets it) rather than constructing a `Map` directly, or it will hang exactly the way this did.
- **Re-run `pnpm vendor:map` after any `maplibre-gl` or `@mapbox/mapbox-gl-rtl-text` bump.** The tests fail loudly if you forget; a stale worker would not.
- **`/zones` reads the `map` namespace for the map's own strings.** F20b's panel keys belong there, not under `zones`.
- **The profile's ID number is still fabricated** (`1055512345`) — unchanged, and the user's to resolve. So are threads 50 and 51.

---

### Session 21 — Wave 6 · F20a Airspace Map (partial — **the map does not render**)

**Date:** 2026-08-18
**Status:** ⚠️ **incomplete.** The supporting work is done and tested; the MapLibre map itself is written, not mounted, and blocked on **open thread 53**.

**Settled with the user before building:** F20 is split (F20a = the map and its layers; F20b = tap-to-evaluate, the status panel and the controls), and the *Book this zone* button waits for F21 rather than shipping as a disabled control pointing at a route that does not exist.

**Done, and verified:**

- **Open thread 10 is closed.** `src/lib/seed/self-intersection.test.ts` computes self-intersection over **every ring of all 12 seeded zones** using F12's own `segmentsIntersect`, so the check runs against the same primitive that decides containment. A bow-tie control and a plain-square control prove the detector actually detects. This could never be caught by looking: MapLibre and the SVG both happily fill a self-intersecting ring, while `pointInRing`'s even-odd ray cast disagrees with it — a permitted zone whose green covers ground the engine refuses.
- **`src/lib/maps/`** — `config`, `rtl-plugin`, `color-resolve`, `layer-styles`, `zone-palette`, with 19 tests.
- **`zone-palette.ts` is now the single source for the draw order and the `--zone-*` variables**, shared by the SVG renderer and the map. Two renderers exist deliberately: the landing page stays server-rendered SVG with **zero** JavaScript, because paying ~800 kB of map engine for a picture nobody interacts with is the wrong trade on the one page that has to load fast.
- **The RTL text plugin is vendored, not CDN-loaded** (`pnpm vendor:rtl` → `public/vendor/`), with a test asserting the committed bytes match the installed package. Arabic is the primary locale; a third-party outage must not be able to disconnect its letterforms.

**Three real bugs found by opening the page**, none of which any static check sees:

1. **`oklch()` → `lab()`, not hex.** F20's design says resolve the token through a canvas `fillStyle` round-trip. Chrome now serialises `oklch()` as `lab(72.0461 18.396 61.7206)`, which MapLibre rejects exactly as firmly — *"color expected"* — so every zone layer failed to add. Fixed by **painting the colour to a 1×1 canvas and reading the pixel back**; bytes cannot drift with a browser's preferred serialisation.
2. **An infinite fallback loop that froze the tab.** `map.isStyleLoaded()` is also false while the *fallback* style loads, so an error in that window re-entered `setStyle`, which errored, which re-entered. Now a one-shot flag plus an explicit `styleLoaded` latch.
3. **Our own `addLayer` failures were arriving as "the basemap is down".** MapLibre routes style-validation errors through the same `error` event a dead tile host uses, so bug 1 tripped the tile fallback. Our work is now caught locally so the two kinds of failure stay apart.

**A wrong diagnosis, corrected — worth recording because it cost the most time.** A worker probe showed the RTL plugin never calling `registerRTLTextPlugin`, and I concluded the current release (0.4.0) was incompatible with MapLibre and pinned back to 0.3.0 — **breaking rule 2 to do it**. The probe was wrong: it checked synchronously, and the plugin registers *after* instantiating WebAssembly, ~1.5 s later. Given time, **both release lines register fine**. The pin was reverted and the dependency is back on current stable. No version number remains in the tree.

**Not done — open thread 53.** The map renders nothing. `/zones` therefore **keeps F16b's SVG**, which works; `MapMount` is wired and one import away.

- ✅ `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (986), `pnpm test` (**643**), `pnpm build` — all green.
- ✅ `/zones` re-verified after the revert: 12 SVG paths, 12 zone cards, no raw keys, no overflow.
- ❌ **The MapLibre map is unverified against every one of F20's rendering criteria** — Arabic labels, the `coalesce` fallback, KKIA's hole, the tile-failure notice, 375 px. None of them can be checked until it draws.

**Next session should know:** thread 53 is the whole of F20a's remaining work, and the diagnosis in it is precise — start there, not from scratch. `window.__ajnihaMap` is a dev-only handle on the live map object, which is what made the diagnosis possible.

---

### Session 20 — Wave 6 · F16b Concept Pages (`/how-it-works`, `/remote-id`, `/zones`)

**Date:** 2026-08-18
**Status:** ⚠️ done with deviations · **F16 is complete.**

**The headline is a premise that did not survive its own primary source.** `/remote-id` was built with the sources actually fetched and read, and GACA's own E-Book Volume 18 contradicts a sentence in `CLAUDE.md`: **GACA registration does not require a manufacturer serial number.** Table 1 makes the serial essential information for the **Specific Category only**; Note 3 asks for it in the Open Category *"if this information is available"* and says the identifier an aircraft displays is *"either the GACA registration certificate number or the UAS serial number"*. See **Open Thread 50** — the fix is a one-line correction to `CLAUDE.md`, and it is the user's call, not mine.

**The rest of the premise held, exactly.** GACAR Part 107, Subpart F: *"This Subpart is applicable as of 1 January 2026."* § 107.302(b): every registered UA **and model aircraft** must be equipped with Direct or Network Remote ID. Quoted verbatim on the page, from the PDF.

**Two calls settled with the user before building**, as asked:

1. **`/zones` ships now**, with F16a's SVG plus a real zone list — not deferred into F20.
2. **`/remote-id` cites real sources**, fetched and read, rather than shipping with a "sources pending" note.

**Built:**

- `/[locale]/(public)/{how-it-works,remote-id,zones}/page.tsx`.
- `src/components/layout/public-page.tsx` — `PublicPage` + `Section`. Still **not** a `layout.tsx`, for F16a's reason.
- `src/components/airspace/zone-drawing.tsx` — F16a's SVG **lifted out of `landing/map-preview.tsx`** and shared. Two components drawing the same polygons with their own fill rules is the drift the single-projection rule exists to stop.
- `src/components/airspace/zone-list.tsx` — every active zone, its permissions, and its week of opening windows.
- `src/lib/landing/sources.ts` — 7 documents and 10 verbatim quotations, each with the date it was read.
- `formatWeekday` and `formatMinuteOfDay` in `src/lib/format.ts`, with tests (**623**).
- 123 catalogue keys (**983**).

**The research, and what it cost.** eCFR blocks non-browser requests; `www.gaca.gov.sa` serves its homepage for every `/-/media/` path. The apex `gaca.gov.sa` serves the PDFs and **does not need the `?as=0&hash=` query** the search results carry. `107-v5.pdf` does not exist under any name tried — **Part 107 v4 is what was read**, and the page says so rather than rounding to "GACA says". GACA's Log of Versions (2 Aug 2026) confirms the current edition is 5.0 and that its changes are Standard Scenarios and pilot training, **not Subpart F**.

Trade press said edition 5 introduced Remote ID. The primary source says Subpart F was already in v4. **Two secondary sources agreed with each other and were both imprecise** — which is the argument for reading the document.

**Deviations, each with its reason:**

- **`/zones` has no booking control.** The engine's answer depends on the aircraft's weight class and build type; a button on a page that knows neither would promise an outcome it cannot check. It sends you to registration instead.
- **Quotations are verbatim, `dir="ltr"`, and untranslated**, with the Arabic gloss around them. A paraphrase inside quotation marks puts words a regulator never wrote in a regulator's mouth, on the one page whose whole argument rests on what they did write. Document titles are untranslated for the same reason — a translated title is an uncheckable citation.
- **`14 CFR Part 89` is credited to Cornell LII, not eCFR.** LII is what was actually read. Citing the canonical URL because it is canonical would be claiming a read that never happened.
- **`/remote-id` ends with "what it is not"** — not a radio, not a certified DRI/NRI system, not issued by GACA, does not make a flight lawful. Without it the page is accurate throughout and still leaves a reader believing a sticker makes their aircraft compliant.
- **The landing page now links to all three** (`Steps` → `/how-it-works`, `RemoteIdExplainer` → `/remote-id`, `MapPreview` → `/zones`). Before this the front door had no route to any of them. **The footer still ships no navigation** — F26 and F27 add their own.
- **`formatMinuteOfDay` formats in UTC, not `Asia/Riyadh`.** A `zone_hour` is a time *of day* already in Riyadh civil time; running it through the +3 offset again publishes 09:00 for a zone that opens at 06:00. There is a test that says so.

**Two defects found by opening the page**, with `typecheck` and `lint` green — thread 11's fourth proof:

1. **No-fly zones rendered "Ceiling: 0 m".** Every seeded no-fly zone stores `ceilingAglM: 0` as a sentinel for "no altitude at all"; under the heading *Ceiling* that reads as a limit you could fly under, which is the opposite of the rule. Permissions — the ceiling included — are now shown for **permitted zones only**.
2. **The concept pages' prose was centred while the header and footer stayed at the wider measure**, so the page's start margin moved between the chrome and the content. In RTL it is the *right* edge that drifts, which is the one the eye follows down the page. Fixed by matching `max-w-6xl` and setting the reading measure with an inner, uncentred `max-w-3xl`.

*(A third was a judgement call rather than a defect: the week of opening hours was a two-column grid, so the days zig-zagged and the times landed in two alignments — the eye had to hop to compare Thursday with Friday, which is the comparison somebody planning a flight is making. Now one column.)*

**Verified — in Chrome, over HTTP:**

| Criterion | Result |
|---|---|
| All three pages, both locales | OK — no raw message keys, no `MISSING_MESSAGE`, zero console errors |
| **Every cited URL** | OK — all 7 re-fetched and 200; the 3 GACA links serve `application/pdf`, the 4 LII links `text/html` |
| **Every quotation** | OK — copied from the extracted text, not recalled. § 89.305(a) was re-fetched a second time asking for the paragraph *verbatim*, because the first fetch had paraphrased it |
| **Opening hours** | OK — `RUH-P-01` prints Sunday first, Friday split `06:00 – 10:00, 15:30 – 20:00` around Jumu'ah, Latin numerals in Arabic, and **not** shifted by +3 |
| Zone list | OK — 12 zones, grouped permitted → restricted → no-fly, permitted first because that is the question being asked |
| **375 px and 768 px** | OK — via the iframe (thread 44), both locales, all three pages: `scrollWidth === clientWidth`, no element wider than the viewport. The long English blockquotes were the risk and they wrap |
| **Dark mode** | OK — by adding `.dark` by hand (thread 48). Quotations legible, section numbers not reordered |
| **Bidi** | OK — `§ 107.302(b)` renders as written inside an Arabic page, not as `(b)107.302 §`. Times are `dir="ltr"` so `06:00 – 11:00` does not read as opening at 11:00 |
| Every internal link | OK — 4 landing links, all locale-prefixed; every route 200s (`/drones/new` and `/dashboard` 307 to sign-in, which is the proxy doing its job) |
| **Landing page after the refactor** | OK — 12 SVG paths, the demo QR still a data URI, legend intact |
| **Message keys** | OK — 141 keys resolved statically against `ar.json`, including every branch reached through a template literal. `i18n:check` cannot do this: it compares the catalogues to *each other*, so a key missing from both passes, which is how `nav.dashboard` shipped in F16a |

- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (983), `pnpm test` (**623**), `pnpm build` — all green. The three routes build **dynamic**: they read the session for the primary action, and `/zones` reads the seeded rows.

**Not verified:**

- **The three-year registration validity could not be confirmed.** GACAR Part 48 could not be retrieved under any filename tried. The three-year periods that *do* appear in Part 107 are the UAS Operator Certificate's duration (§ 107.131) and a record-retention rule — neither is a drone registration. `remoteId.validity` is therefore a **product decision, not a cited fact**, and `/remote-id` does not present it as one. **Thread 51.**
- **Nothing checked the polygons for self-intersection.** Unchanged. **Thread 10 stays open** for F20.
- **No theme toggle**, so dark mode was reached by adding the class by hand. Thread 48.
- **1440 px was looked at by me only.** The concept pages are a single narrow column on a wide screen, which is right for prose and is a choice somebody may disagree with.
- **`layout.tsx` metadata untouched**, as F16 requires. F30 owns `<head>`.

**Next session should know:**

- **F16 is done. F20 is the critical path** — F21 is blocked on it, and it is the feature that closes thread 10.
- **F20 replaces the picture on `/zones` and the landing page, and leaves the list alone.** Both read `src/components/airspace/zone-drawing.tsx`; swap that one component. The zone table, its hours and its permissions are not F20's to touch.
- **`src/lib/landing/sources.ts` is the citation module.** Anything that cites a regulation goes through it, and nothing goes in that has not been opened and read. **F26's docs and F27's legal pages will both want it.**
- **`formatWeekday` / `formatMinuteOfDay` exist now** — F21's slot picker and F23's hours editor should use them rather than writing a second weekday table.
- **The profile's ID number is still fabricated** (`1055512345`) — unchanged, and the user's to resolve.

---

### Session 19 — Wave 6 · F16a Public Landing (tokens, chrome, landing page)

**Date:** 2026-08-18
**Status:** ⚠️ done with deviations · **F16 is half done.** F16b is the three concept pages.

**The design tokens finally have values.** Every palette in this build until now was shadcn's neutral default — `--primary` was near-black. F16 owns the one place they are set, so `globals.css` now carries a deep aviation blue-teal primary checked in **both** `:root` and `.dark`, cool-grey neutrals, `--radius: 0.5rem`, and the three domain tokens `--zone-permitted` / `--zone-restricted` / `--zone-no-fly` with their `-foreground` pairs, exposed to Tailwind through `@theme inline`. **F20's map and every status badge read these**, so a zone is one colour everywhere.

**Three calls settled before building** — two with the user, one recorded:

1. **F16 is split.** F16a = tokens, chrome, landing page. F16b = `/how-it-works`, `/remote-id`, `/zones`.
2. **The example card's code is reserved.** `AJN-DEM0-CARD` is in `RESERVED_CODES` and `issueRemoteId` skips it, so the public landing page can never one day point at a real pilot's aircraft. No demonstration registration was seeded — the scan honestly reports `not_registered`, which is the mechanism being shown.
3. **The map preview is an SVG, not MapLibre** (my call, recorded in F16's file). F20 owns the interactive map and a second one here would be two implementations of the same picture.

**Built:**

- `/[locale]/(public)/page.tsx` — the landing page. **F02's Wave 1 placeholder is gone.**
- `src/components/landing/` — `hero`, `problem`, `remote-id-explainer`, `map-preview`, `steps`, `for-gaca`.
- `src/components/layout/` — `site-header`, `site-footer`, `disclaimer`.
- `src/lib/geo/project.ts` + tests — a pure equirectangular projection with a `cos(lat)` correction.
- `src/lib/landing/demo-card.ts` — the reserved code and its QR as a data URI.
- 42 catalogue keys (**860**).

**Deviations, each with its reason:**

- **The airspace preview is a static SVG of the real seeded rows.** It reads `listActiveZones` — the same reader the rest of the app uses — so the front door shows what a pilot is actually judged against. It cannot pan or zoom and answers no airspace question. **F20 replaces the picture, not the data.**
- **The demo QR is a data URI, not a stored blob.** Nothing here is owned by anybody, so there is no row to check ownership against and no pathname to sweep; `/api/files` exists to guard *someone's* file. It is rendered by `renderQrPng` — F08's encoder, same payload builder, same error correction — so it is the product, not a picture of it.
- **The footer ships no navigation at all.** Docs, Privacy and Terms all belong to F26 and F27 and do not exist. A footer link to a 404 is worse than a footer without one.
- **No `(public)/layout.tsx`.** The auth pages have their own frame and F11's scan page is a field inspector's surface; a shared public layout would push a marketing header onto both. The pages compose the header and footer instead.
- **`SiteFooter` prints a fixed year, not `new Date()`.** A page whose output depends on when it was rendered is untestable by definition.
- **The card's dates are fixed constants.** Computing them from `now` would let an example card drift into looking like a live record.

**Two defects found by opening the page**, with `typecheck` and `lint` green:

1. **`nav.dashboard` did not exist in either catalogue.** The header printed the raw key `nav.dashboard` to a signed-in reader, and the server logged `MISSING_MESSAGE`. **`i18n:check` cannot see this** — it compares the two catalogues to each other, and a key missing from both is missing consistently. Exactly the failure `drone-actions.tsx` documents. Key added to both.
2. **The map preview rendered about 1,500 px tall and swallowed the page.** The viewBox aspect comes from the real extent of the seeded zones and Riyadh's is tall, so `h-auto` alone let it run. Now capped at 26 rem with `preserveAspectRatio="xMidYMid meet"`, which letterboxes rather than distorting — a map may not be squashed to fit a box.

*(A third was investigated and was not a defect: `getComputedStyle` reported the light `--primary` on a button while `<html>` already carried `.dark`. The compiled rule is `background-color: var(--primary)` and both palettes are emitted; a screenshot showed the dark primary rendering correctly. The computed-style read was stale. Recorded because the wrong conclusion was one step away.)*

**Verified — in Chrome, over HTTP:**

| Criterion | Result |
|---|---|
| `/` signed out | OK — 307 to `/ar`, full landing page in Arabic RTL |
| **The seeded polygons, drawn** | OK — **the first time anyone in this build has seen them** (thread 10). 12 zones: an amber restricted city, green permitted carve-outs, red no-fly overlays, and KKIA's ring rendering as a genuine hole, so `fill-rule="evenodd"` is doing its job. No self-intersection artefact visible. They are plainly *authored* regular polygons, which is what the disclaimer beside them says |
| **A real card with a real QR** | OK — encoded by F08's encoder, labelled *بطاقة توضيحية* |
| **What the QR resolves to** | OK — `/api/rid/AJN-DEM0-CARD` signed out returns `not_registered`; the human page 200s. The code is reserved, so it stays that way |
| No raw message keys anywhere on the page | OK — after fixing `nav.dashboard` |
| **Dark mode** | OK — by adding `.dark` by hand: dark ground, the lifted teal primary carrying dark text, and **the QR keeping its white plate**, which is what makes it scannable at all |
| The problem above any feature list | OK — three beats, then the answer, then how it works |
| Nothing implying endorsement | OK — *مبادرة مقترحة* eyebrow, the proposal notice in the footer, no logo, seal, quotation, rating or count anywhere |
| **375 px, 768 px, 1440 px** | OK — via the iframe (thread 44), Arabic and English: `scrollWidth === clientWidth`, no overflowing element |
| English | OK — a real translation, not transliterated |
| **No regression from the token change** | OK — `/ar/drones` re-opened: teal primary, badges and cards intact |
| **Console** | OK — zero errors after the fix |
| **Mutation testing** | 4 mutants against the projection, **4 killed**: the y-flip, the `cos(lat)` correction, merged rings (which would paint a carve-out over a zone instead of punching a hole), and ignored padding |

- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (860), `pnpm test` (**619**), `pnpm build` — all green. `/[locale]` builds **dynamic**, which it must: the primary action depends on the session and the preview reads the seeded zones.

**Not verified:**

- **`layout.tsx` metadata is untouched**, as F16 requires — so the landing page still carries whatever title F02 set. **F30 owns `<head>`** and is the only step that sees every public page.
- **Nothing checked the polygons for self-intersection.** They have now been *seen* and look clean, which is not the same as tested. **Thread 10 stays open** for F20.
- **No theme toggle exists**, so dark mode was reached by adding the class by hand. Thread 48.
- The hero leaves a lot of empty space to one side at 1440 px. Deliberate — the brief puts the visual weight on the map rather than on illustration — but it has not been looked at by anyone but me.

**Next session should know:**

- **F16b is next**: `/how-it-works`, `/remote-id`, `/zones`. `/remote-id` is the intellectual core of the pitch and needs real sources.
- **The design tokens are set and are not to be re-picked.** `--zone-*` are consumed by the map preview today and by **F20's map** next; anything that needs a zone colour reads the token.
- **`src/lib/geo/project.ts` is not a map.** If F20 needs a projection it should use MapLibre's, not this — this exists so the landing page can draw without a map library.
- **`AJN-DEM0-CARD` is reserved in the codec.** If the landing card's code ever changes, change `RESERVED_CODES` with it; `demo-card.ts` throws at import if the two disagree.
- **The profile's ID number is still fabricated** (`1055512345`) — unchanged, and the user's to resolve.

---

### Session 18 — Wave 6 · F19b Print View, Downloads and Declared Modules

**Date:** 2026-08-18
**Status:** ⚠️ done with deviations · **F19 is complete.** Ran straight on from Session 17 without a `/clear`, at the user's request.

**The headline is a bug that had been sitting in the tree since Wave 4: F07's declaration-document upload was unreachable code.** `getDeclarationForUpload` gated on `acceptsUploads` — `isDroneEditable`, which is `draft | rejected` — but a `remote_id_declaration` references `remote_id`, and `remote_id` is minted **inside the approval transition**. The two conditions cannot both hold for any row that has ever existed, so the kind rule, the storage prefix, the data helper and the route branch all sat behind a condition nothing could satisfy. Found by reading `getDeclarationForUpload` before writing the form, which is the only reason it was found at all.

**Built:**

- `/[locale]/(app)/drones/[id]/remote-id/print` — wallet card and a 50/30/20 mm sticker sheet.
- `src/app/print.css` — `@page`, chrome hidden, millimetres on screen as well as in print.
- `src/components/remote-id/` — `declare-module-form`, `print-button`.
- `declareModuleAction` in `src/lib/actions/remote-id.ts`, and a `declaration.create` limit (10/hour).
- `src/lib/validation/declaration.ts` + tests — the pure kind list and validator.
- `acceptsDeclarations` / `DECLARABLE_DRONE_STATUSES` in `src/lib/validation/drone.ts`.
- Download QR PNG, through the owner-checked file route.
- 26 catalogue keys (**818**).

**Deviations, each with its reason:**

- **The declaration gate is `approved` only, and deliberately disjoint from the editable list.** A test asserts the two never overlap and says why, so a later session cannot helpfully collapse them back into one predicate and silently re-break the path.
- **`listDroneFilePathnames` now collects declaration documents, superseded ones included.** It did not, and `remote_id_declaration` cascades away with the drone — taking every `docPath` with it and leaving the PDF in storage with nothing able to name it. That is the orphaned-blob privacy leak of thread 31, not merely waste. It was harmless while no `docPath` could be written; **fixing the gate is what created the exposure**, so closing it belongs to this session.
- **The form does not collect `validFrom` / `validUntil`.** They describe when a *certificate* is valid, and a pilot typing them before anyone has read the certificate would put an unchecked claim on the card beside the verified ones. **F22's reviewer sets them.** The columns stay nullable and pilot-unwritten — named here so the next session does not read them as dead.
- **Declaring supersedes; it never edits.** Supersede runs **before** the insert, or re-declaring the same module collides with the row it is replacing — the partial unique index is `(kind, module_serial) where superseded_at is null`. Proven both ways.
- **A declaration must identify the module** — manufacturer, serial or certificate reference, at least one. A row carrying only a kind asserts a module exists without saying which.
- **No notification, but always an audit event.** The only person to tell is the one who pressed the button; the reviewer-facing side is F22's queue. A declaration is a regulator-facing claim, so the trail gets it regardless.
- **The proposal notice prints on the artefact**, not only on the page that made it. A card in a wallet outlives the browser tab.

**Three defects found by opening the page**, with `typecheck` and `lint` green throughout:

1. **`DECLARATION_KINDS.map is not a function`** — a runtime `TypeError` on first render of the form. `src/lib/actions/remote-id.ts` is `"use server"`, and such a module may export **only async functions**: Next wraps every export as a server reference, so the array arrived in the browser as a callable proxy. The types said `readonly string[]` the whole way. Moved to `src/lib/validation/declaration.ts`, which is where the validator belonged anyway — the fix made the rule testable, and it now has 10 tests and 6 killed mutants.
2. **The empty-form refusal rendered twice** — once at the field and once at the foot of the form, reading as two different problems. `declaration_empty` and `declaration_too_long` are about the *combination* of three fields, so they are form-level; only `declaration_kind_required` and `module_serial_claimed` belong to an input.
3. **The duplicate-serial refusal threw instead of refusing.** Drizzle wraps driver errors, so postgres.js's `code`/`constraint_name` sit on `.cause`, not on the error — the top-level check found nothing, the `catch` re-threw, and a legitimate refusal came back as a server error. It now walks the cause chain **and matches the constraint by name**, so a future unique index on that table is never reported to a pilot as "that serial is already declared".

**Verified — in Chrome, over HTTP, against the live database:**

| Criterion | Result |
|---|---|
| **A declaration added with a PDF, shown as pending** | OK — **the first time this path has ever executed.** Row written, `verifiedAt` null, badge *بانتظار التوثيق* |
| **The PDF went through the real dropzone** | OK — a genuine PDF put on the file input, stored at `declarations/{id}/{uuid}.pdf`. **F07's dropzone had never taken a file in any session** |
| Audit trail | OK — `remote_id.module_declared`, then `declaration.document_uploaded` |
| **Superseding** | OK — three declarations on one aircraft, exactly one active, the card renders only that one and no superseded row leaks |
| **Re-declaring the same serial on the same aircraft** | OK — succeeds; supersede-before-insert means it does not collide with itself |
| **The same serial on a second aircraft** | OK — `module_serial_claimed`. One module broadcasts one identity |
| An unknown kind, a drone that is not mine | OK — `declaration_kind_required`, `not_found` |
| The empty form | OK — the app's own Arabic refusal, once, with `aria-invalid` on the field. No native `required` anywhere (thread 46) |
| **Print view** | OK — wallet card and sticker sheet, Arabic and English |
| **Physical sizes** | OK — measured: 189 / 113 / 76 px for 50 / 30 / 20 mm and 324 px for 85.6 mm, each exactly the 96 dpi conversion |
| Print rules loaded | OK — the `@media print` block and its `@page` rule are in the CSSOM; the hide selectors match 1 `header`, 1 `nav` and 7 `.print-hidden` elements |
| The proposal notice | OK — on the wallet card and the sticker sheet themselves |
| **375 px, Arabic** | OK — card and both print views via the iframe (thread 44): `scrollWidth === clientWidth`, no overflowing element |
| **Console** | OK — zero errors, zero warnings |
| **Mutation testing** | 6 mutants against `validateDeclaration`, **6 killed** — the ceiling, the empty check, its `&&`, the trim, the every-field loop, and the inverted kind check |

- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (818), `pnpm test` (**608**), `pnpm build` — all green. Both `/remote-id` and `/remote-id/print` build **dynamic**.

**Not verified:**

- **Nothing has been printed.** No paper and no phone camera, so *"a printed 20 mm QR scans from ~15 cm"* stays **unverified** — F19 explicitly allows naming it rather than claiming it. **Thread 47.**
- **"Printed output uses the light palette even in dark mode" is currently vacuous.** Nothing in this app ever applies `.dark` — there is no theme toggle. The print override and the explicit `bg-white` / `text-black` on the printed surfaces are written for when one arrives; **re-check when F28 ships a toggle.**
- **The print dialog itself was never opened.** `window.print()` blocks the page on a native dialog, which the browser tooling cannot dismiss — so the button is wired and unexercised. The rules it depends on were verified from the CSSOM instead.
- **No reviewer has verified a declaration**, because `verifiedAt` is F22's to write. The *unverified* state is the one that renders today; `moduleVerified` and `moduleRejected` have catalogue keys and have never been shown.

**Next session should know:**

- **F19 is done. F16, F20 and F21 remain in Wave 6.**
- **`acceptsDeclarations` (approved) and `isDroneEditable` (draft, rejected) are different questions and must stay disjoint.** A test says so. Collapsing them makes the declaration upload unreachable again.
- **`DECLARATION_KINDS` and `validateDeclaration` live in `src/lib/validation/declaration.ts`.** Never export a constant from a `"use server"` module — it reaches the browser as a callable proxy and every static check stays green.
- **F22 owns `verifiedAt`, `rejectedAt` and the validity window** on a declaration. The pilot writes none of them.
- **Probe data is still seeded**, now including declarations and one uploaded PDF. `scripts/probe-drone-states.mts clean` sweeps it, and the sweep now takes declaration documents with it.
- **The profile's ID number is still fabricated** (`1055512345`) — unchanged, and the user's to resolve.

---

### Session 17 — Wave 6 · F19a Digital ID Card & QR (card, QR, copy, privacy)

**Date:** 2026-08-18
**Status:** ⚠️ done with deviations · **F19 is half done.** F19a is the card; F19b is the print view, the downloads and the declared-modules form.

**The QR was rendered before any card code was written**, as the last session asked. `npx inngest-cli dev`, then a real `drone/approved` event per approved probe drone — so the job ran for real: render → store → `qrPathname` written → approval email attempted. The card was built against a real pathname from the first line, and the missing-QR state against a genuinely null one.

**Two judgement calls settled with the user before building, not half-way:**

1. **F19 is split.** F19a = card, QR, tap-to-copy, privacy explainer, access. F19b = print view, downloads, declared-modules form. F18 had to split mid-flight; this one was decided at the start.
2. **"Download card as a print-ready PNG" is cut**, replaced by the print view's own Save-as-PDF. Nothing installed can rasterise styled Arabic server-side, and every candidate is worse than the browser: **satori has no HarfBuzz**, so Arabic renders with its letters unjoined — a defect that ships looking *almost* right — while resvg or puppeteer buys a native binary for one button. The browser's print pipeline shapes Arabic correctly with the app's real fonts and emits vector. **Download QR PNG stays** for F19b: those bytes already exist. Recorded in F19's file with the reasoning.

**Built:**

- `/[locale]/(app)/drones/[id]/remote-id` — owner-only, `approved`-only.
- `src/components/remote-id/` — `id-card`, `qr-display`, `copy-code`, `declared-modules`, `privacy-explainer`.
- `src/lib/qr/store.ts` — `storeQrForRemoteId`, **the one path that writes `qrPathname`**, now called by both F08's job and F19's retry.
- `regenerateQrAction` in `src/lib/actions/remote-id.ts`, and a `remote_id.qr_render` limit (10/hour).
- `src/lib/remote-id/privacy-fields.ts` + its test — the explainer's two columns, held against `redactRemoteId`'s real output.
- 68 catalogue keys (**792**).

**Deviations, each with its reason:**

- **The approval email had been linking to `/drones/{id}/card`, which was never a route.** `qr-render.ts` built that URL and the template's sample repeated it, so every approval email ever sent pointed at a 404 — invisible, because no approval has been driven through a UI and no Resend key exists. Both now say `/remote-id`. Found by reading the job before writing the renderer, which is why the hand-off said to read it.
- **The retry renders inline; it does not enqueue a job.** F19 specifies the *approval* render as a job and it stays one — nobody is watching, so a transient failure must retry itself. The retry is a person pressing a button, and queueing that answers them with a spinner and no outcome, including when Inngest is the thing that is down — which is exactly when a QR is missing. **Not a second renderer**: `storeQrForRemoteId` is one function with two callers, which is also how the job got *smaller* this session.
- **`renderQrPng` was left exactly as F08 wrote it.** The hand-off warned that two renderers is the drift F11's single-projection rule exists to stop; the answer was to move the *storage* half out, not to write a new encoder.
- **The fleet-wide "re-render every QR after `APP_URL` changes" admin action is not built.** `regenerateQrAction` is per-aircraft (owner or admin). The sweep belongs beside F29's `APP_URL` health check, which is the thing that would prompt it; building it here would put an admin control on a pilot's card.
- **The card renders declared modules but cannot add one.** The empty state states a fact — no external module is declared, and the Ajniha code *is* the aircraft's Remote ID — and promises no control, because F19b owns the form. An empty state advertising a button that does not exist is the empty-Billing-tab lie.
- **Superseded declarations are not rendered.** They are kept for the regulator's "what was broadcasting on 3 March"; the card answers "what is broadcasting now", and mixing the two reads as several live modules.
- **A new kind of test: the privacy explainer is held against the projection, not against F11's feature file.** `privacy-fields.test.ts` compares the two rendered columns to `redactRemoteId`'s actual output in three directions — a field a bystander receives that the card does not describe, a field the card claims is public that is not, and a **new owner-only field** the "not shown" column never mentions. This is the one statement in the repo that can go silently false, because it is a promise about other people's data made to a pilot deciding whether to print a sticker.

**One rendering defect found by opening the page**, with `typecheck`, `lint` and `build` green:

1. **Pilot-authored strings on the card carried no `dir="auto"`** — nickname, manufacturer, model, owner name. Exactly F18b's defect 2 in a new place: on the English card an Arabic nickname is the one run whose direction is not the page's, and inherited direction mis-sets its punctuation. All now carry `dir="auto"` with `text-start`.

*(The QR looked blank in the first screenshot and was not — the capture caught it mid-decode. Confirmed by drawing the element to a canvas: 1322 dark pixels of 4096. Recorded because "the image is missing" was the wrong conclusion and a screenshot was the reason for it.)*

**Verified — in Chrome, over HTTP, against the live database:**

| Criterion | Result |
|---|---|
| **A real QR, rendered by the real job, on screen** | OK — Arabic and English, served from `/api/files/qr/…` |
| **What the QR encodes** | OK — the stored PNG is **byte-identical** to a fresh encode of `http://localhost:3001/ar/rid/AJN-2B8T-55WX`, with an `/en/` encode as a control that differs. So it encodes that URL and no other, at level H, 512 px |
| Following the scan target | OK — `/ar/rid/AJN-2B8T-55WX` resolves to the right aircraft |
| **The "generating…" state** | OK — against a genuinely null `qrPathname` with its blob deleted: dashed panel, no broken image, no blank space |
| **The retry** | OK — pressed in the browser, the QR appeared |
| **Idempotence** | OK — 10 renders of one code: same pathname, same bytes, still one file in `uploads/qr` |
| Tap-to-copy | OK — the clipboard held `AJN-7Q4M-31KD` **with its dashes**; "تم نسخ الرمز" announced, then reverted |
| Dates and numbers | OK — `18 أغسطس 2026`, `11 يوليو 2029`, `2,100 غرام` — Gregorian, Latin, both locales |
| The serial row | OK — absent on every self-built airframe |
| **The privacy explainer against the live anonymous payload** | OK — `/api/rid/{code}` signed out returns exactly the fields the "shown" column describes, and nothing the "hidden" column calls private |
| **Card unreachable unless approved** | OK — draft, pending, rejected, expired and revoked all **404**, indistinguishable from a non-existent id, with no code or nickname in the body |
| Signed out | OK — 307 to `/ar/sign-in` for every id, existing or not |
| **Pilot B** | OK — 404 on the card, `not_found` from the action posted directly, and **404 on the QR image itself**. Probe account created over HTTP and deleted after |
| **The action posted directly** | OK — `not_approved` for draft/pending/revoked, `not_found` for a nonexistent id, from the owner's own session |
| **The new rate limit** | OK — fires on the 11th call in an hour with `retryAfterSeconds`; bucket cleared afterwards |
| **375 px, Arabic** | OK — via the iframe (thread 44; `resize_window` not used). Card, generating state and English: `scrollWidth === clientWidth`, no overflowing element, code and QR both legible |
| **Console** | OK — 23 messages, all DevTools / HMR / Fast Refresh. Zero errors, zero warnings |
| **Mutation testing** | 3 mutants against the privacy guard, **3 killed**: a nickname leaked into `PublicFields` (caught twice, from both directions), a new undocumented owner-only field, and a deleted Arabic line |

- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (792), `pnpm test` (**595**), `pnpm build` — all green. `/[locale]/drones/[id]/remote-id` builds **dynamic**.
- Probe rows left in place deliberately — F19b needs them. `pnpm exec tsx scripts/probe-drone-states.mts clean` sweeps them. The probe *account* was deleted; `user` is back to 1, still admin.

**Not verified:**

- **No QR has been scanned by a real phone**, and none has been printed. The byte-identity proof says what the image encodes; it does not say a camera can read it off paper at 20 mm. **F19b's print view is where that gets tested**, and it needs real paper.
- **The `drone/approved` events were sent by hand** (`curl` at the dev server's `/e/` endpoint), not by `approveDroneAction`. Thread 41 moves but does not close: the **job** half now demonstrably runs end to end against real rows — render, store, write the pathname, attempt the email (`email_log` shows `drone-approved`, status `skipped`, no Resend key) — while the seam from the *action* that sends the event is still structural, because no approval has ever been driven through a UI. **F22.**
- **`linkNotificationEmail` did nothing**, because the raw-SQL probe rows carry no notifications. Unchanged from F18b.
- **No screen reader.** The `aria-live` copy confirmation and the `role="status"` generating panel were written for one and have never been heard by one.
- **The blob driver still has not run** (threads 30 and 31). The QR is stored through the same `putFile` as everything else, so it inherits that gap exactly.

**Next session should know:**

- **F19b is next**: the print view, the downloads, and the declared-modules form. `/[locale]/drones/[id]/remote-id/print`, `src/app/print.css`, and a `Download QR PNG` link — **not** a card PNG; that is cut, and the reasoning is in F19's file.
- **`storeQrForRemoteId` in `src/lib/qr/store.ts` is the only thing that may write `qrPathname`.** `render.ts` above it stays the pure encoder. Do not add a third caller that does its own `putFile`.
- **`src/lib/remote-id/privacy-fields.ts` is the explainer's source of truth**, and its test fails if F11's projection changes. If it does fail, write the pilot-facing line — updating the map alone silently removes the promise.
- **The probe drones are still seeded**, including one approved drone with a rendered QR (`AJN-7Q4M-31KD`) and one whose QR was deleted and re-rendered (`AJN-2B8T-55WX`).
- **The profile's ID number is still fabricated** — `1055512345`, unchanged from Session 16. Left alone deliberately: the user said it is theirs to resolve, and every submit/resubmit/renew gate needs a complete profile.

---

### Session 16 — Wave 6 · F18b Drone Detail, States and Deletion

**Date:** 2026-08-18
**Status:** ⚠️ done with deviations · **F18 is complete.** Second half of the split begun in Session 15.

**All six status screens exist and all six were opened in a browser** — including `approved`, `expired` and `revoked`, which no earlier session could reach. Four rendering defects were found by opening them, none of which any check in this repo catches. And **`drone.test.ts` has now been broken on purpose**: the step Session 15 skipped.

**Mutation testing first, as the last session asked.** 25 mutations against `src/lib/validation/drone.ts`, **21 caught, 4 survived**:

- **Three were real gaps, and all three were the same shape: every length _ceiling_ was untested.** Deleting `> NICKNAME_MAX_LENGTH`, relaxing `> TEXT_MAX_LENGTH` to `>=`, and dropping `< SERIAL_MIN_LENGTH` each left all 15 tests green. Nothing stopped an unbounded nickname reaching a NOT NULL column, and a one-character serial would have been accepted onto a commercial airframe as a manufacturer's serial. Three tests added; a second round of 6 mutations (including the ceilings' mirror cases) caught all of them.
- **One is a provably equivalent mutant**, recorded rather than "fixed": `serialNumber: serialRequiredFor(buildType) ? serial : null` → `serial || null`. No input distinguishes them, because the non-commercial-with-a-serial path returns early with `serial_not_applicable`. No test can kill it and none was written.
- `isDroneEditable` was added this session and mutated too — 4 mutations, all 4 caught.

**Built:**

- `/[locale]/(app)/drones/[id]` and `/[locale]/(app)/drones/[id]/edit`.
- `deleteDroneAction` in `src/lib/actions/drone.ts`; reuses the `drone.draft` limit.
- `getMyDroneDetail` in `src/lib/data/drone.ts` — one ownership check, then photos and Remote ID in parallel.
- `src/components/drones/` — `status-panel` (the six screens), `rejection-notice`, `drone-actions` (submit / resubmit / renew / delete), `editor`, `spec-table`.
- `scripts/probe-drone-states.mts` — seeds one drone per status, and sweeps its own blobs.
- 51 catalogue keys (**737**).

**The judgement call, settled with the user before building:** the three unreachable screens are seeded by a **raw-SQL probe script**, not by driving `src/lib/workflow/`. Why it is defensible: F14 already proved every drone edge 34/34 against the live database, so what these rows are needed for is *rendering*. The cost, stated rather than hidden — the seeded rows carry **no audit events** and a hand-set `registrationExpiresAt` rather than one `registrationExpiryFrom` computed, so **"the audit trail keeps a rejection reason the row cleared" could not be re-shown this session**; F14 proved it. Nothing in the app writes a status this way and the script says so in its header.

**Deviations, each with its reason:**

- **`saveDroneDraftAction` now accepts `rejected`, not only `draft` — F18a had it wrong.** F07 settled this in Wave 4: `EDITABLE_DRONE_STATUSES` is `["draft", "rejected"]`, so a rejected drone had been accepting new *photographs* for four waves while the action refused to let its *weight* be corrected. A pilot told "the declared weight does not match the airframe" could not act on it, which is the dead end F18 says a rejection must never be. **The list moved to `src/lib/validation/drone.ts`** — pure, so a client component can ask without pulling `src/lib/storage` into the browser bundle — and `storage/validate.ts` re-exports it rather than keeping a second copy. One list, one rule, and a test asserts the two predicates agree. `pending` / `approved` / `expired` / `revoked` are still refused, which is the half F18a proved over HTTP.
- **Delete reads the pathnames, deletes the bytes, and only then deletes the row.** `drone_photo` cascades, and the instant it does every pathname the app knew is gone with it — nothing left in the database would ever tell you the files were orphaned. The ordering deliberately chooses the *recoverable* failure: a row-delete that fails after the bytes are gone leaves a draft with broken thumbnails that a second delete fixes, whereas the other order fails to a blob nobody can see or clean up. (F07 ships `listDroneFilePathnames` + `deleteFile`; **there is no `deleteDroneFiles`** — the name in the hand-off does not exist.)
- **No audit event for deleting a draft**, matching F18a's call on creating and editing one. The trail starts at `drone.submitted`; a draft never entered it, so an event recording its deletion would be the only trace in the regulator's trail of an aircraft that was never registered.
- **The approved screen offers no "Book a flight".** F21 owns booking and does not exist; a button whose only destination is a 404 is exactly what F18a refused to ship on the list card. It links to **`/rid/{code}`** instead — F11's real scan page — described as *"what somebody scanning your aircraft sees"*. F19's card, QR and print view remain F19's.
- **Delete confirms in ordinary markup, never `window.confirm`.** A native confirm speaks the *browser's* language — the same class of defect as `<input type="date">` in F17 — and blocks the page entirely while open. It names the aircraft rather than asking "are you sure?" about an unnamed thing.
- **The edit page is one screen, not a five-pane wizard**, but it renders `StepType` and `StepSpecs` directly rather than re-implementing them — so the rule that the serial field is *absent* for self-built and FPV lives in exactly one place. A pilot correcting one queried field should not have to click Next four times to reach it.
- **Which control leads on a draft depends on the draft.** With no photograph, Submit can only be refused, so Continue is primary; with one, Submit is. The submission gate still runs either way — this only decides which control looks like the next step.
- **`pending` 404s on `/edit`** rather than rendering a disabled form. A form that invites the work and then refuses it is worse than no form.
- **`/drones/[id]` uses `getMyDroneDetail`, not `getDroneById`.** The latter also answers for a reviewer, and this page hands over Submit, Edit, Renew and Delete. Reviewing is F22's job with F22's screen.

**Four rendering defects found by opening the page. `typecheck`, `lint`, `build` and 586 tests were green through all four — open thread 11 again:**

1. **The list card printed "valid until 11 July 2029" on a _revoked_ registration** whose Remote ID was suspended, and "valid until" on an expired one. `registrationExpiresAt` outlives the registration it belonged to. Now `approved` says *valid until*, `expired` says *expired on* (new key), and `revoked` gets **no date at all** — it was ended by a decision, not by the calendar.
2. **An Arabic rejection reason had its full stop set at the left-hand end on `/en`.** The reviewer's sentence is the one string on the page whose direction is not the page's, and it inherited LTR. Both quotes now carry **`dir="auto"`** with `text-start`.
3. **The delete confirmation rendered wedged between Continue and Submit**, at whatever width was left over, because it replaced a flex item in their row. `w-full`.
4. **`profile_incomplete` rendered as a sentence with nothing to press.** F18 says every refusal carries a link to what answers it. Now a `?next=`-carrying link to `/profile/complete`, and the return journey was walked.

**Two failing tests fixed that F18b did not cause**, because they broke the gate:

- **`codec.test.ts` asserted a statistically false property, and failed on this session's run.** Its comment computed the *per-insert* collision probability (~9 × 10⁻⁸) and then drew a conclusion about a batch of 10⁵ draws; the birthday bound over the batch is **~4.6 × 10⁻³**, so `expect(size).toBe(100_000)` fails about one run in 220. It was also arguing against the code it tests — `issueRemoteId` carries a savepoint retry loop *because* collisions happen, and F10 proved that loop by forcing one. Now asserts **≤ 3 duplicates**, a threshold a generator that had lost entropy (thousands of collisions) still fails. Re-run three times, green.
- **The suite's 5 s default timeout was flaking three different tests.** `render.test.ts` failed first, then across three consecutive runs of an otherwise unchanged tree the failures moved to `time.test.ts`'s 365-day `Intl` cross-check and F17's ID-exposure source scan — all timeouts, no assertion ever failed. Several tests here are deliberately expensive and get more so every wave: **three of them scan every file under `src/`**, so F18b's six new files were enough to tip whichever was closest. Fixed **once, globally**, as `testTimeout: 20_000` in `vitest.config.mts` rather than per test as each one flakes — a suite whose result depends on machine load teaches everybody to re-run until green, which is how a real failure gets waved through. **Four consecutive full runs green afterwards.**

**Verified — in Chrome, over HTTP, against the live database:**

| Criterion | Result |
|---|---|
| **All six status screens opened** | OK — draft, pending, approved, rejected, expired, revoked, in Arabic |
| The rejection reason, **verbatim** | OK — a three-line Arabic reason with its line breaks intact, and correctly set after the `dir="auto"` fix |
| A `pending` drone cannot be edited or deleted **by calling the action directly** | OK — `not_editable` and `not_deletable`, posted from the owner's own session. Row unchanged |
| An `approved` drone cannot be deleted | OK — `not_deletable` |
| **A `rejected` drone _can_ be edited by the action** | OK — `{"ok":true}`, which is the F18a bug fixed |
| Resubmitting increments `rejectionCount` | OK — 1 → 2, the row's reason cleared, status `pending` |
| **Renewal keeps the Remote ID code** | OK — `AJN-9K3P-64VZ` unchanged through `expired` → `pending`, with `drone.renewal_submitted` in the trail |
| Deleting a draft removes its rows **and** its blob | OK — through the UI, with a real uploaded PNG: `uploads/` 1 → 0 files, row gone, redirected to the list |
| **Pilot B opening pilot A's drone** | OK — 404 on detail *and* edit, indistinguishable from a non-existent id, **no drone data in the body**. Probe account created over HTTP and deleted after |
| **A _reviewer_ opening another pilot's drone** | OK — the same 404. The probe was promoted to `reviewer` and the run repeated |
| Signed out | OK — 307 to `/ar/sign-in` |
| `profile_incomplete` on Renew | OK — refusal rendered, link followed, profile completed, `?next=` returned to the aircraft |
| The serial row, commercial vs self-built | OK — `1581F5FMD23AB00X1234` rendered for the commercial airframe, **absent** for every self-built one |
| **The 30-day expiry tint** | OK — **first time seen in this build.** Red border and "تنتهي قريباً" on the card 11 days from expiry, untinted beside one three years out |
| **A Remote ID code on a list card** | OK — **first time in this build.** Latin, monospace, LTR under its Arabic label |
| The public-record link | OK — `/ar/rid/AJN-7Q4M-31KD` resolves to F11's scan page |
| Weight boundary, live, on the edit form | OK — 249 g → صغيرة جداً with the "may be exempt" note, saved and re-rendered |
| English LTR | OK — the revoked screen read correctly; the Arabic reason stayed Arabic |
| **375 px, Arabic** | OK — via the iframe (thread 44; `resize_window` not used). **Six routes**, `scrollWidth === clientWidth`, no overflowing element on any |
| **Console** | OK — 12 messages, all React DevTools / HMR / Fast Refresh. Zero errors, zero warnings |

- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (737), `pnpm test` (**589**), `pnpm build` — all green. `/[locale]/drones/[id]` and `/[locale]/drones/[id]/edit` both build **dynamic**.
- **Every probe row deleted**, and the blobs with them: `drone`, `drone_photo`, `remote_id` and `notification` back to **0**, `uploads/` empty, the three probe `audit_event` rows removed, both probe accounts deleted (`user` back to 1, still admin). The 12 seeded zones untouched.

**⚠️ The pilot profile holds a fabricated identity number.** `1055512345`, built by the app's own `saudiIdCheckDigit` rather than recalled from anywhere — it was needed because `submitDrone` / `resubmitDrone` / `renewDrone` all gate on a complete profile. **F18a deleted the previous profile for exactly this reason, and this one has the same problem.** It was left in place because this session was asked to fill it and because F19–F21 all need it, but **it should be replaced with the owner's real number, or deleted.** `pilot_profile` is 1 row.

**Not verified:**

- **No approval has ever been driven through a UI.** `approveDroneAction` and `rejectDroneAction` still have no caller — the seeded `approved` and `rejected` rows were written by SQL. **F22 owns that**, and it is what would close threads 40 and 41.
- **The audit trail's rejection-reason property was not re-shown** — a direct consequence of the raw-SQL seed, above. F14 proved it 34/34.
- **Photos are still uploaded by `fetch` and by SQL, never by dropping a file on the dropzone.** F07's drag-and-drop remains unexercised, exactly as after F18a.
- **No screen reader.** The `alertdialog` on the delete confirmation, the `alert` on the rejection notice and the `dir="auto"` quotes were all written for one and have never been heard by one.
- **`already_applied` and `invalid_transition` have catalogue keys but were never rendered** — they need a page that has gone stale against a decision, which needs F22.
- The spec table prints the unit twice — label *الوزن (غرام)*, value *3,400 غرام*. Inherited from F18a's review pane; left alone rather than changed in two places late in a session.

**Next session should know:**

- **F18 is done. F16, F19, F20 and F21 remain in Wave 6.**
- **`isDroneEditable` in `src/lib/validation/drone.ts` is the one answer** to "may this pilot still change this registration". Do not write `status !== "draft"` anywhere — that is the bug this session fixed.
- **`scripts/probe-drone-states.mts` re-seeds all six statuses in one command** and sweeps its own blobs on `clean`. F19's card, F20's map and F21's booking all need an approved drone carrying a Remote ID, and this is the cheapest way to get one until F22 exists.
- **F19 owns the QR, the card, tap-to-copy, the print view and the module-declaration form.** F18 renders the code as text and links to `/rid/{code}`.
- **The profile's ID number is fabricated** — see the warning above.

---

### Session 15 — Wave 6 · F18a Drone Registration (wizard and list)

**Date:** 2026-08-18
**Status:** ⚠️ done with deviations · **F18 is split; this is the first half.** Ran in the same context as Session 14, no `/clear` between.

**The product does its thing now, through a browser.** A self-built airframe with no serial number was registered end to end by a person clicking, not by a probe script — and **a server action was driven over HTTP with a real session cookie for the first time in this build.**

**Built:**
- `src/lib/validation/drone.ts` — **pure**: `weightClassFor`, `mayBeExempt`, `serialRequiredFor`, `validateDroneType`, `validateDroneSpecs`. Plus `drone.test.ts` (15). Suite **583 across 26 files**.
- `saveDroneDraftAction` in `src/lib/actions/drone.ts`; `drone.draft` added to `LIMITS`.
- `listPhotoAndRemoteIdForDrones` in `src/lib/data/drone.ts` — one batched query for the list, ownership re-checked rather than trusting the id list it is handed.
- `/[locale]/(app)/drones` and `/[locale]/(app)/drones/new`.
- `src/components/drones/` — `wizard`, `step-type`, `step-specs`, `step-remote-id`, `step-photos`, `step-review`, `card`, `status-badge`.
- **`Field` and `FormProblem` moved to `src/components/form/`** and took a `namespace` prop. F17 wrote them for the profile; F18 needed identical wiring against `drones.errors.*`, and a copy is two places that can disagree about how a field announces itself to a screen reader. All nine profile call sites updated.
- 58 catalogue keys (**690**).

**Deviations, each with its reason:**
- **The row appears at pane 2, not pane 1.** `drone.nickname`, `buildType`, `weightGrams` and `weightClass` are all NOT NULL. Same shape as F17's `pilot_profile`, same resolution: five panes, first write at the second, and the UI only claims a step is saved where it is. **`nickname` had no step assigned in F18's spec at all** — it is on pane 1.
- **Declaring an existing Remote ID module moved to after approval.** `remote_id_declaration.remoteIdId` is NOT NULL onto `remote_id`, which F10 issues **only on approval** — a draft has nothing to hang a declaration on. Pane 3 states what the aircraft *gets* instead, and says a module can be declared once approved. F19's card owns the form. Rejected alternative: a nullable `droneId`, which needs a migration, a two-nullable-FK invariant nothing enforces, and would leave F10's "one module per airframe" index (keyed on `remoteIdId`) unable to stop two pilots claiming the same module while in draft.
- **F18 renders no QR.** Settled with the user up front. The card shows the code as text; F19 owns the QR, the print view and tap-to-copy. F18's "shows a scannable QR" criterion is F19's and is **not met yet**.
- **The build type is three radio cards, not a dropdown.** A dropdown hides two of the three answers behind a click, and the two it hides are `self_built` and `fpv` — the aircraft this product exists for.
- **The serial field is absent for self-built and FPV**, not disabled and not marked optional. A greyed-out field that does not apply to you still reads as something you are missing. The server agrees: `validateDroneSpecs` returns `serial_not_applicable` for a serial that arrives anyway, rather than dropping it silently.
- **`saveDroneDraftAction` takes the build type from the validated pane-1 payload**, never from the specs payload — otherwise a direct POST could claim `self_built` on one pane and `commercial` on the other and slip past the serial rule in whichever direction suited it.
- **No audit event for creating or editing a draft.** `audit_event` is the regulator's approval trail; a pilot typing a weight into a form they have not submitted is not a decision anybody answers for. The trail starts at `drone.submitted`.
- **The draft id lives in the query string**, not in client state — a closed tab, a refresh, or the route refresh that follows a photo upload all return to the same draft instead of starting a second one for the same airframe.
- **`unauthorized` was renamed to `not_authenticated` in F17's profile actions.** Two codes for one thing, and the seven older drone actions had the older name. The catalogue key moved with it.
- **The card links nowhere.** `/drones/[id]` is F18b's; shipping a card whose only affordance is a 404 is worse than one that does not claim to go anywhere.

**Two defects found by opening the page, plus one caught by lint:**
1. **Submitting with no photos moved the pilot to the photos pane and said nothing.** The pane's standing hint had not changed, so the button read as having done nothing. The `photo_required` refusal is now rendered on that pane as an `alert`.
2. **`الهوية عن بُعد` printed twice on every card** — once as the label, once inside the value, because `remoteIdPending` carried its own prefix. Fixed in the catalogue.
3. **`Date.now()` during render**, caught by `react-hooks/purity`. The 30-day expiry flag moved into `listPhotoAndRemoteIdForDrones`, which is where the query already happens — the page now renders a boolean and nothing about it can differ between server and browser.

**Verified — in Chrome, over HTTP, against the live database:**

| Criterion | Result |
|---|---|
| **A self-built airframe with no serial, end to end** | OK — `serial_number` NULL, 1450 g → `light`, `pending`, `submitted_at` set |
| The serial field, commercial vs self-built | OK — **rendered** for commercial, **absent** for self-built |
| A commercial airframe with no manufacturer | OK — refused on pane 1 |
| `weightClass` at every boundary | OK — 249 `micro`, 250 `light`, 3999 `light`, 4000 `medium`, 25000 `heavy`, live on screen |
| The under-250 g note | OK — shown only for `micro`, and says *may* be exempt |
| Weights in Arabic | OK — `3,999 غرام`, Latin numerals |
| Submitting with zero photos | OK — refused, sent to the photos pane, **and now says why** |
| Abandoning and returning | OK — cold reload restored nickname, build type and manufacturer from `?draft=` |
| The review screen | OK — no serial row for a self-built airframe; the "a human reviewer decides this" notice present |
| **`/drones/new` with an incomplete profile** | OK — redirected to `/profile/complete?next=%2Fdrones%2Fnew` and **returned after completion**. F17's criterion, against the route it actually named |
| **Editing a `pending` drone by POSTing the action, with a real session** | OK — `not_editable`. Upload → `upload_target_locked`, re-submit → `already_applied`. **Row unchanged** |
| All four actions POSTed signed-out | OK — `not_authenticated` |
| The empty state | OK — names the serial-less case as an invitation |
| The audit trail | OK — `drone.photo_added`, `drone.submitted`. **No event for the draft** |
| Arabic RTL and English | OK — both read correctly |
| **375 px, Arabic** | OK — via the iframe, `scrollWidth === clientWidth`, no overflowing element. Screenshotted |
| **Console** | OK — 6 messages, all React DevTools / HMR / Fast Refresh. Zero errors, zero warnings |

- `pnpm typecheck`, `pnpm lint`, `pnpm i18n:check` (690), `pnpm test` (583), `pnpm build` — all green; both routes dynamic.
- **Every probe row deleted**, and the local blob with it: `drone`, `drone_photo`, `pilot_profile`, `audit_event` back to **0**, `uploads/` emptied. Owner account and the 12 seeded zones untouched.

**Not verified:**
- **No mutation testing on the new validators.** `drone.test.ts` passed first time and has not been broken on purpose — the one step this build normally takes and this session did not. **F18b should run it before adding more.**
- **`/drones/[id]` does not exist**, so every status screen, the rejection notice, renewal, edit and deletion are unbuilt and untested. That is F18b's whole scope.
- **No approved drone has ever existed through the UI**, so the Remote ID code has never rendered on a card — only the "issued on approval" placeholder. It needs F22's queue or a probe.
- **The 30-day expiry tint was never seen**, for the same reason.
- **Photos were uploaded by `fetch`, not by dropping a file on the dropzone.** F07's route was exercised; its drag-and-drop was not.
- **No screen reader.** The radio cards and the live weight-class `role="status"` were written for one and never heard by one.

**Next session should know (F18b):**
- **Run the mutations on `drone.test.ts` first.** It is the only test file in this repo that has never been proven against broken code.
- **`/drones/[id]` is the whole job**, plus edit, delete-only-on-draft (which must call `deleteDroneFiles` — F07's note still stands), and the six status screens.
- **The reviewer's reason is on `drone.rejectionReason`** and must be shown verbatim; `resubmitDroneAction` already increments `rejectionCount` and clears the row's copy while the trail keeps it.
- **`saveDroneDraftAction` already refuses a non-draft**, proven over HTTP — F18b's edit page can rely on it rather than re-implementing the check.

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

**F18 decisions, settled with the user before any code was written** (the same up-front move that paid off in F13, F15 and F17):

- **F18 renders no QR.** Its drone detail page shows the Remote ID code as text, the status badge and valid-until, and a **link** to F19's card. F19 owns the card, the QR render job, tap-to-copy and the print view. F18's "shows a scannable QR" criterion is therefore **F19's** and stays unmet until F19 lands — recorded rather than quietly satisfied by a second renderer, which is the drift F11's single-projection rule exists to prevent.
- **F18 is two sessions.** *F18a*: `/drones` list, the five-step wizard, draft creation, the submission gate, and the self-built-no-serial path proven end to end. *F18b*: the detail page, edit, the six status screens, rejection, renewal and deletion. An honest log entry goes between them.
- **A draft cannot exist from step 1**, whatever the feature file says: `drone.nickname`, `buildType`, `weightGrams` and `weightClass` are all NOT NULL, so the row first exists when step 2 (specifications) is answered — exactly the shape F17 hit with `pilot_profile`. **`nickname` has no step assigned in F18's spec at all**; it belongs on step 1.
- **Declaring an existing Remote ID module moves to *after* approval.** `remote_id_declaration.remoteIdId` is NOT NULL onto `remote_id`, and F10 issues that row **only on approval** — so a draft cannot hold a declaration, and F18's "a declared module can be added with a PDF, shows as pending verification" criterion is unbuildable as written. Step 3 instead states what the aircraft *gets* (an Ajniha Remote ID) and notes that an existing module can be declared once approved. **F19's card owns the declaration form**, where a `remote_id` row exists by definition. The rejected alternative was a nullable `droneId` on the declaration: it needs a migration, a two-nullable-FK invariant nothing enforces, and F10's "one module per airframe" partial unique index is keyed on `remoteIdId` — so two pilots could both claim the same module while in draft.

---

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
