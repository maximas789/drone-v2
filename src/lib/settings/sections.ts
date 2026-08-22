import type { Role } from "@/lib/session";

/**
 * The settings sections, as data.
 *
 * **A section appears here in the commit that builds its page, and not
 * before.** F16 made the same call about the footer and F27b repeated it: a nav
 * entry pointing at a 404 is worse than a nav with one fewer entry, and "add it
 * now, wire it later" is how a dead link ships. So this list grows across
 * F28a/b/c and F29 rather than arriving complete and half-broken.
 *
 * It is also the answer to F28's first acceptance criterion — *every section
 * listed in the nav resolves to a page with real content* — as a property
 * rather than a promise: the nav renders this list, the index page renders this
 * list, and there is no third place where a section could be named.
 *
 * **There is no Billing and no Connected apps**, and there never will be while
 * the app takes no payments and exposes no agent access. An empty Billing tab
 * is a lie about what the product does. Same for a cookie-preferences control:
 * F27 built no banner, so there is nothing to reopen.
 *
 * Pure — no `server-only`, no database. The nav is a Server Component and the
 * index page is another; both read it, and a unit test reads it without either.
 */

export type SettingsSectionSlug = "profile" | "language";

export type SettingsSection = {
  slug: SettingsSectionSlug;
  /** Locale-prefixed later by `Link`. */
  href: string;
  /**
   * Hidden from anyone who is not an admin. Nothing here is admin-only yet —
   * **F29's System section is the first**, and it arrives with its page.
   */
  adminOnly: boolean;
};

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { slug: "profile", href: "/settings/profile", adminOnly: false },
  { slug: "language", href: "/settings/language", adminOnly: false },
];

/**
 * What this person may see.
 *
 * **Visibility only — never a permission.** Hiding a link is a courtesy to
 * someone who cannot use it, and it stops a dead link appearing for a pilot;
 * it is not what stops them reaching the page. Every settings page calls its
 * own guard, and every action behind one calls a guard again. The same rule
 * `src/proxy.ts` is written under.
 */
export function sectionsFor(role: Role): readonly SettingsSection[] {
  return SETTINGS_SECTIONS.filter(
    (section) => !section.adminOnly || role === "admin",
  );
}
