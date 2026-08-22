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
import { NO_SHOW_GRACE_MINUTES } from "@/lib/inngest/rules";
import { LOCALES } from "@/lib/locale";
import { MIN_AGE_YEARS } from "@/lib/validation/profile";
import { PILOT_CANCEL_LEAD_MS, REGISTRATION_YEARS } from "@/lib/workflow/rules";
import { TRANSITIONS } from "@/lib/workflow/transitions";

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
    expect(isLegalSlug("terms")).toBe(true);
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

describe("the privacy policy's deletion claims", () => {
  /**
   * **F28c made this section false and then true again.** Until account
   * deletion existed the policy said, correctly, that there was none — and the
   * day the feature landed that sentence became the most misleading paragraph
   * in the document. These assertions are what stops the pair drifting a second
   * time: they tie the prose to the two refusals and the one survival rule that
   * `src/lib/data/account-deletion.ts` actually implements.
   */
  it("says deletion is self-service, and no longer says it is not", () => {
    for (const locale of LOCALES) {
      const source = sourceOf(locale, "privacy");
      expect(source).toContain("/settings/account");
    }
    // The sentence F27a shipped. It must not survive the feature.
    expect(sourceOf("en", "privacy")).not.toContain(
      "no way to delete your account",
    );
    expect(sourceOf("ar", "privacy")).not.toContain(
      "لا توجد اليوم أداة لحذف الحساب",
    );
  });

  it("names both refusals the code enforces", () => {
    const en = sourceOf("en", "privacy");
    expect(en).toContain("approved upcoming booking");
    expect(en).toContain("only administrator account");

    const ar = sourceOf("ar", "privacy");
    expect(ar).toContain("حجز معتمد قادم");
    expect(ar).toContain("حساب المسؤول الوحيد");
  });

  /**
   * The survival rule, in both directions: what is kept, and that the kept
   * Remote ID is owner-less rather than merely present.
   */
  it("says the Remote ID and the audit log survive, anonymised", () => {
    const en = sourceOf("en", "privacy");
    expect(en).toContain("registration withdrawn");
    expect(en).toContain("**Kept, with no owner**");
    expect(en).toContain("**Kept**, with your identity cleared from it");

    const ar = sourceOf("ar", "privacy");
    expect(ar).toContain("تسجيل مسحوب");
    expect(ar).toContain("**تبقى بلا مالك**");
  });
});

describe("the terms' operational clauses", () => {
  /**
   * **The clauses F27 singles out, each against the constant that enforces it.**
   *
   * A terms page is the easiest document in the repository to write from
   * memory, and the most expensive to get wrong: "cancel up to an hour before"
   * is a sentence nobody would question and the code refuses at two. So every
   * number in the prose is asserted against the module that owns it.
   *
   * `MIN_AGE_YEARS`, `REGISTRATION_YEARS`, `PILOT_CANCEL_LEAD_MS` and
   * `NO_SHOW_GRACE_MINUTES` come from pure modules and are imported. The two
   * no-show numbers live in `src/lib/data/pilot.ts`, which carries
   * `server-only` and opens a database connection, so they are **read out of
   * its source** rather than dragged into this suite — the same call the `.mdx`
   * files get above, for the same reason.
   */
  function constantIn(file: string, name: string): number {
    const source = readFileSync(file, "utf8");
    const match = new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(source);
    if (!match) throw new Error(`${name} not found in ${file}`);
    return Number(match[1]);
  }

  const numbers = {
    minAge: MIN_AGE_YEARS,
    years: REGISTRATION_YEARS,
    cancelHours: PILOT_CANCEL_LEAD_MS / (60 * 60 * 1000),
    graceMinutes: NO_SHOW_GRACE_MINUTES,
    noShowLimit: constantIn("src/lib/data/pilot.ts", "NO_SHOW_LIMIT"),
    noShowDays: constantIn("src/lib/data/pilot.ts", "NO_SHOW_WINDOW_DAYS"),
  };

  it("has the constants this suite believes it has", () => {
    expect(numbers).toEqual({
      minAge: 18,
      years: 3,
      cancelHours: 2,
      graceMinutes: 30,
      noShowLimit: 3,
      noShowDays: 90,
    });
  });

  it("prints every one of them, in both languages", () => {
    const expected = {
      en: [
        `**${numbers.minAge} or over**`,
        `lasts ${numbers.years} years`,
        `**${numbers.cancelHours} hours** before`,
        `**${numbers.graceMinutes} minutes**`,
        `**${numbers.noShowLimit} no-shows within ${numbers.noShowDays} days**`,
      ],
      ar: [
        `**${numbers.minAge} سنة**`,
        `**مدة التسجيل ${numbers.years} سنوات**`,
        `**${numbers.graceMinutes} دقيقة**`,
        `**${numbers.noShowLimit} حالات عدم حضور خلال ${numbers.noShowDays} يوماً**`,
        /**
         * **The cancellation window is the one number Arabic does not spell
         * with a digit.** Two of something is the dual — `ساعتين`, one word,
         * no numeral — and writing `2 ساعات` to make it greppable would be
         * broken Arabic on the page that has to be trusted most.
         *
         * So the assertion is on the dual form, and it is guarded by the
         * `cancelHours: 2` line in the test above: change
         * `PILOT_CANCEL_LEAD_MS` and that test fails first, pointing here. The
         * phrase below then has to be rewritten by someone who knows that
         * three hours is `3 ساعات` and the dual is gone.
         */
        ...(numbers.cancelHours === 2 ? ["**ساعتين** قبل بداية النافذة"] : []),
      ],
    };

    for (const [locale, phrases] of Object.entries(expected)) {
      const source = sourceOf(locale, "terms");
      for (const phrase of phrases) {
        expect(source, `${locale}/terms is missing "${phrase}"`).toContain(
          phrase,
        );
      }
    }
  });

  /**
   * The single most important sentence in the app, and the one an edit is most
   * likely to soften. Both halves are required: that this grants no permission
   * to fly, and that Ajniha is a proposal rather than an official GACA system.
   */
  it("says it is not a substitute for GACA authorisation, prominently", () => {
    expect(LEGAL_SECTIONS.terms as readonly string[]).toContain(
      "not-a-substitute-for-gaca",
    );
    // Second of fourteen sections — above the fold, not buried.
    expect(LEGAL_SECTIONS.terms[1]).toBe("not-a-substitute-for-gaca");

    expect(sourceOf("en", "terms")).toContain(
      "grants you no legal permission to fly",
    );
    expect(sourceOf("en", "terms")).toContain(
      "**proposed initiative and not an official system**",
    );
    expect(sourceOf("ar", "terms")).toContain("لا يمنحك أي إذن نظامي بالطيران");
    expect(sourceOf("ar", "terms")).toContain(
      "**مبادرة مقترحة، لا نظاماً رسمياً**",
    );
  });

  /**
   * Revocation is `actors: ["admin"]` in `TRANSITIONS`, deliberately not
   * `reviewer` — the terms must not describe a power a reviewer does not have.
   */
  it("attributes revocation to an admin, not a reviewer", () => {
    expect(TRANSITIONS["drone.revoked"].actors).toEqual(["admin"]);
    expect(TRANSITIONS["drone.revoked"].reasonMinLength).toBeGreaterThan(0);
    expect(sourceOf("en", "terms")).toContain("**Revocation is an admin's power alone**");
    expect(sourceOf("ar", "terms")).toContain("**السحب صلاحية مسؤول النظام وحده**");
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
