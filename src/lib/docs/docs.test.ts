import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DOC_ANCHORS,
  DOC_SLUGS,
  docAnchorHref,
  headingSlug,
  isDocMeta,
  isDocSlug,
  textOf,
} from "./slugs";
import { LOCALES } from "@/lib/locale";

/**
 * The documentation's two failure modes, and neither is visible to a compiler.
 *
 * **A slug with no file, or a file with no slug.** The first is a 500 the first
 * time somebody follows the sidebar; the second is a page that exists, is
 * written, is translated, and is reachable by nobody.
 *
 * **The `.mdx` files are read as text, not imported.** Vitest has no MDX
 * loader, and adding one would mean a second compiler pipeline maintained
 * alongside the bundler's for the sake of a test — with the usual result that
 * the two disagree. Everything asserted here is a property of the *source*, so
 * the source is what is read.
 */

const DIR = "src/content/docs";

function sourceOf(locale: string, slug: string): string {
  return readFileSync(`${DIR}/${locale}/${slug}.mdx`, "utf8");
}

function orderOf(source: string): number | null {
  const match = /\border:\s*(\d+)\s*,/.exec(source);
  return match ? Number(match[1]) : null;
}

describe("the documentation manifest", () => {
  it("has a file for every slug, in every locale", () => {
    for (const locale of LOCALES) {
      for (const slug of DOC_SLUGS) {
        expect(sourceOf(locale, slug).length).toBeGreaterThan(0);
      }
    }
  });

  it("has a slug for every file, in every locale", () => {
    for (const locale of LOCALES) {
      const found = readdirSync(`${DIR}/${locale}`)
        .filter((name) => name.endsWith(".mdx"))
        .map((name) => name.replace(/\.mdx$/, ""));
      expect(found.sort()).toEqual([...DOC_SLUGS].sort());
    }
  });

  it("orders the pages 1..n, with no gaps and no ties, identically in both locales", () => {
    const expected = DOC_SLUGS.map((_, index) => index + 1);

    for (const locale of LOCALES) {
      const orders = DOC_SLUGS.map((slug) => orderOf(sourceOf(locale, slug)));
      expect([...orders].sort((a, b) => Number(a) - Number(b))).toEqual(expected);
    }

    // And the same page sits in the same position in both languages — a reader
    // switching locale mid-page must not have the sidebar reshuffle under them.
    for (const slug of DOC_SLUGS) {
      const [first, ...rest] = LOCALES.map((locale) =>
        orderOf(sourceOf(locale, slug)),
      );
      for (const other of rest) expect(other).toBe(first);
    }
  });

  it("states a title and a description in every file", () => {
    for (const locale of LOCALES) {
      for (const slug of DOC_SLUGS) {
        const source = sourceOf(locale, slug);
        expect(source).toMatch(/\btitle:\s*"/);
        expect(source).toMatch(/\bdescription:/);
      }
    }
  });

  /**
   * The page renders its `<h1>` from `meta.title`. A `#` heading in the content
   * would be a second, competing title that the sidebar and the index never
   * show — and the two would drift apart with nothing failing.
   */
  it("has no h1 in any content file", () => {
    for (const locale of LOCALES) {
      for (const slug of DOC_SLUGS) {
        const headings = sourceOf(locale, slug)
          .split("\n")
          .filter((line) => /^#\s/.test(line));
        expect(headings).toEqual([]);
      }
    }
  });

  /**
   * The link that rots first is the one between two documentation pages,
   * because renaming a slug is a rename in one place and a broken link in five.
   * Every other internal link is checked over HTTP in the verification crawl —
   * this suite has no route table to check it against.
   */
  it("links only to documentation pages that exist", () => {
    for (const locale of LOCALES) {
      for (const slug of DOC_SLUGS) {
        const source = sourceOf(locale, slug);
        for (const match of source.matchAll(/\]\(\/docs\/([a-z0-9-]+)\)/g)) {
          expect(isDocSlug(match[1])).toBe(true);
        }
      }
    }
  });
});

/**
 * The link the **app** makes into the documentation, which is the one that
 * cannot be checked by reading a page: a rejection notice renders only for a
 * rejected aircraft, and the anchor it points at lives in a different file in a
 * different language.
 */
describe("the anchors the app links into", () => {
  it("names a real page", () => {
    for (const anchor of Object.values(DOC_ANCHORS)) {
      expect(isDocSlug(anchor.slug)).toBe(true);
    }
  });

  it("is written as an explicit id in every locale's copy of that page", () => {
    for (const locale of LOCALES) {
      for (const anchor of Object.values(DOC_ANCHORS)) {
        expect(sourceOf(locale, anchor.slug)).toContain(`id="${anchor.id}"`);
      }
    }
  });

  /**
   * The reason `DOC_ANCHORS` exists at all. If these two ever became equal the
   * explicit id would look redundant and somebody would delete it — and the
   * link would then be right in one language and wrong in the other.
   */
  it("is needed because the derived slug is not language-independent", () => {
    expect(headingSlug("أسباب الرفض الشائعة")).not.toBe(
      headingSlug("Common rejection reasons"),
    );
  });

  it("builds an unprefixed href the locale-aware Link can prefix", () => {
    expect(docAnchorHref("rejectionReasons")).toBe(
      "/docs/registering-a-drone#common-rejection-reasons",
    );
  });
});

describe("headingSlug", () => {
  it("keeps Arabic letters and joins words with hyphens", () => {
    expect(headingSlug("المناطق والقواعد")).toBe("المناطق-والقواعد");
  });

  it("drops harakat, so an anchor does not depend on optional vowels", () => {
    expect(headingSlug("الهُوية")).toBe(headingSlug("الهوية"));
  });

  /**
   * A consequence of dropping combining marks, and a welcome one: NFKD splits
   * `أ` into a bare alef plus a hamza mark, so the fold that removes harakat
   * removes the hamza too. Arabic is written with the hamza optional in
   * practice, and an anchor that survives somebody typing `الاصل` for `الأصل`
   * is more useful than one that does not. Pinned here so it is a decision
   * rather than an accident somebody "fixes".
   */
  it("folds hamza on alef, so a spelling variant lands on the same anchor", () => {
    expect(headingSlug("الأصل هو المنع")).toBe("الاصل-هو-المنع");
    expect(headingSlug("الاصل هو المنع")).toBe(headingSlug("الأصل هو المنع"));
  });

  it("drops tatweel", () => {
    expect(headingSlug("الهوية عن بُعد")).toBe("الهوية-عن-بعد");
  });

  it("lowercases and strips punctuation in English", () => {
    expect(headingSlug("What Remote ID means")).toBe("what-remote-id-means");
    expect(headingSlug("Zones, rules — and refusals")).toBe(
      "zones-rules-and-refusals",
    );
  });

  it("keeps digits, which is what makes numbered steps addressable", () => {
    expect(headingSlug("1 · Create an account")).toBe("1-create-an-account");
  });

  it("never begins or ends with a hyphen", () => {
    expect(headingSlug("— leading and trailing —")).toBe("leading-and-trailing");
  });
});

describe("textOf", () => {
  it("reads a plain string", () => {
    expect(textOf("Zones")).toBe("Zones");
  });

  it("flattens the array MDX produces for a heading with inline markup", () => {
    expect(
      textOf(["Zones ", { props: { children: "and rules" } }, " here"]),
    ).toBe("Zones and rules here");
  });

  it("returns what it has rather than throwing on a shape it cannot read", () => {
    expect(textOf(null)).toBe("");
    expect(textOf({ nothing: true })).toBe("");
  });
});

describe("isDocMeta", () => {
  it("accepts a complete meta", () => {
    expect(isDocMeta({ title: "t", description: "d", order: 1 })).toBe(true);
  });

  it("rejects a meta missing a field, or with the wrong type", () => {
    expect(isDocMeta({ title: "t", description: "d" })).toBe(false);
    expect(isDocMeta({ title: "t", description: "d", order: "1" })).toBe(false);
    expect(isDocMeta(null)).toBe(false);
  });
});
