# F26 — Help Documentation

**Wave:** 8 (first) · **Depends on:** every feature branch that ran · **Skill reference:** `references/docs.md`

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
| `zones-and-rules` | Default-deny airspace explained plainly. Zone kinds and colours. Altitude ceilings, the 120 m GACAR limit, operating hours, closures. Why most of the map is red. |
| `booking-a-flight` | Slots, capacity, lead time, auto-approve vs review, check-in, cancellation, and what a no-show costs. |
| `for-authorities` | Aimed at GACA: the review queue, Remote ID lookup, identity reveal and its logging, zone management, the audit trail. This is the page that makes the pitch legible to the people it's aimed at. |

### Content rules

- **Arabic authored first**, English a real translation. A docs page that reads as machine-translated Arabic undermines the product's whole positioning.
- **Real screenshots of the actual UI**, captured after the features are built. No mockups, no stock imagery. Screenshots are taken in Arabic — the primary experience — with English equivalents where the difference matters.
- **No invented capability.** If check-in doesn't send a reminder, the page doesn't say it does.
- **Honest about the demo's limits.** The zones page states plainly that the airspace is illustrative and not official GACA data, matching the disclaimer everywhere else.
- **No fabricated regulatory endorsement.** Ajniha is described as a proposal throughout.

### Structure

MDX under `content/docs/{ar,en}/{slug}.mdx`, with frontmatter for `title`, `description`, and `order`. Rendered through the app's own components — this is pages in this app, not a docs platform beside it.

- Sidebar navigation ordered by `order`, collapsing to a select on mobile.
- Anchored headings with copyable links.
- A "last updated" date from the file's git history, so a stale page is visibly stale.
- Callout components for notes, warnings, and the regulatory-source citations.
- Every code-like value (a Remote ID example, a mobile format) rendered `dir="ltr"` inside Arabic prose, or it displays scrambled.

### Wiring

- **Docs link added to the footer** built in [F16](./F16-public-landing.md).
- Docs index at `/[locale]/docs`.
- These are public routes, so [F30](./F30-seo-discoverability.md) — which runs **after** this feature — picks them up for the sitemap and `llms.txt`. That ordering is why documentation comes first in Wave 8.
- Contextual deep links from the app: the drone wizard's Remote ID step links to `docs/remote-id`; a rejection notice links to the common-reasons section.

## Files

```
content/docs/ar/*.mdx
content/docs/en/*.mdx
src/app/[locale]/(public)/docs/page.tsx
src/app/[locale]/(public)/docs/[slug]/page.tsx
src/components/docs/{sidebar,toc,callout,last-updated,screenshot}.tsx
src/lib/docs.ts                        frontmatter loading, ordering
public/docs/screenshots/*.png
```

## Acceptance criteria

**Truth**
- [ ] Every page describes only features that **exist and work** — each page walked against the running app.
- [ ] No page mentions payments, an AI assistant, SMS/OTP verification, or agent access.
- [ ] Screenshots are of the **actual UI**, captured after the features were built — no mockups.
- [ ] The zones page states the airspace is illustrative, not official GACA data.
- [ ] Nothing implies GACA endorsement or adoption.
- [ ] `remote-id` cites its regulatory sources with working links.

**Bilingual**
- [ ] All six pages exist in **both** `ar` and `en`.
- [ ] Arabic reads as authored, not machine-translated.
- [ ] The locale switcher on a docs page keeps the reader on the same page.
- [ ] Remote ID examples and mobile formats render `dir="ltr"` inside Arabic prose and are not scrambled.
- [ ] Arabic prose is right-aligned with correct line height; no `tracking-*` without `ltr:`.

**Navigation & access**
- [ ] `/docs` lists all six in `order`, in both locales.
- [ ] Sidebar collapses to a working select at 375 px.
- [ ] Heading anchors are copyable and resolve on reload.
- [ ] "Last updated" reflects real git history.
- [ ] Every page is reachable **signed out**.
- [ ] The Docs link appears in the footer and resolves.
- [ ] The drone wizard's Remote ID step links to `docs/remote-id`; a rejection notice links to the common-reasons section.
- [ ] No broken internal links (crawl `/docs` and check every href).
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
