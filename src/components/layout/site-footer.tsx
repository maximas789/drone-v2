import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * Name, year, and the honesty line.
 *
 * **Only links that exist.** F16 shipped no footer navigation at all, because
 * every candidate — Docs, Privacy, Terms — belonged to a feature that had not
 * been built. A footer link to a 404 is worse than a footer without one, and
 * "add it now, wire it later" is how a dead link ships.
 *
 * **F26 added the first one**, because `/docs` existed and was public. **F27b
 * adds Privacy and Terms** on the same rule — both routes resolve in both
 * locales, so the links go in now and not before.
 */
export async function SiteFooter() {
  const t = await getTranslations("landing");
  const tCommon = await getTranslations("common");
  const tDocs = await getTranslations("docs");
  const tLegal = await getTranslations("legal");

  /**
   * A fixed year, not `new Date()`. A year that changes at midnight on 1
   * January makes every prerendered page stale and, worse, makes a page's
   * output depend on when it was rendered — which is untestable by definition.
   * F30 revisits this if it ever matters.
   */
  return (
    <footer className="mt-16 border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col gap-2 p-4 text-sm">
        {/**
         * Three members now, so the `<ul>` becomes a real row: `flex-wrap` and
         * `gap-x-4`, never a `·` separator typed between the items. A
         * hand-typed separator is read aloud by a screen reader and lands on
         * the wrong side of the line under RTL, where `gap` is direction-aware
         * for free.
         */}
        <nav aria-label={tCommon("footerNavLabel")}>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {[
              { href: "/docs", label: tDocs("title") },
              { href: "/privacy", label: tLegal("privacy") },
              { href: "/terms", label: tLegal("terms") },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="hover:text-foreground underline underline-offset-4"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p>{t("footerLine")}</p>
        <p>{tCommon("proposalNotice")}</p>
      </div>
    </footer>
  );
}
