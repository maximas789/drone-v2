"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { SettingsSection } from "@/lib/settings/sections";

/**
 * The settings sections, with the one being read marked.
 *
 * **A client component, unlike F26's docs sidebar** — and for the opposite
 * reason to the one that kept that sidebar on the server. The docs sidebar is
 * rendered by each page, which already knows its own slug; a settings *layout*
 * does not know which child is rendering, and the only ways to tell it are a
 * client component reading the pathname or duplicating the nav into every page.
 * One small `"use client"` boundary is cheaper than five copies of a `<ul>`
 * that must agree.
 *
 * `usePathname` is next-intl's, which returns the path **without** the locale
 * prefix — so the comparison is against `/settings/profile` in both languages
 * rather than against two different strings.
 *
 * `aria-current="page"`, not styling alone: a screen-reader user gets the same
 * "you are here" everybody else gets from the highlight.
 */
export function SettingsSectionNav({
  sections,
}: {
  sections: readonly SettingsSection[];
}) {
  const t = useTranslations("settings");
  const pathname = usePathname();

  return (
    <nav aria-label={t("navLabel")}>
      {/**
       * A scrolling row on a phone and a column from `md` up. The row is
       * `overflow-x-auto` so a fifth section scrolls **inside the nav** rather
       * than widening the page — under RTL a page that scrolls sideways hides
       * the start of every line, which is the failure that is hardest to spot
       * and worst to live with.
       */}
      <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible md:border-s md:ps-4">
        {sections.map((section) => {
          const active = pathname === section.href;
          return (
            <li key={section.slug} className="shrink-0">
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "bg-muted text-foreground block rounded-md px-3 py-2 text-sm font-medium md:bg-transparent md:px-0"
                    : "text-muted-foreground hover:text-foreground block rounded-md px-3 py-2 text-sm md:px-0"
                }
              >
                {t(`${section.slug}.title`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
