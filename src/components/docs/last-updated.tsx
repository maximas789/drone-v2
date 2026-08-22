import { getTranslations } from "next-intl/server";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * When this page's text last changed, from git.
 *
 * **Renders nothing when the date is unknown.** An absent line is honest; a
 * placeholder is not, and "last updated: —" on a documentation page reads as a
 * page nobody maintains rather than as a build that could not reach its own
 * history.
 *
 * `formatDate`, so the date is Gregorian with Latin numerals in Arabic too.
 */
export async function LastUpdated({
  date,
  locale,
}: {
  date: Date | null;
  locale: Locale;
}) {
  if (!date) return null;
  const t = await getTranslations("docs");

  return (
    <p className="text-muted-foreground text-xs">
      {t("lastUpdated", { date: formatDate(date, locale) })}
    </p>
  );
}
