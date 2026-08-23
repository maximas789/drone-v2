import { DOC_SLUGS } from "@/lib/docs/slugs";
import { LEGAL_SLUGS } from "@/lib/legal/documents";
import { LOCALES } from "@/lib/locale";

/**
 * **One list of public pages.** The sitemap, `llms.txt` and F30b's per-page
 * metadata all read this; three separately maintained lists would drift within
 * a week, and the drift is invisible — a page missing from a sitemap fails
 * nothing.
 *
 * **Pure.** No `server-only`, no `fs`, no MDX import, no `next-intl`. The dates
 * and the titles are resolved separately in `./resolve.ts`, which is the half
 * that needs a filesystem; this half is the vocabulary, and a unit test reads
 * it without a bundler. Same split as `src/lib/docs/slugs.ts` versus
 * `src/lib/docs/updated.ts`.
 *
 * **The docs and legal pages are derived, not copied.** `DOC_SLUGS` and
 * `LEGAL_SLUGS` are the lists F26 and F27 already keep honest with their own
 * tests, so a seventh documentation page appears in the sitemap by existing.
 * This is the whole reason the plan runs F30 last.
 */

/** How a page's `lastModified` is decided. */
export type PageDate =
  /** The committer date of the named source file(s) — see `./resolve.ts`. */
  | { from: "source"; files: readonly string[] }
  /** Per locale, because the two `.mdx` files are edited independently. */
  | { from: "docMdx"; slug: string }
  /**
   * `EFFECTIVE_DATE`, by hand. F27 decided a legal document's date is a claim
   * about when the *policy* changed, and a typo fix in the Arabic must not
   * announce a new privacy policy to every crawler that reads the sitemap.
   */
  | { from: "legalEffectiveDate" };

/** Where a page's title and one-line description come from. */
export type PageCopy =
  /** `meta.pages.<key>` in the message catalogue. Written by F30. */
  | { from: "messages"; key: string }
  /** The `.mdx` file's own `export const meta`. Authored by F26. */
  | { from: "docMeta"; slug: string }
  /** The `.mdx` file's own `export const meta`. Authored by F27. */
  | { from: "legalMeta"; slug: string };

export type PublicPage = {
  /** Unprefixed and leading-slash. `/` is the landing page. */
  path: string;
  copy: PageCopy;
  date: PageDate;
};

const CONCEPT_PAGES: readonly PublicPage[] = [
  {
    path: "/",
    copy: { from: "messages", key: "home" },
    date: { from: "source", files: ["src/app/[locale]/(public)/page.tsx"] },
  },
  {
    path: "/how-it-works",
    copy: { from: "messages", key: "howItWorks" },
    date: {
      from: "source",
      files: ["src/app/[locale]/(public)/how-it-works/page.tsx"],
    },
  },
  {
    path: "/remote-id",
    copy: { from: "messages", key: "remoteId" },
    date: {
      from: "source",
      files: ["src/app/[locale]/(public)/remote-id/page.tsx"],
    },
  },
  {
    path: "/zones",
    copy: { from: "messages", key: "zones" },
    date: {
      from: "source",
      files: ["src/app/[locale]/(public)/zones/page.tsx"],
    },
  },
  {
    path: "/docs",
    copy: { from: "messages", key: "docs" },
    date: {
      from: "source",
      files: ["src/app/[locale]/(public)/docs/page.tsx"],
    },
  },
];

export const PUBLIC_PAGES: readonly PublicPage[] = [
  ...CONCEPT_PAGES,
  ...DOC_SLUGS.map(
    (slug): PublicPage => ({
      path: `/docs/${slug}`,
      copy: { from: "docMeta", slug },
      date: { from: "docMdx", slug },
    }),
  ),
  ...LEGAL_SLUGS.map(
    (slug): PublicPage => ({
      path: `/${slug}`,
      copy: { from: "legalMeta", slug },
      date: { from: "legalEffectiveDate" },
    }),
  ),
];

/**
 * The first path segment after the locale for everything a stranger may not
 * crawl. **`rid` is the one that matters** and it is first for that reason.
 *
 * Indexing `/{locale}/rid/{code}` would let a crawler assemble the resolution
 * page for every Remote ID it ever met — **a browsable national drone
 * registry**, which is precisely what F11's masking exists to prevent. The
 * masking limits what one scanner sees; this limits who can enumerate. Both
 * are needed, and neither is sufficient: `robots.txt` is a request made before
 * the fetch, and the page's own `noindex` is what an obedient crawler acts on
 * after it.
 *
 * `dev` is here because `/{locale}/dev/emails` renders every transactional
 * template with sample data. It is not secret and it is not a security
 * boundary — it is simply not a page anyone should reach from a search result.
 */
export const PRIVATE_SEGMENTS = [
  "rid",
  "dashboard",
  "drones",
  "bookings",
  "notifications",
  "settings",
  "profile",
  "admin",
  "dev",
] as const;

/**
 * Every `Disallow:` line, generated.
 *
 * **The bug this replaces was live.** F11's `robots.ts` disallowed `/dashboard`
 * and `/admin` — but routing is `localePrefix: "always"`, so there is no
 * `/dashboard` to disallow. A `Disallow:` is a prefix match, `/ar/dashboard`
 * does not start with `/dashboard`, and the two rules matched **nothing**.
 * Only `/*​/rid/` was written with the wildcard and only `/*​/rid/` worked.
 *
 * So each segment is emitted twice: the wildcard form, which RFC 9309 defines
 * and every major crawler honours, and the **explicit locale-prefixed form**,
 * generated from `LOCALES`, which needs no wildcard support at all. Two lines
 * per segment is a rounding error in a file this size, and the segment that
 * would suffer from a crawler with a partial `*` implementation is the drone
 * registry.
 *
 * **No trailing slash**, which is the second half of the same trap. A
 * `Disallow:` is a prefix match, so `/ar/settings/` covers `/ar/settings/profile`
 * and leaves `/ar/settings` itself — a real page — crawlable. The segment
 * without the slash covers both.
 */
export function disallowedPaths(): string[] {
  const paths = ["/api/"];
  for (const segment of PRIVATE_SEGMENTS) {
    paths.push(`/*/${segment}`);
    for (const locale of LOCALES) {
      paths.push(`/${locale}/${segment}`);
    }
  }
  return paths;
}

/** `/` → `/ar`; `/zones` → `/ar/zones`. Paths only — `absoluteUrl` adds the origin. */
export function localePath(path: string, locale: string): string {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}
