import { getTranslations } from "next-intl/server";

/**
 * Name, year, and the honesty line.
 *
 * **Only links that exist.** F16 ships no footer navigation at all, because
 * every candidate — Docs, Privacy, Terms — belongs to a feature that has not
 * been built: F26 adds documentation, F27 adds the legal pages. A footer link
 * to a 404 is worse than a footer without one, and "add it now, wire it later"
 * is how a dead link ships. Those features add their own links here.
 */
export async function SiteFooter() {
  const t = await getTranslations("landing");
  const tCommon = await getTranslations("common");

  /**
   * A fixed year, not `new Date()`. A year that changes at midnight on 1
   * January makes every prerendered page stale and, worse, makes a page's
   * output depend on when it was rendered — which is untestable by definition.
   * F30 revisits this if it ever matters.
   */
  return (
    <footer className="mt-16 border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col gap-2 p-4 text-sm">
        <p>{t("footerLine")}</p>
        <p>{tCommon("proposalNotice")}</p>
      </div>
    </footer>
  );
}
