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

`src/i18n/navigation.ts` re-exports locale-aware `Link`, `redirect`, `usePathname`, `useRouter`. **Hard rule: no component imports `next/link` directly** — enforced by an ESLint `no-restricted-imports` rule on `next/link` and `next/navigation` outside `src/i18n/`.

`src/i18n/request.ts` pins `timeZone: "Asia/Riyadh"` and declares the shared `dateTime` / `number` format presets.

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
src/middleware.ts               (next-intl only; F05 composes the auth check in)
src/app/[locale]/layout.tsx
src/app/globals.css             (fonts, direction, Arabic typography, tokens)
src/lib/format.ts
src/lib/i18n-content.ts
src/lib/locale.ts
messages/ar.json  messages/en.json
scripts/i18n-check.ts
```

## Acceptance criteria

- [ ] `/` redirects to `/ar` — a fresh visitor lands in Arabic.
- [ ] `/ar` renders with `<html lang="ar" dir="rtl">`; `/en` renders `lang="en" dir="ltr"`.
- [ ] The locale switcher preserves the current path and query string.
- [ ] Arabic text renders in IBM Plex Sans Arabic, not a fallback — confirmed in devtools' computed styles.
- [ ] `formatDate(new Date('2026-03-15'), 'ar')` returns a **Gregorian** date with **Latin numerals** (`15 مارس 2026`), not Hijri and not `١٥`.
- [ ] `formatTime` renders a 24-hour Riyadh-local time in both locales.
- [ ] `riyadhWeekday()` returns `0` for a Sunday.
- [ ] `pnpm i18n:check` passes; deleting one key from `en.json` makes it fail with that key's path printed.
- [ ] `pnpm lint` fails on a component importing `next/link` directly.
- [ ] No `tracking-*` utility appears without an `ltr:` prefix.
- [ ] The RTL layout is visually correct at a 375 px viewport in both light and dark mode — nav, buttons, and icons all mirror.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` all pass.
