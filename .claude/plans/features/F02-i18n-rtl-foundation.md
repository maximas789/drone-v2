# F02 — Bilingual i18n & RTL Foundation

**Wave:** 1 · **Depends on:** [F01](./F01-project-shell.md)

## Purpose

Make Arabic the app's native language rather than a translation layer bolted on later. Every subsequent feature writes bilingual copy against this foundation, so it has to be right before any page exists.

## Technical design

### next-intl routing

```ts
// src/i18n/routing.ts
locales: ["ar", "en"]
defaultLocale: "ar"
localePrefix: "always"        // /ar/zones and /en/zones — never a bare /zones
localeDetection: false        // deterministic: a fresh visitor always lands in Arabic
```

`src/i18n/navigation.ts` re-exports locale-aware `Link`, `redirect`, `usePathname`, `useRouter` (via `createNavigation`). **Hard rule: no component imports `next/link` directly** — enforced by an ESLint `no-restricted-imports` rule outside `src/i18n/`.

The rule bans `next/link` outright, and from `next/navigation` bans only the four names with locale-aware replacements: `redirect`, `permanentRedirect`, `useRouter`, `usePathname`. `useSearchParams`, `useParams` and `notFound` have no counterpart and stay allowed — banning them would only produce `eslint-disable` comments next to the imports that matter.

`src/i18n/request.ts` pins `timeZone: "Asia/Riyadh"` and declares the shared `dateTime` / `number` format presets.

**Corrections from the build (F02):**

- The locale comes from **`next/root-params`**, not next-intl's `requestLocale`, which is deprecated. `next/root-params` was introduced in Next 16.3.0 and requires the root layout to live at `src/app/[locale]/layout.tsx` — there is no `src/app/layout.tsx`.
- `next/root-params` **does not work in Server Actions or Route Handlers.** `request.ts` therefore honours an explicit `locale` first, and any action that needs translated text must call `getTranslations({ locale, … })` with the locale passed in.
- The routing hook is **`src/proxy.ts` exporting `proxy`** — Next 16 deprecates both the `middleware` filename and the `middleware` export name. `proxy` runs on the nodejs runtime and cannot be configured to edge.

### The root layout

```tsx
<html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} suppressHydrationWarning>
```

Font variables go on `<html>`, **not `<body>`** — a Tailwind `font-sans` on body resolves against a variable that isn't in scope otherwise.

### Fonts

- **Arabic:** IBM Plex Sans Arabic (400/500/600/700), `display: "swap"`.
- **Latin:** Geist + Geist Mono.

The stack switches purely on `html[lang="ar"]` via a `--app-font-sans` CSS variable — no conditional class names in components.

### Typography rules for Arabic

In `globals.css`:

- `html[lang="ar"] { line-height: 1.75 }` — Arabic ascenders/descenders need more room.
- **`letter-spacing` is gated behind `ltr:`.** Tracking breaks Arabic letter joins and produces visually broken words. Any `tracking-*` utility must be written `ltr:tracking-tight`.
- `.rtl-flip { }` with `[dir="rtl"] &  { transform: scaleX(-1) }` for directional icons (arrows, chevrons). Non-directional icons (a plus, a drone) must **not** get it.

### Message catalogues

`messages/ar.json` and `messages/en.json`, Arabic authored first. Namespaces:

```
common  nav  landing  auth  profile  drones  remoteId  zones  map
booking  bookings  admin  review  notifications  settings  system
docs  legal  airspace  errors  meta
```

`airspace` carries the full set of ~26 refusal reason codes from [F12](./F12-airspace-engine.md) plus a `fix` hint for each. A missing key must be a **build-visible failure**, not a silent fallback.

### `pnpm i18n:check`

A script that loads both catalogues, flattens them, and diffs the key sets. Exits non-zero on any key present in one and not the other, printing the offending paths. Wired into `lint`. This is what stops English creeping into the Arabic UI as features land.

It **also** compares the ICU placeholders of each shared key: `{count}` in one catalogue and `{total}` in the other passes a key-set diff and throws at render. It compares placeholder *names*, not plural categories — Arabic legitimately uses `=0/one/two/few/other` where English uses `=0/one/other`.

Lives at `scripts/i18n-check.mts` and runs on bare `node` (Node strips the types). `.mts`, not `.ts`, or Node warns about reparsing an ES module.

### `src/lib/format.ts` — the single formatting choke point

Every date, time, and number in the app goes through here. Nothing else may call `Intl` directly (ESLint rule from F01).

```ts
const LOCALE_TAG = { ar: "ar-SA-u-ca-gregory-nu-latn", en: "en-GB" };
```

The `-u-ca-gregory-nu-latn` extension is the whole point: without it, `ar-SA` yields **Hijri dates and Arabic-Indic digits**, which is wrong for an aviation booking platform where a slot time must be unambiguous.

Exports: `formatDate`, `formatTime`, `formatDateTime`, `formatDateRange`, `formatNumber`, `formatDistance`, `formatAltitude`, `formatArea`, `formatRelativeTime`, and `riyadhWeekday(date): 0..6` where **0 = Sunday**.

One unit test asserts `RIYADH_OFFSET_MINUTES === 180` against `Intl` for a January date and a July date — Saudi has never observed DST, and this test is what catches it if that ever changes.

### Localised content helper

For bilingual *data* (zone names, closure reasons), not UI chrome:

```ts
// src/lib/i18n-content.ts
pick({ ar, en }: Localized, locale: Locale): string
```

Domain content lives in paired `*_ar` / `*_en` **columns**; only UI chrome lives in `messages/*.json`.

## Files

```
src/i18n/{routing,request,navigation}.ts
src/proxy.ts                    (next-intl only; F05 composes the auth check in)
src/app/[locale]/layout.tsx     (the root layout — src/app/layout.tsx must NOT exist)
src/app/[locale]/page.tsx
src/app/globals.css             (fonts, direction, Arabic typography, tokens)
src/components/locale-switcher.tsx
src/lib/format.ts
src/lib/format.test.ts
src/lib/i18n-content.ts
src/lib/locale.ts
messages/ar.json  messages/en.json
scripts/i18n-check.mts
```

**The switcher must not call `useSearchParams()`.** It renders in the header of every page, and `useSearchParams` opts each of those pages out of static prerendering unless every one wraps it in a Suspense boundary — it fails `pnpm build` outright. Read `window.location.search` in the click handler instead; the query is only needed at that moment.

## Acceptance criteria

- [x] `/` redirects to `/ar` — a fresh visitor lands in Arabic. (`307`, verified against the production build.)
- [x] `/ar` renders with `<html lang="ar" dir="rtl">`; `/en` renders `lang="en" dir="ltr"`.
- [ ] **The locale switcher preserves the current path and query string.** Written to, but unverifiable in Wave 1 — only one route exists and no page takes a query string. Re-check in F16/F21.
- [ ] **Arabic text renders in IBM Plex Sans Arabic, confirmed in devtools' computed styles.** Not done — no browser was used. What *was* checked: the compiled CSS resolves `html[lang="ar"]` → `--app-font-sans` → `--font-plex-arabic` → the self-hosted `"IBM Plex Sans Arabic"` face, with the woff2 preloaded. Needs a human with a browser.
- [x] `formatDate(…, 'ar')` returns a **Gregorian** date with **Latin numerals** — `15 مارس 2026`. Asserted in `format.test.ts` *and* confirmed in the served HTML, which contains zero Arabic-Indic digits and zero `هـ`.
- [x] `formatTime` renders a 24-hour Riyadh-local time in both locales.
- [x] `riyadhWeekday()` returns `0` for a Sunday — plus `6` for Saturday and correct behaviour across a Riyadh midnight UTC hasn't reached.
- [x] `pnpm i18n:check` passes (303 keys); deleting a key from `en.json` fails with that key's path printed.
- [x] `pnpm lint` fails on a component importing `next/link` directly, and on `useRouter` from `next/navigation`.
- [x] No `tracking-*` utility appears without an `ltr:` prefix — enforced, and the rule accepts `ltr:` in any variant position (`md:ltr:tracking-wide`).
- [ ] **The RTL layout is visually correct at 375 px in light and dark mode.** Not done — no browser. Needs a human, ideally one who reads Arabic.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all pass.
