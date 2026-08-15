# F30 — SEO & Discoverability

**Wave:** 8 (last) · **Depends on:** [F26](./F26-help-documentation.md), [F27](./F27-legal-pages.md) — **must run after both** · **Skill reference:** `references/seo.md`

## Purpose

Make Ajniha findable and make a shared link look right — while keeping the one thing that must **not** be indexed out of search entirely.

**Why this runs last:** it writes the sitemap and `llms.txt` from a single list of public pages, and both documentation and legal add pages to that list. A sitemap written before them is wrong the moment they run.

## The decision, made

Ajniha is **public**: a product people sign up for, and a pitch whose link will be shared into WhatsApp, email, and presentations. So: sitemap, `robots.txt`, `llms.txt`, canonical links, `hreflang`, and a preview card.

**With one exception that matters more than everything else here.**

### `/rid/` must never be indexed

`robots.txt` disallows `/*/rid/` and the scan pages carry `robots: { index: false, follow: false }` in their metadata.

Indexing the Remote ID scan endpoint would let a search engine crawl and cache the resolution page for every code it ever encountered, turning a targeted lookup tool into **a browsable national drone registry** — precisely what the masking design in [F11](./F11-remote-id-redaction.md) exists to prevent. The masking limits what one scanner sees; the robots rule limits who can enumerate.

Both controls are needed: `robots.txt` is a request, the meta directive is what an obedient crawler acts on per page, and neither is sufficient alone.

## Technical design

### One list of public pages

`src/lib/public-pages.ts` — a single exported array consumed by `sitemap.ts`, `llms.txt`, and the docs index. Adding a public page in one place, not three that drift.

| Page | Indexed |
|---|---|
| `/` landing | ✓ |
| `/how-it-works` | ✓ |
| `/remote-id` | ✓ |
| `/zones` | ✓ |
| `/docs` + 6 pages | ✓ |
| `/privacy`, `/terms` | ✓ |
| `/sign-in`, `/sign-up`, reset flows | ✗ `noindex` |
| `/rid/[code]` | ✗ **`noindex`, and disallowed** |
| `/dashboard`, `/drones`, `/bookings`, `/settings`, `/admin`, `/api` | ✗ disallowed |

### `src/app/sitemap.ts`

Both locales for every public page, with `alternates.languages` pairing `ar` and `en` so a search engine serves the right one. `lastModified` from real content dates, not `new Date()` on every build — a sitemap claiming everything changed today is noise.

### `src/app/robots.ts`

Disallow `/api/`, `/dashboard`, `/drones`, `/bookings`, `/notifications`, `/settings`, `/admin`, `/*/rid/`. Sitemap URL from `APP_URL`.

**AI crawlers.** Ajniha's *content* is not the product — the platform is — so training crawlers have nothing to take that matters, and search/citation crawlers are how an assistant recommends the app with a link. Default: **allow search and citation crawlers, allow user-initiated fetches, disallow training crawlers on the app routes** (already disallowed as private) while leaving the public explanatory pages open to all three.

Crawler user-agent tokens change without notice, and a wrong token is not an error — it's a rule that silently matches nothing. Wave 0's research establishes the **current** tokens, split into training / search-and-citation / user-initiated. They are not written from memory.

### `llms.txt`

At `/llms.txt`, generated from the same page list. A short description of what Ajniha is, the problem it solves, and links to the public pages — most usefully `/remote-id` and the docs, since those are what someone would actually be asking about.

State honestly at hand-off that `llms.txt` is a **proposed convention no major AI crawler has committed to reading**. What a crawler is actually *permitted* to do lives in `robots.txt` alone.

### Titles and metadata — owned here, in one place

[F16](./F16-public-landing.md) deliberately left `layout.tsx` metadata alone. This feature sets:

- `title.template: "%s — أجنحة Ajniha"` in Arabic, `"%s — Ajniha"` in English, with a `default` for the landing page.
- Per-page `title` and `description`, bilingual, written for a human reading search results — not keyword-stuffed.
- `metadataBase` from `APP_URL`.
- Canonical URLs per page and locale.
- `hreflang` alternates for `ar` / `en` plus `x-default` → `ar`.
- `<html lang>` already correct from [F02](./F02-i18n-rtl-foundation.md).

**No page keeps a default title.** A tab reading "Create Next App" is the same failure as lorem ipsum.

### The preview card

`src/app/opengraph-image.tsx` — dynamically generated, and **Arabic-first**: the wordmark أجنحة with "Ajniha", the one-line description in Arabic, and a visual cue of the Riyadh zone map. Arabic text in an OG image needs the font embedded explicitly; the default renderer will otherwise emit boxes.

Per-page variants for `/remote-id` and the docs index, since those are the links most likely to be shared into a conversation about the concept.

Twitter card metadata alongside.

### Structured data, narrowly

`WebSite` and `Organization` on the landing page only. **`Organization` names Ajniha as a proposed initiative, never GACA** — claiming affiliation in structured data is the machine-readable version of the fabricated-endorsement problem, and it's worse because it's the version aggregators consume.

`FAQPage` on `/docs/remote-id` if the content genuinely is questions and answers; omitted otherwise.

## Files

```
src/lib/public-pages.ts
src/app/sitemap.ts
src/app/robots.ts
src/app/llms.txt/route.ts
src/app/opengraph-image.tsx
src/app/[locale]/(public)/remote-id/opengraph-image.tsx
src/app/layout.tsx                  (metadata, template, metadataBase)
src/app/[locale]/(public)/rid/[code]/page.tsx     (noindex metadata)
```

## Acceptance criteria

**The critical exclusion**
- [ ] `/robots.txt` contains a `Disallow` for `/*/rid/`.
- [ ] A `/rid/{code}` page's HTML contains `<meta name="robots" content="noindex, nofollow">`.
- [ ] `/rid/` URLs appear **nowhere** in the sitemap.
- [ ] `/rid/` URLs appear **nowhere** in `llms.txt`.

**Sitemap & robots**
- [ ] `/sitemap.xml` is valid XML listing every public page in **both** locales.
- [ ] Each entry has `alternates.languages` for `ar` and `en`.
- [ ] The 6 docs pages and both legal pages are present — proving this ran after [F26](./F26-help-documentation.md) and [F27](./F27-legal-pages.md).
- [ ] No authenticated route appears in the sitemap.
- [ ] `lastModified` reflects real content dates, not build time.
- [ ] `robots.txt` disallows every private route and references the sitemap at `APP_URL`.
- [ ] AI crawler tokens match **Wave 0's research**, not memory, and are split into training / search-and-citation / user-initiated.

**Metadata**
- [ ] Every public page has a unique, human-readable title and description in both locales.
- [ ] **No page shows a default or placeholder title** — check every tab.
- [ ] The title template renders correctly in both locales.
- [ ] Canonical URLs are correct per page and locale.
- [ ] `hreflang` alternates are present with `x-default` → `ar`.
- [ ] `metadataBase` comes from `APP_URL`; with `APP_URL` unset, the build fails or warns loudly rather than silently emitting `localhost` URLs.

**Preview card**
- [ ] `/opengraph-image` renders with **Arabic text correctly shaped** — not boxes, not reversed.
- [ ] The card shows the Ajniha wordmark and an accurate description.
- [ ] `/remote-id` has its own variant.
- [ ] Pasting the deployed URL into a link-preview validator shows the card, title, and description. *(Name as unverified if no domain exists yet.)*
- [ ] Twitter card metadata is present.

**Structured data & honesty**
- [ ] `WebSite` and `Organization` validate.
- [ ] **`Organization` does not name, imply, or claim affiliation with GACA.**
- [ ] `FAQPage` appears only where the content genuinely is Q&A.
- [ ] `llms.txt` is generated from `public-pages.ts`, not hand-maintained.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
