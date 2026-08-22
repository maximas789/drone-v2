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
 * **F26 adds the first one**, because `/docs` now exists and is public. F27
 * adds Privacy and Terms the same way — when they resolve, and not before.
 */
export async function SiteFooter() {
  const t = await getTranslations("landing");
  const tCommon = await getTranslations("common");
  const tDocs = await getTranslations("docs");

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
         * A `<nav>` with one link is still a nav: F27 adds Privacy and Terms
         * beside it, and a list that starts as a bare anchor gets rebuilt as a
         * list the moment it has a second member.
         */}
        <nav>
          <ul>
            <li>
              <Link href="/docs" className="hover:text-foreground underline underline-offset-4">
                {tDocs("title")}
              </Link>
            </li>
          </ul>
        </nav>
        <p>{t("footerLine")}</p>
        <p>{tCommon("proposalNotice")}</p>
      </div>
    </footer>
  );
}
