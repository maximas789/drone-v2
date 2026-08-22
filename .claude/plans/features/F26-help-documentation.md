# F26 — Help Documentation

**Wave:** 8 (first) · **Depends on:** every feature branch that ran · **Skill reference:** `references/docs.md`

**Split a/b (Session 35).** **F26a** — the MDX machinery, `/docs`, `/docs/[slug]`, the
sidebar, the callouts, the "last updated" line, the footer link, and **all six pages
written in Arabic and English against the running app**. **F26b** — the real
screenshots and the `Screenshot` component, the contextual deep links from the drone
wizard and the rejection notice, and the browser link crawl of the app's own surfaces.
Twelve files of prose plus a screenshot session is more than one sitting; the prose is
the part that has to be true, so it went first.

## Purpose

Bilingual pages a pilot or a GACA reviewer can read **without signing in**, explaining how registration and booking actually work. For Ajniha these double as pitch material: half of what makes the case is explaining *why* Remote ID legitimately replaces a serial number.

## Technical design

### The rule that governs this feature

**Documentation is written only for what exists.** A page describing a feature the app doesn't have is worse than no page at all — it sends someone looking for a button that isn't there. Every page here is written **after** the features it describes are built, and against the actual UI, not against this plan.

Six pages, not twenty. Each must stay true every time a screen changes, which makes them the first thing to go stale.

### Pages — `/[locale]/docs/[slug]`

| Slug | Covers |
|---|---|
| `getting-started` | Create an account → complete your pilot profile → register a drone → book a flight. The whole path in one page, with real screenshots. |
| `remote-id` | **The core page.** What Remote ID is; the FAA broadcast model (ID, location, altitude, control-station position); GACA's DRI/NRI mandate effective 1 January 2026; why an Ajniha-issued Remote ID is a legitimate registration identity for an aircraft with no factory serial; how to declare an existing module; what the QR reveals and to whom. Sources linked. |
| `registering-a-drone` | The wizard step by step, with the self-built and FPV path given equal weight to commercial. What reviewers check. Common rejection reasons and how to fix them. |
| `zones-and-rules` | Default-deny airspace explained plainly. Zone kinds and colours. Altitude ceilings, operating hours, closures. Why most of the map is red. **The "120 m GACAR limit" this line used to name is not on the page**: no GACA document naming that figure was ever fetched and read, and `src/lib/landing/sources.ts` holds no such quotation. 120 m is the highest ceiling *we authored* for the Riyadh zones, and the page says so as authored data rather than borrowing a regulator's authority for a number nobody checked. |
| `booking-a-flight` | Slots, capacity, lead time, auto-approve vs review, check-in, cancellation, and what a no-show costs. |
| `for-authorities` | Aimed at GACA: the review queue, Remote ID lookup, identity reveal and its logging, zone management, the audit trail. This is the page that makes the pitch legible to the people it's aimed at. |

### Content rules

- **Arabic authored first**, English a real translation. A docs page that reads as machine-translated Arabic undermines the product's whole positioning.
- **Real screenshots of the actual UI**, captured after the features are built. No mockups, no stock imagery. Screenshots are taken in Arabic — the primary experience — with English equivalents where the difference matters.
- **No invented capability.** If check-in doesn't send a reminder, the page doesn't say it does.
- **Honest about the demo's limits.** The zones page states plainly that the airspace is illustrative and not official GACA data, matching the disclaimer everywhere else.
- **No fabricated regulatory endorsement.** Ajniha is described as a proposal throughout.

### Structure

MDX under **`src/content/docs/{ar,en}/{slug}.mdx`** — under `src/`, not beside it, because
the dynamic import goes through the `@/*` alias and everything in this repo lives under
`src/`. Rendered through the app's own components — this is pages in this app, not a docs
platform beside it.

- **`export const meta = { title, description, order }`, not YAML frontmatter.** MDX has
  no native frontmatter; synthesising it needs `remark-frontmatter` plus
  `remark-mdx-frontmatter`, and under Turbopack a plugin has to be named as a string the
  bundler resolves, so neither could be a local one. The ESM export is the thing those
  two plugins exist to produce, and it is type-checked where YAML is not.
- **`remark-gfm` is required**, and is the one plugin installed. MDX parses CommonMark,
  which has no tables: without it a `| a | b |` block renders as literal pipes.
- Sidebar navigation ordered by `order`, collapsing to a select on mobile.
- Anchored headings with copyable links. Ids are derived from the heading's own text by
  `headingSlug`, Arabic included; combining marks are folded, which also folds the hamza.
- A "last updated" date from the file's git history, so a stale page is visibly stale.
  Falls back to the file's mtime when the file is not committed yet, and renders nothing
  where neither is readable.
- Callout components for notes, warnings, and the regulatory-source citations.
- Every code-like value (a Remote ID example, a mobile format) rendered `dir="ltr"` inside Arabic prose, or it displays scrambled.
- **No table of contents.** The `.mdx` sources are compiled into the bundle and are not
  readable at runtime in a deployed function, so a TOC would need either a generated
  manifest that can go stale or a hand-kept list in every file that will drift. Anchored
  headings are the part the acceptance criteria actually ask for.

### Wiring

- **Docs link added to the footer** built in [F16](./F16-public-landing.md).
- Docs index at `/[locale]/docs`.
- These are public routes, so [F30](./F30-seo-discoverability.md) — which runs **after** this feature — picks them up for the sitemap and `llms.txt`. That ordering is why documentation comes first in Wave 8.
- Contextual deep links from the app: the drone wizard's Remote ID step links to `docs/remote-id`; a rejection notice links to the common-reasons section.

## Files

```
src/content/docs/ar/*.mdx
src/content/docs/en/*.mdx
src/app/[locale]/(public)/docs/page.tsx
src/app/[locale]/(public)/docs/[slug]/page.tsx
src/components/docs/{sidebar,doc-select,callout,last-updated,shell}.tsx
src/components/landing/{quotation,source-list}.tsx   lifted out of /remote-id, shared
src/mdx-components.tsx                 element mapping; locale-aware links; heading ids
src/lib/docs/slugs.ts                  pure: the slug list, DocMeta, headingSlug
src/lib/docs/load.ts                   dynamic import of one locale's .mdx
src/lib/docs/updated.ts                server-only: git committer date, mtime fallback
src/lib/docs/docs.test.ts
public/docs/screenshots/*.png          F26b
src/components/docs/screenshot.tsx     F26b
```

`src/lib/docs.ts` became **`src/lib/docs/`** — same split, and for the same reason, as
`src/lib/geo/` and `src/lib/rate-limit/`: `slugs.ts` is pure so `mdx-components.tsx` and a
unit test can import it, while `updated.ts` carries `server-only` because it forks `git`.
`@/lib/docs` still resolves.

## Acceptance criteria

Ticked in **F26a** (Session 35) unless marked. `⬜ F26b` is deferred, not failed.

**Truth**
- [x] Every page describes only features that **exist and work** — each page walked against the running app.
- [x] No page mentions payments, an AI assistant, SMS/OTP verification, or agent access. The only occurrences of "text message" are the two sentences that **deny** it.
- [ ] Screenshots are of the **actual UI**, captured after the features were built — no mockups. ⬜ **F26b**
- [x] The zones page states the airspace is illustrative, not official GACA data — in a `warning` callout, above the first heading.
- [x] Nothing implies GACA endorsement or adoption.
- [x] `remote-id` cites its regulatory sources with working links. All seven re-fetched on 2026-08-22: the three GACA PDFs still `application/pdf`, the four LII pages `text/html`.

**Bilingual**
- [x] All six pages exist in **both** `ar` and `en`.
- [x] Arabic reads as authored, not machine-translated — the Arabic was written first and the English is the translation of it, page by page.
- [x] The locale switcher on a docs page keeps the reader on the same page. Driven in Chrome: `/en/docs/booking-a-flight` → `/ar/docs/booking-a-flight`.
- [x] Remote ID examples and mobile formats render `dir="ltr"` inside Arabic prose and are not scrambled — every `code` span carries `dir="ltr"`, checked by eye at zoom on `AJN-XXXX-XXXX` in an Arabic sentence.
- [x] Arabic prose is right-aligned with correct line height; no `tracking-*` without `ltr:` — ESLint rule 4 covers `src/mdx-components.tsx`, which is where every class string on these pages lives.

**Navigation & access**
- [x] `/docs` lists all six in `order`, in both locales.
- [x] Sidebar collapses to a working select at 375 px — and the select navigates, keeping the locale prefix.
- [x] Heading anchors are copyable and resolve on reload — proven on an Arabic fragment loaded cold.
- [~] "Last updated" reflects real git history. The git path is implemented and the fallback is the file's mtime; **as shipped these files are not committed yet, so what renders today is the mtime.** It becomes the commit date on the first commit that touches them.
- [x] Every page is reachable **signed out** — every check above ran over `curl`, which carries no session.
- [x] The Docs link appears in the footer and resolves.
- [ ] The drone wizard's Remote ID step links to `docs/remote-id`; a rejection notice links to the common-reasons section. ⬜ **F26b**
- [x] No broken internal links (crawl `/docs` and check every href) — 23 distinct internal hrefs across all 14 pages, every one 200.
- [x] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
