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

---

## Corrections after F16a (Session 19)

**F16 is being built in two halves**, settled with the user before building:

- **F16a** — the design tokens, the site header and footer, and the landing
  page itself. *Done.*
- **F16b** — the three concept pages: `/how-it-works`, `/remote-id`, `/zones`.
  `/remote-id` is a genuine research-and-writing job (the FAA broadcast model,
  GACA's DRI/NRI mandate, sources linked) and deserves its own pass.

### The map preview is an SVG, not MapLibre

Decided before it was built. [F20](./F20-airspace-map.md) owns the interactive
map; a second one here would mean **two implementations of the same picture** —
the drift the single-projection rule exists to stop — plus a tile source, a
`setRTLTextPlugin` call that must happen exactly once, and a client bundle on
the one page that has to load fast.

`src/lib/geo/project.ts` is a pure equirectangular projection with a `cos(lat)`
correction. It cannot pan, cannot zoom and answers no airspace question; it
draws the **real seeded rows** through `listActiveZones`. F20 replaces the
picture, not the data.

### The example card's code is reserved, permanently

The landing QR is produced by F08's own encoder and resolves to F11's real scan
page — but it encodes **`AJN-DEM0-CARD`**, which `RESERVED_CODES` in the codec
forbids `issueRemoteId` from ever minting.

Without that, the day the generator happened to produce that value the public
landing page would quietly start pointing at a stranger's aircraft. The scan
honestly reports `not_registered`, which is the mechanism being demonstrated,
and the card is labelled an example on its face. **No demonstration registration
was seeded** — a non-existent aircraft in a regulator-facing register is the
kind of thing that is only ever discovered by the wrong person.

### The rest

- **The footer ships no navigation.** Every candidate link — Docs, Privacy,
  Terms — belongs to F26 or F27 and does not exist. Those features add their own.
- **`nav.dashboard` did not exist in either catalogue**, so the header printed
  the raw key and the server logged `MISSING_MESSAGE`. `i18n:check` compares the
  two catalogues to each other and a key missing from both is missing
  consistently — the failure mode already documented in `drone-actions.tsx`.
- **"Correct in dark mode" is checked by adding `.dark` by hand.** Nothing in
  the app applies that class — there is still no theme toggle (thread 48) — so
  the criterion is met by construction and by inspection, not by a control a
  user can reach.

---

## Corrections after F16b (Session 20)

F16 is complete. The three concept pages are built.

### `/zones` shipped before F20, deliberately

Settled with the user before building. F16 promises a public zone page and
[F30](./F30-seo-discoverability.md) wants it indexable; waiting for
[F20](./F20-airspace-map.md) would leave a 404 where a shared link lands for the
whole of the largest feature remaining.

The picture is **F16a's SVG, lifted into `src/components/airspace/zone-drawing.tsx`**
and shared with the landing page — one implementation, two pages. The list
beside it is real: every active zone, its ceiling, night rule, weight and
build-type limits, and the full week of opening windows out of `zone_hour`.
**F20 replaces the picture and leaves the list alone.** There is no second
MapLibre map.

There is **no booking control on `/zones`**. The airspace engine's answer
depends on the aircraft's weight class and build type, so a "book" button on a
page that knows neither would promise an outcome it cannot check.

### `/remote-id`'s sources were fetched and read, and one of them corrected us

Also settled with the user before building: real citations, not a "sources
pending" note. Every document in `src/lib/landing/sources.ts` was retrieved and
read on **2026-08-18**, and every quotation in `REMOTE_ID_QUOTES` was copied out
of the text, not recalled.

**The project's premise survives the primary source.** GACAR Part 107,
Subpart F: *"This Subpart is applicable as of 1 January 2026."* § 107.302(b):
every registered UA and model aircraft must carry Direct or Network Remote ID.

**One stated premise does not.** `CLAUDE.md` says GACA registration *requires* a
manufacturer serial number. GACA's own E-Book Volume 18 is more careful:
Table 1 makes the serial essential information for the **Specific Category
only**, Note 3 asks for it in the Open Category *"if this information is
available"*, and the identifier an aircraft displays may be *"either the GACA
registration certificate number or the UAS serial number"*.

So the page argues the accurate and stronger version: **the regulator already
contemplates an authority-issued identifier standing in for a serial**, and from
2026 what must be *broadcast* under DRI is a registration number and an add-on's
serial (§ 107.303(c)) — never the airframe's factory marking. NRI is the route
that does want the UA's own serial (§ 107.304(b)(2)), and the page says so.

The FAA half is the same shape and is quoted for it: identity may be a serial
**or a session ID** (§ 89.305(a)), and a broadcast module broadcasts *its own*
serial (§ 89.315(a)).

**What could not be verified:** the **three-year registration validity** in
`CLAUDE.md`. GACAR Part 48 could not be retrieved, and the three-year periods
that do appear in Part 107 are the UAS Operator Certificate's duration and a
record-retention rule — neither is a drone registration. The app's
`remoteId.validity` string is therefore a **product decision, not a cited fact**,
and `/remote-id` does not present it as one.

### The honesty section is load-bearing

`/remote-id` ends with **what an Ajniha Remote ID is not**: not a radio, not a
certified DRI/NRI system, not issued by GACA, and not something that makes a
flight lawful. Without it the page is accurate throughout and still leaves a
reader believing a sticker makes their aircraft compliant.

**Quotations are verbatim and untranslated**, `dir="ltr"`, with the Arabic gloss
around them. Rendering a paraphrase inside quotation marks would put words a
regulator never wrote in a regulator's mouth, on the one page whose argument
rests on what they did write.

### The rest

- **`src/components/layout/public-page.tsx`** is a composed frame, still **not**
  a `layout.tsx`, for F16a's reason: a route layout would push the marketing
  chrome onto the auth pages and onto F11's scan page.
- **The landing page now links to all three.** `Steps` → `/how-it-works`,
  `RemoteIdExplainer` → `/remote-id`, `MapPreview` → `/zones`. Before this the
  front door had no route to any of them. **The footer still ships no
  navigation** — F26 and F27 add their own.
- **`formatWeekday` and `formatMinuteOfDay`** were added to `src/lib/format.ts`,
  with tests. A `zone_hour` is a time *of day* already in Riyadh civil time, so
  it is formatted in **UTC** — running it through `Asia/Riyadh` would add +3 a
  second time and publish 09:00 for a zone that opens at 06:00.
