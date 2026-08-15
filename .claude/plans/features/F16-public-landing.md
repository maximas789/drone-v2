# F16 — Public Landing & Concept Pages

**Wave:** 6 · **Depends on:** [F02](./F02-i18n-rtl-foundation.md), [F05](./F05-auth-roles-access.md) · **Skill reference:** `references/pages.md`

## Purpose

The front door. Ajniha is a product strangers sign up for **and** a pitch to a regulator, so the landing page has to do two jobs: explain the gap in one screen to someone who has never thought about drone registration, and be credible to a GACA reviewer who has thought about nothing else.

## Technical design

### Visual direction

**Institutional but not sterile** — this has to look like something a civil aviation authority could plausibly adopt, without looking like a government form. Deep neutral base, one confident primary, generous spacing, and the map doing the visual work rather than illustration.

Set in **one place** — the CSS variables in `globals.css`. Never one-off colours in components.

- `--primary`: a deep aviation blue-teal, legible on white and on near-black. Checked in both `:root` and `.dark`.
- Neutral base: cool greys — this is a technical product, and warm neutrals would read editorial.
- `--radius: 0.5rem` — precise, not playful.
- Domain tokens: `--zone-permitted` (green), `--zone-restricted` (amber), `--zone-no-fly` (red). Defined once here; consumed by the map ([F20](./F20-airspace-map.md)) and every status badge, so a zone is the same colour everywhere in the app.

### Landing page structure

1. **Header** — Ajniha / أجنحة wordmark, locale switcher, Sign in / Register.
2. **Hero** — the gap in one sentence a stranger understands. Arabic authored first, English a real translation rather than the source. One primary action: *سجّل طائرتك* / Register your drone.
3. **The problem** — three short beats: GACA registration requires a manufacturer serial number → self-built and FPV drones don't have one → so their pilots can't register and have nowhere sanctioned to fly. This is the pitch; it goes above the feature list.
4. **The answer: Remote ID** — every drone gets an Ajniha Remote ID and a scannable digital ID. **Show a real rendered ID card and a real QR**, not a mockup.
5. **Live map preview** — the actual Riyadh airspace from [F04](./F04-riyadh-seed-data.md), read-only, with the default-deny model visible: restricted city, permitted carve-outs, no-fly overlays. Carries the same authored-data disclaimer as everywhere else.
6. **How it works** — four concrete steps: register → get your Remote ID → book a zone → fly. Named actions, not adjectives.
7. **For GACA** — the oversight side: approval queues, compliance dashboard, Remote ID lookup, audit trail.
8. **Footer** — name, year, and **only links that exist**. [F26](./F26-help-documentation.md) adds Docs; [F27](./F27-legal-pages.md) adds Privacy and Terms. Nothing added on spec.

### Hard rule: never fabricate credibility

No invented testimonials, no customer logos, no star ratings, no "trusted by 10,000 pilots", no press mentions, **and no implication that GACA has endorsed or adopted this**. The page must read as a proposal, not as an official system.

The eyebrow line says so explicitly: *مبادرة مقترحة* / *A proposed initiative* — and the map disclaimer says the zones are illustrative. Fake regulatory endorsement is the one thing here that could cause real trouble.

Screenshots show the actual UI or nothing. No stock mockups.

### Concept pages

- **`/how-it-works`** — the registration and booking flow explained end to end, for a pilot.
- **`/remote-id`** — what Remote ID is, how the FAA broadcast model works, how GACA's DRI/NRI mandate (effective 1 January 2026) relates, and why an Ajniha-issued Remote ID is a legitimate substitute for a serial number. This page is the intellectual core of the pitch and should be genuinely informative, with sources linked.
- **`/zones`** — the public read-only map with a zone list, hours, and ceilings. No booking without an account.

All three are indexable ([F30](./F30-seo-discoverability.md)) and are what a shared link most often lands on.

### Page titles

**Not set here.** [F30](./F30-seo-discoverability.md) owns everything in `<head>` — the title, the template, the description, the preview card — because it runs last and is the only step that sees every public page. Leave `layout.tsx` metadata alone.

## Files

```
src/app/[locale]/(public)/page.tsx
src/app/[locale]/(public)/how-it-works/page.tsx
src/app/[locale]/(public)/remote-id/page.tsx
src/app/[locale]/(public)/zones/page.tsx
src/components/landing/{hero,problem,remote-id-explainer,map-preview,steps,for-gaca}.tsx
src/components/layout/{site-header,site-footer,locale-switcher,disclaimer.tsx}
src/app/globals.css                    (design tokens — the one place)
```

## Acceptance criteria

- [ ] Signed out, `/` redirects to `/ar` and renders the full landing page in Arabic RTL.
- [ ] Every visible string is about Ajniha — no "Welcome to Next.js", no lorem ipsum, no `Item`.
- [ ] The English page is a real translation, not transliterated Arabic or vice versa.
- [ ] The serial-number problem appears **above** any feature list.
- [ ] The Remote ID section shows a **real** rendered ID card and a **real** scannable QR — scanning it opens a working `/rid/` page.
- [ ] The map preview renders real seeded Riyadh zones with correct colours from the shared tokens.
- [ ] The authored-data disclaimer appears on the map preview and the `/zones` page, in both languages.
- [ ] The "proposed initiative" line appears; nothing on the page implies GACA endorsement or adoption.
- [ ] **No invented testimonials, logos, ratings, user counts, or press mentions anywhere.**
- [ ] Every footer link resolves; there is no link to a page that doesn't exist yet.
- [ ] `/remote-id` explains the FAA broadcast model and GACA's DRI/NRI mandate, with sources linked.
- [ ] "Register your drone" signed out goes to sign-up; signed in goes to `/drones/new`.
- [ ] The page is correct at 375 px, 768 px, and 1440 px, in both locales, in light and dark mode.
- [ ] The primary colour is legible on both `:root` and `.dark` backgrounds.
- [ ] `layout.tsx` metadata is untouched — no title set in this feature.
- [ ] No hard-coded hex colours in landing components; all reference CSS variables.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
