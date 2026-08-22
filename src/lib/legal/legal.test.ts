import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONTACT_EMAIL,
  EFFECTIVE_DATE,
  GOVERNING_LAW,
  JURISDICTION,
  ORGANISATION_NAME,
} from "./fields";
import {
  LEGAL_SECTIONS,
  LEGAL_SLUGS,
  isLegalMeta,
  isLegalSlug,
  legalSectionHref,
} from "./documents";
import { LOCALES } from "@/lib/locale";

/**
 * **This file is why the legal pages are allowed to have a table of contents.**
 *
 * F26 turned one down for the documentation, and the objection was sound: a
 * hand-kept list of headings drifts away from the headings, and a drifted TOC
 * links a reader to nothing while every static check stays green. The list here
 * is hand-kept too — what is different is that it cannot drift silently. A
 * heading renamed without its entry, an entry with no heading, a section added
 * to Arabic and forgotten in English: each of those is a failure below.
 *
 * **The `.mdx` files are read as text, not imported** — Vitest has no MDX
 * loader, and adding one would mean maintaining a second compiler pipeline
 * beside the bundler's, with the usual result that the two disagree. Every
 * property asserted here is a property of the source.
 */

const DIR = "src/content/legal";

function sourceOf(locale: string, slug: string): string {
  return readFileSync(`${DIR}/${locale}/${slug}.mdx`, "utf8");
}

/** The `id` of each entry in `meta.sections`, in the order they are written. */
function tocIds(source: string): string[] {
  // `[\s\S]` rather than the `s` flag: this project's tsconfig target predates
  // `dotAll`, and TypeScript refuses the flag outright.
  const meta = /sections:\s*\[([\s\S]*?)\]\s*,?\s*\n\s*\}/.exec(source);
  if (!meta) return [];
  return [...meta[1].matchAll(/\bid:\s*"([^"]+)"/g)].map((m) => m[1]);
}

/** The `id` of each `<H2 id="…">` heading, in the order they appear. */
function headingIds(source: string): string[] {
  return [...source.matchAll(/<H2\s+id="([^"]+)"/g)].map((m) => m[1]);
}

describe("the legal documents' manifest", () => {
  it("has a file for every slug, in every locale", () => {
    for (const locale of LOCALES) {
      for (const slug of LEGAL_SLUGS) {
        expect(sourceOf(locale, slug).length).toBeGreaterThan(0);
      }
    }
  });

  /**
   * The mirror failure, and the reason F27a ships `LEGAL_SLUGS = ["privacy"]`
   * rather than listing `"terms"` ahead of the file: a slug with no file is a
   * build-time import error, and a file with no slug is a document that is
   * written, translated, and reachable by nobody.
   */
  it("has a slug for every file, in every locale", () => {
    for (const locale of LOCALES) {
      const found = readdirSync(`${DIR}/${locale}`)
        .filter((name) => name.endsWith(".mdx"))
        .map((name) => name.replace(/\.mdx$/, ""));
      expect(found.sort()).toEqual([...LEGAL_SLUGS].sort());
    }
  });

  it("narrows slugs, and rejects one it does not know", () => {
    expect(isLegalSlug("privacy")).toBe(true);
    expect(isLegalSlug("cookie-policy")).toBe(false);
    expect(legalSectionHref("privacy", "cookies")).toBe("/privacy#cookies");
  });
});

describe("the table of contents", () => {
  it("lists exactly LEGAL_SECTIONS, in order, in every locale", () => {
    for (const locale of LOCALES) {
      for (const slug of LEGAL_SLUGS) {
        expect(tocIds(sourceOf(locale, slug)), `${locale}/${slug}`).toEqual([
          ...LEGAL_SECTIONS[slug],
        ]);
      }
    }
  });

  /**
   * The half that actually catches drift. A contents entry whose heading was
   * renamed still *renders* — as a link that scrolls nowhere — so nothing but
   * this comparison would notice.
   */
  it("names a heading that exists, for every entry, in every locale", () => {
    for (const locale of LOCALES) {
      for (const slug of LEGAL_SLUGS) {
        expect(headingIds(sourceOf(locale, slug)), `${locale}/${slug}`).toEqual(
          [...LEGAL_SECTIONS[slug]],
        );
      }
    }
  });

  it("gives every section a non-empty title in its own language", () => {
    for (const locale of LOCALES) {
      for (const slug of LEGAL_SLUGS) {
        const titles = [
          ...sourceOf(locale, slug).matchAll(/\btitle:\s*"([^"]*)"/g),
        ].map((m) => m[1]);
        for (const title of titles) expect(title.trim()).not.toBe("");
      }
    }
  });
});

describe("the fields only a human can fill", () => {
  it("is complete — every one of them is set", () => {
    expect(CONTACT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
    expect(Number.isNaN(EFFECTIVE_DATE.getTime())).toBe(false);
    for (const locale of LOCALES) {
      expect(ORGANISATION_NAME[locale].trim()).not.toBe("");
      expect(GOVERNING_LAW[locale].trim()).not.toBe("");
      expect(JURISDICTION[locale].trim()).not.toBe("");
    }
  });

  /**
   * The acceptance criterion, as a test: *no contact address hard-coded in
   * prose*. `mdx-components.tsx` exposes `<ContactEmail />` precisely so that
   * the address has one home, and a policy that names it inline is one edit
   * away from naming an address nobody reads any more.
   */
  it("is never typed into the prose instead", () => {
    for (const locale of LOCALES) {
      for (const slug of LEGAL_SLUGS) {
        expect(sourceOf(locale, slug), `${locale}/${slug}`).not.toContain(
          CONTACT_EMAIL,
        );
      }
    }
  });
});

describe("the privacy policy's substance", () => {
  /**
   * These are not style checks. Each one is an acceptance criterion that a
   * later edit could delete without breaking anything a compiler can see, and
   * each is a **disclosure** — a policy that quietly loses its identity-reveal
   * paragraph is a worse document than one that never had it, because it still
   * looks complete.
   */
  const REQUIRED = [
    "identity-reveal",
    "how-long-we-keep-it",
    "who-else-receives-data",
    "cookies",
    "what-a-scan-reveals",
  ];

  it("keeps the sections the feature exists to publish", () => {
    for (const id of REQUIRED) {
      expect(LEGAL_SECTIONS.privacy as readonly string[]).toContain(id);
    }
  });

  it("names every third-party recipient, and no others", () => {
    const NAMED = ["Resend", "Vercel Blob", "Inngest", "OpenFreeMap"];
    /**
     * Anything on this list receiving data would be a real recipient the policy
     * omits. They are named here rather than in the policy because the policy
     * is right: nothing sends data to them. If one ever appears in the
     * dependency list, this test is the reminder to write the paragraph.
     */
    const FORBIDDEN = [
      "Google Analytics",
      "Sentry",
      "PostHog",
      "Plausible",
      "Mixpanel",
      "Cloudflare",
      "Mapbox",
    ];

    for (const locale of LOCALES) {
      const source = sourceOf(locale, "privacy");
      for (const name of NAMED) {
        expect(source, `${locale} names ${name}`).toContain(name);
      }
      for (const name of FORBIDDEN) {
        expect(source, `${locale} must not name ${name}`).not.toContain(name);
      }
    }
  });

  /**
   * The masking table, as the policy prints it, against the mask the code
   * actually applies. `maskIdDocument` produces five bullets and four digits;
   * a policy showing three bullets would be describing a different app.
   */
  it("prints the identity mask exactly as the code produces it", () => {
    for (const locale of LOCALES) {
      expect(sourceOf(locale, "privacy")).toContain("•••••1234");
    }
  });

  it("states the retention period the code enforces", () => {
    expect(sourceOf("en", "privacy")).toContain("**3 years**");
    expect(sourceOf("ar", "privacy")).toContain("**3 سنوات**");
  });
});

describe("the meta guard", () => {
  it("accepts a well-formed meta and rejects the ways it goes wrong", () => {
    expect(
      isLegalMeta({ title: "t", description: "d", sections: [] }),
    ).toBe(true);
    expect(
      isLegalMeta({
        title: "t",
        description: "d",
        sections: [{ id: "a", title: "A" }],
      }),
    ).toBe(true);

    expect(isLegalMeta(null)).toBe(false);
    expect(isLegalMeta({ title: "t", description: "d" })).toBe(false);
    expect(
      isLegalMeta({ title: "t", description: "d", sections: [{ id: "a" }] }),
    ).toBe(false);
  });
});
