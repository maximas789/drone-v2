/**
 * The documentation's vocabulary. **Pure** — no `server-only`, no `fs`, no MDX
 * import. `src/mdx-components.tsx` needs `headingSlug` while rendering, the
 * loader needs the slug list, and a unit test needs both without a bundler.
 *
 * **Six pages, and the list is closed.** Documentation is the fastest-rotting
 * thing in the repository: every page here has to stay true the next time a
 * screen changes, so the number that stays true is small. A seventh slug is a
 * decision, not an addition — which is why it costs an edit here rather than
 * dropping a file into a folder.
 */

export const DOC_SLUGS = [
  "getting-started",
  "remote-id",
  "registering-a-drone",
  "zones-and-rules",
  "booking-a-flight",
  "for-authorities",
] as const;

export type DocSlug = (typeof DOC_SLUGS)[number];

export function isDocSlug(value: unknown): value is DocSlug {
  return (
    typeof value === "string" && (DOC_SLUGS as readonly string[]).includes(value)
  );
}

/**
 * What every documentation page states about itself, as an ESM export from the
 * `.mdx` file rather than as YAML frontmatter.
 *
 * **Frontmatter would have cost two dependencies and bought nothing.** MDX has
 * no native frontmatter; turning `---` blocks into an export needs
 * `remark-frontmatter` plus `remark-mdx-frontmatter`, and under Turbopack a
 * plugin has to be named as a string the bundler resolves. `export const meta`
 * is the mechanism those two plugins exist to synthesise, it is type-checked
 * where a YAML block is not, and it is one line shorter.
 *
 * `order` is per file rather than a hand-kept array here so that a page and its
 * position cannot drift apart. `docs.test.ts` asserts the six orders are a
 * permutation of 1–6 and identical in both locales.
 */
export type DocMeta = {
  /** Authored in the file's own language. Also the `<h1>`. */
  title: string;
  /** One sentence. The index card's line, and F30's `llms.txt` line. */
  description: string;
  order: number;
};

export function isDocMeta(value: unknown): value is DocMeta {
  if (typeof value !== "object" || value === null) return false;
  const meta = value as Record<string, unknown>;
  return (
    typeof meta.title === "string" &&
    typeof meta.description === "string" &&
    typeof meta.order === "number"
  );
}

/**
 * A heading's fragment identifier, derived from its own text.
 *
 * **Arabic characters survive.** A fragment is percent-encoded on the way into
 * a URL and decoded before the browser matches it, so `#ما-هي-الهوية-عن-بعد`
 * resolves; transliterating or numbering the Arabic headings instead would
 * produce an anchor that says nothing about where it lands, on the half of the
 * site that is authored first.
 *
 * Combining marks are dropped — the harakat an author may or may not have typed
 * must not decide whether last month's link still works — and so is every
 * punctuation mark, for the same reason. **NFKD makes that fold the hamza too**
 * (`أ` decomposes to a bare alef plus a mark), which is deliberate rather than
 * incidental: Arabic is written with the hamza optional in practice, and an
 * anchor that survives the variant spelling is worth more than one that does
 * not. `docs.test.ts` pins it.
 */
export function headingSlug(text: string): string {
  return (
    text
      .normalize("NFKD")
      // Marks: harakat, tatweel-adjacent diacritics, Latin accents.
      .replace(/\p{M}+/gu, "")
      .replace(/ـ/g, "")
      .toLowerCase()
      .trim()
      // Anything that is not a letter, a number or a separator goes.
      .replace(/[^\p{L}\p{N}\s-]+/gu, "")
      .replace(/[\s-]+/gu, "-")
      .replace(/^-+|-+$/g, "")
  );
}

/**
 * The text of a heading, given React children that may be a string, an array,
 * or elements (`**bold**`, `` `code` ``) wrapping more of the same.
 *
 * Written by hand rather than reached for from a library because it runs on the
 * exact shape MDX produces and nothing else: if it ever meets something it
 * cannot read it returns what it has, and a heading with an imperfect anchor is
 * better than a page that throws.
 */
export function textOf(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && node !== null && "props" in node) {
    const props = (node as { props?: { children?: unknown } }).props;
    if (props && "children" in props) return textOf(props.children);
  }
  return "";
}
