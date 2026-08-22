import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SETTINGS_SECTIONS, sectionsFor } from "./sections";
import { LOCALES } from "@/lib/locale";

/**
 * F28's first acceptance criterion — *every section listed in the nav resolves
 * to a page with real content* — and its two prohibitions, as tests.
 *
 * None of this is checkable by a compiler: a slug with no route type-checks
 * perfectly and 404s the first time somebody clicks it, and a Billing section
 * would be a lie that every static check waves through.
 */

const ROUTES = "src/app/[locale]/(app)/settings";

describe("the settings sections", () => {
  it("has a page for every section, and lists every page it has", () => {
    const built = readdirSync(ROUTES, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(built).toEqual([...SETTINGS_SECTIONS.map((s) => s.slug)].sort());
  });

  it("points each section at its own route", () => {
    for (const section of SETTINGS_SECTIONS) {
      expect(section.href).toBe(`/settings/${section.slug}`);
    }
  });

  /**
   * **The two sections that must never exist.** The app takes no payments and
   * exposes no agent access, so either would be an empty tab describing a
   * product this is not. Asserted against the *route directory* rather than the
   * list, because the failure worth catching is somebody adding the page.
   */
  it("has no Billing and no Connected apps, as routes or as entries", () => {
    const forbidden = ["billing", "payments", "subscription", "connected", "apps", "integrations"];
    const built = readdirSync(ROUTES, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const name of forbidden) {
      expect(built, `a /settings/${name} route exists`).not.toContain(name);
      expect(
        SETTINGS_SECTIONS.map((s) => String(s.slug)),
        `${name} is listed in the nav`,
      ).not.toContain(name);
    }
  });

  /**
   * F27 built no cookie banner, so there is nothing to reopen. A
   * cookie-preferences control here would be a button that changes nothing —
   * the same theatre F27 refused, relocated.
   */
  it("has no cookie-preferences control", () => {
    for (const locale of LOCALES) {
      const catalogue = readFileSync(`messages/${locale}.json`, "utf8");
      const messages = JSON.parse(catalogue) as {
        settings: Record<string, unknown>;
      };
      for (const key of Object.keys(messages.settings)) {
        expect(key.toLowerCase()).not.toContain("cookie");
      }
    }
  });

  it("gives every section a title and an intro in both catalogues", () => {
    for (const locale of LOCALES) {
      const messages = JSON.parse(
        readFileSync(`messages/${locale}.json`, "utf8"),
      ) as { settings: Record<string, { title?: string; intro?: string }> };

      for (const section of SETTINGS_SECTIONS) {
        const entry = messages.settings[section.slug];
        expect(entry?.title, `${locale} ${section.slug}.title`).toBeTruthy();
        expect(entry?.intro, `${locale} ${section.slug}.intro`).toBeTruthy();
      }
    }
  });
});

describe("who sees which section", () => {
  /**
   * Nothing is admin-only yet — F29's System section is the first. The test is
   * here now so that adding it cannot quietly show it to pilots.
   */
  it("hides admin-only sections from everyone else", () => {
    for (const role of ["pilot", "reviewer"] as const) {
      expect(sectionsFor(role).every((s) => !s.adminOnly)).toBe(true);
    }
    expect(sectionsFor("admin")).toEqual(SETTINGS_SECTIONS);
  });

  it("shows a pilot every section that is not admin-only", () => {
    expect(sectionsFor("pilot")).toEqual(
      SETTINGS_SECTIONS.filter((s) => !s.adminOnly),
    );
  });
});
