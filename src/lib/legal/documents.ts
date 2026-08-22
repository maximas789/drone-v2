/**
 * The legal documents' vocabulary. **Pure** — no `server-only`, no `fs`, no MDX
 * import, so the page, the loader and the unit test can all read it.
 *
 * The shape deliberately mirrors `src/lib/docs/slugs.ts`. What is different is
 * `LEGAL_SECTIONS`, and the reason is the table of contents.
 *
 * **F26 shipped the documentation with no table of contents on purpose**, and
 * the reason it gave still holds: the `.mdx` sources are compiled into the
 * bundle and cannot be read at runtime in a deployed function, so a TOC needs
 * either a generated manifest that goes stale or a hand-kept list that drifts
 * away from the headings it names. For a docs page, anchored headings were
 * enough and the list was not worth the drift.
 *
 * A legal document is the case where it *is* worth it — a reader looking for
 * the retention section should not have to scroll a policy — so the drift is
 * closed rather than accepted. The section **ids** are fixed here, in one
 * language-independent list; each `.mdx` file exports its own localised titles
 * against those ids; and `legal.test.ts` fails the build if a file's ids are
 * not exactly this list, in this order, or if any of them is missing from the
 * headings in the source. A hand-kept list that cannot silently drift is a
 * different object from the one F26 turned down.
 */

/**
 * Order is the order they appear in the footer.
 *
 * A slug is added **in the same commit as the file it names** — F27a shipped
 * `["privacy"]` alone for that reason, and F27b added `"terms"` with its two
 * `.mdx` documents. A slug listed ahead of its file is a build-time import
 * failure, and `legal.test.ts` asserts the slugs and the files are the same set
 * in both locales.
 */
export const LEGAL_SLUGS = ["privacy", "terms"] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export function isLegalSlug(value: unknown): value is LegalSlug {
  return (
    typeof value === "string" &&
    (LEGAL_SLUGS as readonly string[]).includes(value)
  );
}

/**
 * Every section of every legal document, by an id that does not change with
 * the language — the same call `DOC_ANCHORS` made, for the same reason. A
 * fragment derived from a heading's text is `#الاحتفاظ-بالبيانات` in Arabic and
 * `#how-long-we-keep-it` in English, and a link mailed to a regulator has to be
 * one string that works.
 *
 * Order is reading order, which is also the table of contents' order.
 */
export const LEGAL_SECTIONS = {
  privacy: [
    "about-this-document",
    "what-we-collect",
    "why-we-collect-it",
    "what-a-scan-reveals",
    "identity-reveal",
    "who-else-receives-data",
    "cookies",
    "how-long-we-keep-it",
    "your-rights",
    "cross-border-transfer",
    "security",
    "changes-and-contact",
  ],
  terms: [
    "about-these-terms",
    "not-a-substitute-for-gaca",
    "eligibility",
    "your-account",
    "registering-an-aircraft",
    "remote-id-obligations",
    "booking-a-flight",
    "cancellation-and-no-shows",
    "suspension-and-revocation",
    "acceptable-use",
    "no-warranty",
    "limitation-of-liability",
    "changes-to-these-terms",
    "governing-law",
  ],
} as const satisfies Record<LegalSlug, readonly string[]>;

export type LegalSectionId<S extends LegalSlug = LegalSlug> =
  (typeof LEGAL_SECTIONS)[S][number];

/** One entry in a page's table of contents: the fixed id, the localised title. */
export type LegalSection = {
  id: string;
  title: string;
};

/**
 * What a legal `.mdx` file exports about itself, as `export const meta` rather
 * than YAML frontmatter — F26's reasoning, unchanged: MDX has no native
 * frontmatter, the two remark plugins that synthesise it buy nothing here, and
 * an ESM export is type-checked where a `---` block is not.
 */
export type LegalMeta = {
  /** Authored in the file's own language. Also the `<h1>`. */
  title: string;
  /** One sentence, under the title. */
  description: string;
  /** In `LEGAL_SECTIONS` order. Pinned by `legal.test.ts`. */
  sections: LegalSection[];
};

export function isLegalMeta(value: unknown): value is LegalMeta {
  if (typeof value !== "object" || value === null) return false;
  const meta = value as Record<string, unknown>;
  return (
    typeof meta.title === "string" &&
    typeof meta.description === "string" &&
    Array.isArray(meta.sections) &&
    meta.sections.every(
      (section) =>
        typeof section === "object" &&
        section !== null &&
        typeof (section as LegalSection).id === "string" &&
        typeof (section as LegalSection).title === "string",
    )
  );
}

/** `/privacy#how-long-we-keep-it` — locale-prefixed later by `Link`. */
export function legalSectionHref(slug: LegalSlug, id: string): string {
  return `/${slug}#${id}`;
}
