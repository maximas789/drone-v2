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
| 3 — Auth | F05 | ⚠️ Done with deviations (Session 5) — **account-level criteria unverified, see entry** |
| 4 — Platform services | F06, F07, F08, F09 | ⬜ Not started |
| 5 — Domain core | F10–F15 | ⬜ Not started |
| 6 — Pilot experience | F16–F21 | ⬜ Not started |
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
| resend | 6.20.0 | registry · latest only | F06 |
| react-email | 6.9.2 | registry · latest only | F06 |
| @vercel/blob | 2.8.0 | registry · latest only | F07 |
| inngest | 4.18.1 | registry · latest only | F08 |
| zod | 4.4.3 | registry · latest only | Action input parsing |
| postgres (postgres.js) | 3.4.9 | registry · installed | **The chosen driver.** Works unchanged against Docker locally and Neon over TCP, so one code path covers both. `pg` was not installed. |
| server-only | 0.0.1 | registry · installed | Runtime dependency, not dev — `src/lib/db/index.ts` imports it. |
| tsx | 4.23.12 | registry · installed (dev) | Runs `db:seed`. Resolves the `@/*` alias from tsconfig, which plain `node` does not. |
| qrcode | 1.5.4 | registry · latest only | F19 |

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
| Better Auth generated schema | (implicit) timestamptz everywhere | The CLI emits `timestamp` **without** time zone on all four tables | Left exactly as generated — the rule to not edit CLI output wins. Drizzle writes `toISOString()` and reads back with `+0000`, so instants round-trip correctly; the column just doesn't carry the zone. Feature file updated. |

---

## Open threads

Things left unresolved that a later session must pick up. **Delete a row when it's closed** — a stale thread is worse than none.

| # | Thread | Raised in | Blocks |
|---|---|---|---|
| 1 | `.env` values the user must supply: `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`, Inngest keys. All optional — the app must work without them. | Planning | Nothing; degraded paths are specified |
| 2 | `ID_HASH_PEPPER` and `RATE_LIMIT_PEPPER` must be generated once and never regenerated — changing the pepper orphans every existing hash. `.env` currently holds only `POSTGRES_URL` — no pepper has been generated yet, so F09/F17 are the ones that create them. | Planning | F17, F09 |
| 3 | Something else on this machine already occupies **port 3000** (it serves a next-intl app that 307s to `/ar` — not this project). `pnpm dev` fell through to 3001. Any URL, QR or `APP_URL` written assuming 3000 will point at the wrong app. | F01 | F19, F29 |
| 4 | **`next/root-params` does not work in Server Actions or Route Handlers.** `src/i18n/request.ts` honours an explicit `locale` first, so any action needing translated text must call `getTranslations({ locale, ... })` with the locale passed in (e.g. bound into the action). An action that calls bare `getTranslations()` will throw at runtime, not at build. | F02 | F14, F18, F21, F22 — every wave with server actions |
| 11 | **Nothing in `pnpm lint` / `typecheck` / `build` / `test` catches a browser console error.** Base UI's `nativeButton` warning had been firing on F02's home page since Wave 1 and every check stayed green; the user found it by opening the page. Every wave from here builds UI, and none of them has a check that would notice. F31's gate needs a real browser pass, and F20/F23 (MapLibre, terra-draw) are the likeliest to hit this again. | F05 | F31, and every UI wave |
| 12 | **F05's account-level acceptance criteria are unverified** — the user chose to skip them rather than let a probe account take the admin slot. Unproven: first account = admin / second = pilot; `input: false` blocking a self-service `{role:"admin"}` update; a signed-in pilot getting 404 on `/ar/admin`; a pilot's direct call to `setUserRoleAction` being refused; pilot B opening pilot A's drone. Each needs two real accounts and ten minutes. The `user` table is still **empty**, so whoever signs up first still becomes admin. | F05 | F31; ideally re-run as soon as the owner signs up |
| 13 | **`requirePilotProfile` redirects to `/profile/complete`, which does not exist yet** (F17 builds it). Nothing calls the guard today, so nothing 404s; F17 must build that page or the first caller sends pilots into a dead end. | F05 | F17 |
| 14 | **`drone.owner_user_id` and `booking.pilot_user_id` are `ON DELETE RESTRICT`**, so deleting an account that holds registered aircraft or bookings is refused by the database — while `deleteUser` is enabled in `src/lib/auth.ts`. Deliberate: a registration record is not personal data to take away. **F28 owns the consequence** and must offer a real path (revoke, or transfer) instead of a raw delete that errors. | F05 | F28 |
| 7 | `jobs`, `remote_id_scan` and `rate_limit_bucket` are **not** in the schema — F03 defers them to the features that own their columns. | F03 | F08, F11, F09 |
| 15 | **`role` reaches the app as `string \| null`, not a union.** Better Auth types an `additionalField` declared as a list of literals as a plain `string`. `roleOf()` in `src/lib/session.ts` narrows it and **fails closed** — anything unrecognised is treated as `pilot`. Never read `session.user.role` directly; use `roleOf` / `isReviewer` / `isAdmin`. | F05 | Every wave that branches on role |
| 9 | **F12 owes the KKIA annulus its containment assertion** — a point inside the hole must not be contained by the polygon. F04 asserted only the structure, because writing a second `pointInPolygon` outside `src/lib/airspace/` is the decay the plan warns about. | F04 | F12 |
| 10 | **Nothing has checked the seeded polygons for self-intersection**, and no one has seen them on a map. F20 is the first render. | F04 | F20 |
| 5 | The `[locale]` segment is a catch-all for unknown paths, so `/anything.txt` reaches the layout. `hasLocale` + `notFound()` handles it, but F30 must still confirm `robots.txt` and `sitemap.xml` resolve as real routes rather than being swallowed. | F02 | F30 |

---

## Decisions made mid-build

Choices not in the plan, or that changed it. Each needs a reason a future session will accept.

| Date | Decision | Why | Plan updated? |
|---|---|---|---|
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
| `pnpm exec tsc --noEmit` | 2026-08-16 (F05) | ✅ clean — **requires `next typegen` first** on a clean tree; use `pnpm typecheck` |
| `pnpm lint` | 2026-08-16 (F05) | ✅ clean; rules 5 and 6 re-proven on probes after the flat-config restructure |
| `pnpm build` | 2026-08-16 (F05) | ✅ migrates first; 19 routes, auth pages SSG, `(app)`/`(admin)` dynamic, `/api/auth/[...all]` registered |
| `pnpm test` | 2026-08-16 (F05) | ✅ 60 passed, 3 files — **unchanged; F05 added no tests** (see entry) |
| `pnpm i18n:check` | 2026-08-16 (F05) | ✅ 347 keys, ar/en in sync |
| `pnpm db:up` + `db:migrate` | 2026-08-16 (F05) | ✅ `0001_cute_sprite` applied clean; **19 tables**, 18 FKs onto `user` |
| `pnpm db:seed` | 2026-08-15 (F04) | ✅ 6 cities, 12 zones, 98 hour rows, 2 closures. Second run inserted 0 of everything and left every `updated_at` byte-identical (md5 compared). |
| Signed-out route protection | 2026-08-16 (F05) | ✅ over HTTP — see entry. Includes the **forged-cookie** probe that proves the proxy is not the boundary. |
| Two-account ownership | — | ❌ **not run** — Open Thread 12. Needs two accounts; skipped so no probe took the admin slot. |
| Browser console clean | — | ❌ **not run** by us. The one console error found so far was reported by the user — Open Thread 11. |
| App with keys removed | — | — |
| End-to-end walkthrough (Arabic) | — | — |

### Known un-runnable

Named, never assumed. Add as discovered.

- Sending email to any address other than the account owner's — needs a verified domain in DNS.
- Vercel Blob uploads — needs a deployed store; the local driver is exercised instead.
- OG preview card as a third party sees it — needs a public domain.
- QR codes encoding a production URL — needs `APP_URL` on a real domain.
- Printed-QR scanning at 20 mm — needs a printer and a phone.
- Inngest production sync — needs a first deploy.

---

## Session entries

Newest at the top.

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

**Not verified:**
- **Every account-level acceptance criterion.** The user chose to skip them rather than let a probe account take the admin slot (see Open Thread 12). Unproven: first account = `admin` and second = `pilot`; a pilot PATCHing `{role:"admin"}` being ignored (**the `input: false` test — the security control this feature turns on**); a signed-in pilot getting 404 rather than 403 on `/ar/admin`; a pilot's direct call to `setUserRoleAction` being refused; pilot B opening pilot A's drone. Each needs two real accounts. The hook, the guards and the action are written and read correctly, but **nothing has run them against a real session.**
- **No test file was added.** `setUserRole`'s transaction, `roleOf`'s fail-closed narrowing and `safeNextPath`'s open-redirect check are all pure enough to unit-test, and none is tested. `roleOf` and `safeNextPath` need no database at all — the cheapest gap here to close.
- **`pnpm db:studio` showing the user row** — no browser was used.
- **Auth pages at 375 px, light and dark, Arabic RTL** — not checked; no browser. Given Open Thread 11, that is exactly where the next defect will be.
- The new Arabic copy is unreviewed by a native speaker.

**Next session should know (Wave 4 — F06–F09, four sub-agents in parallel):**
- **`src/lib/auth.ts` is the one shared file** (plan §5). F06 adds `sendVerificationEmail` / `sendResetPassword`; F09 adds rate limiting. Both edits are **serialised**, and each means re-running the CLI → `db:generate` → **read the SQL** → `db:migrate`.
- The CLI command that works, `server-only` collision and all: `pnpm dlx @better-auth/cli@latest generate --config src/lib/auth.ts --output src/lib/db/auth-schema.ts -y`. Keep the pool in `src/lib/db/client.ts` free of `server-only` or it breaks again.
- **`requireEmailVerification` is `false`** and the two email pages say plainly that nothing will be sent. F06 flips both.
- **Never read `session.user.role`** — it is `string | null`. Use `roleOf` / `isReviewer` / `isAdmin` (Open Thread 15).
- Server actions: `getSession()` returns `null` rather than redirecting; guard, then `refuse("code")` from `@/lib/actions/result`. Redirecting guards need the locale passed in — `next/root-params` throws in actions (Open Thread 4).
- The `user` table is **empty**. Whoever signs up first becomes admin. Still do not create a probe account.
- Dev server takes **port 3001**; `BETTER_AUTH_URL` and `APP_URL` are set to match.

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
