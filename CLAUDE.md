# Ajniha (أجنحة)

Bilingual (Arabic-first, RTL) Saudi drone registration and flight-zone booking platform, pitched at **GACA**.

**The gap it closes:** GACA registration requires a manufacturer serial number. Self-built and FPV drones don't have one, so their pilots can't legally register or fly anywhere sanctioned. Ajniha replaces the serial with **Remote ID** — which is where the regulator is already heading (GACA mandates Direct/Network Remote ID from 1 January 2026, 3-year validity).

**`drone.serialNumber` is nullable, and that nullability is the entire product.** Don't "fix" it.

---

## Start of every session — read these first

| File | Why |
|---|---|
| `.claude/plans/implementation plan.md` | Waves, conventions, feature index |
| `.claude/plans/BUILD-LOG.md` | **What actually exists** vs what's planned, and the pinned versions from Wave 0 |
| `.claude/plans/features/F<NN>-*.md` | The feature being built — technical design + acceptance criteria |

The plan is the spec. **The build log is the truth.** Where they disagree, the log wins and the plan gets corrected.

Build order is Waves 0→9 across 31 features. Work one feature (or a named small group) per session, then `/clear`. **Append to `BUILD-LOG.md` before clearing** — otherwise the next session rebuilds or contradicts what you just did.

---

## Non-negotiable rules

1. **Never `drizzle-kit push`.** Always `pnpm db:generate` → **read the generated SQL** → `pnpm db:migrate`. There is deliberately no `db:push` script.
2. **Never write a version number** — not in an install command, a `package.json` snippet, prose, or a Docker image tag. Every install takes current stable. Wave 0's research (recorded in `BUILD-LOG.md`) is the source of truth for what that is.
3. **Nothing deprecated.** If the current release supersedes an approach, use the replacement.
4. **Every table gets a UUID primary key** — except Better Auth's generated tables, which stay exactly as the CLI wrote them. **Any column referencing a user is `text`, never `uuid`.** Declaring it `uuid` fails at migrate time.
5. **Logical properties only.** `ms-` `me-` `ps-` `pe-` `start-` `end-` `text-start` `text-end`. An ESLint rule bans `ml-` `mr-` `pl-` `pr-` `left-` `right-`. Any `tracking-*` must be `ltr:`-prefixed — letter-spacing breaks Arabic letter joins.
6. **No bare `toLocaleDateString` / `toLocaleTimeString` / `new Intl.*`** outside `src/lib/format.ts`. That file forces `ar-SA-u-ca-gregory-nu-latn` — **Gregorian calendar and Latin numerals in both locales**. Without it, `ar-SA` emits Hijri dates and Arabic-Indic digits.
7. **`src/lib/airspace/evaluate.ts` stays pure.** No `@/lib/db`, no `server-only`, no `next-intl`, no `react`. It runs identically server-side (authoritative) and in the map (instant feedback). This is why the map can never promise what the server refuses.
8. **Ownership lives in `src/lib/data/*.ts`.** No page or server action calls `db` directly; every exported function takes the session as its first argument.
9. **`src/proxy.ts` is never the security boundary.** (Next 16 renamed `middleware` → `proxy`; the old filename and export are deprecated.) It's an optimistic redirect. The boundary is a guard called in the layout **and again inside every server action** — actions are ordinary POSTs, reachable directly.
10. **Refusals are never exceptions.** Server actions return `{ ok: false, reasons: Reason[] }` with machine-readable codes, translated at render.
11. **No status change outside `src/lib/workflow/`.** One `applyTransition()` writes the row, the audit event, and the notification in a single transaction.
12. **A check you didn't run is named, never claimed.** Writing the code is the reason to run the test, not a reason to skip it.

---

## Conventions

**Bilingual.** Paired `*_ar` / `*_en` **columns** for human-authored content (zone names, closure reasons). Enumerable things are stored as stable **codes** and translated at render. Notifications store `type` + `params`, never rendered strings — a user who switches language must see old notifications in the new one. UI chrome lives in `messages/{ar,en}.json`; `pnpm i18n:check` must pass.

**Arabic is authored first**, English is the translation — not the other way round.

**Time.** `timestamptz` everywhere. Civil timezone `Asia/Riyadh`, fixed +180 (Saudi has never observed DST). **Week starts Sunday = 0.**

**Geometry.** GeoJSON `Polygon | MultiPolygon` in `jsonb`, WGS84, **`[lng, lat]` order**, coordinate type named `Position`. Denormalised `minLat/maxLat/minLng/maxLng` as `doublePrecision` (not `numeric` — that maps to `string` and would put a parse in the point-in-polygon hot loop). No PostGIS.

**Server action shape**, without exception:

```
requireX() → rateLimit() → schema.parse() → domain call
           → audit + notify in ONE transaction
           → revalidatePath()
           → { ok: true, data } | { ok: false, reasons: Reason[] }
```

**One log, not two.** A single `audit_event` table backs both the regulator approval trail and the ops activity log. Append-only — no update path, no delete path, no UI affordance.

---

## Stack

Next.js (App Router) · TypeScript · Tailwind · shadcn/ui · Drizzle · Better Auth · Postgres (Docker local → Neon) · next-intl · MapLibre GL JS + OpenFreeMap (**no API key**) · terra-draw (admin only, `ssr: false`) · Resend · Vercel Blob · Inngest · Vitest. Package manager **pnpm**.

**Not in scope:** payments · AI assistant · MCP agent access · SMS/OTP · live telemetry. Don't add a settings section, a docs page, or a schema column for any of them — an empty Billing tab or an unused `mobileVerifiedAt` column is a lie about what the app does.

---

## Commands

```bash
pnpm db:up          # Docker Postgres — must be running
pnpm dev
pnpm db:generate    # then READ drizzle/*.sql before migrating
pnpm db:migrate
pnpm db:seed        # Riyadh airspace; idempotent
pnpm db:studio
pnpm exec tsc --noEmit
pnpm lint
pnpm test
pnpm i18n:check
pnpm build          # runs db:migrate first
```

---

## Traps that have already cost time

- **`drone-2-demo` sits inside the `C:\Users\alsha` home git repo.** It needs its own `git init`, or commits land in a personal notes vault. Verify with `git rev-parse --show-toplevel`.
- **The first account created becomes admin.** Never create a probe account before the user signs up — deleting it later locks them out of their own system page.
- **`BETTER_AUTH_URL` must match the origin the app is served from.** Anything else and every auth POST — sign-in included — is refused with `INVALID_ORIGIN`. Same class of trap as `APP_URL` below, and just as silent.
- **A `next dev` 404 embeds a stack trace naming the guard; `next start` does not.** Route-protection checks are only meaningful against a production serve.
- **QR codes embed `APP_URL` at render time.** If it still says `localhost` in production, every printed sticker is dead. The system page checks for this.
- **`setRTLTextPlugin()` must be called exactly once**, before the first map instance, or Arabic labels render disconnected and reversed. Calling it twice throws.
- **MapLibre's worker must be pointed at `public/vendor/maplibre/` with `setWorkerUrl`, before anything touches the worker pool.** Bundled, MapLibre resolves its own worker against a hashed chunk URL that 404s, and it never listens for `error` on the `Worker` it just made — so the pool answers *nothing*, silently, and the map draws a blank canvas with a clean console. `ensureRtlTextPlugin` does this first; go through it rather than constructing a `Map` directly. `pnpm vendor:map` copies the worker **and** `maplibre-gl-shared.mjs`, which it imports relatively. Re-run it after any `maplibre-gl` bump.
- **Map labels need `["coalesce", ["get", "name:ar"], ["get", "name"]]`** — without the fallback, features with no Arabic name render blank.
- **`robots.txt` must disallow `/*/rid/`.** Indexing the Remote ID scan page turns it into a browsable national drone registry.
- **A `"use client"` module's exports are client *references*.** A Server Component calling one throws at request time with every static check green — the mirror of the `"use server"` rule that a module may export only async functions. Anything a server page and a client component both call goes in a plain module; `src/lib/dashboard/countdown.ts` is the worked example.
- **Never put `dir="ltr"` on an element containing a formatted Arabic date.** `19 أغسطس 2026 15:00 – 17:00` renders as `19 17:00 – 15:00 2026 أغسطس` — the month is a strong RTL run and the numerals around it are neutral. Isolate with `<bdi>` instead (`src/components/booking/slot-time.tsx`). **`innerText` stays correct**, so only a screenshot catches it.
- **Editing `src/lib/auth.ts`** means re-running the Better Auth CLI → `db:generate` → `db:migrate`. Both the email and rate-limiting features touch that file.
- **The Remote ID code survives renewal.** A QR sticker already on an airframe must keep resolving.
- **`create-next-app` will refuse a non-empty directory.** Scaffold into `.scaffold-tmp` and move up, keeping `CLAUDE.md`, `.claude/`, and `skills-lock.json`. *(Done in F01. It also refuses a name starting with a dot — the temp dir was `scaffold-tmp`.)*
- **`next/root-params` throws in Server Actions and Route Handlers.** The locale reaches `i18n/request.ts` that way, so an action needing translated text must call `getTranslations({ locale, … })` with the locale passed in — bare `getTranslations()` fails at runtime, not at build.
- **A link that looks like a button is `<ButtonLink href="…">`**, from `src/components/ui/button-link.tsx`. **Not** `<Button render={<Link/>}>` — Base UI's `Button` expects a real `<button>` and logs a console error otherwise, and its escape hatch `nativeButton={false}` puts `role="button"` on the `<a>`, so a screen reader announces a navigation control as a button. `ButtonLink` styles a genuine anchor from the same `buttonVariants`. (shadcn is on Base UI now; there is no `asChild` either way.)
- **This Next.js is not the one in your training data.** `next dev` writes and re-adds `AGENTS.md`; deleting it just recreates an uncommitted change. Read `node_modules/next/dist/docs/` before writing framework code.

@AGENTS.md

---

## Honesty constraints

This is a proposal, not an official system, and the app must say so:

- **Never imply GACA endorsement or adoption** — not in copy, not in docs, not in structured data.
- The Riyadh zones are **authored, not official GACA airspace**. A disclaimer appears on every map surface.
- **No fabricated credibility** — no invented testimonials, logos, ratings, user counts, or press mentions.
- Identity is verified by a **human reviewer**, never automatically. Don't imply SMS or automated verification anywhere.
