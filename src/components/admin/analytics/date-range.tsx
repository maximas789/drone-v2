import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { RANGE_KEYS, type RangeKey } from "@/lib/analytics/range";
import { formatDays } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * 7 / 30 / 90 days / all — **four links, not four buttons.**
 *
 * Changing the range changes what the page is showing, which is a navigation:
 * it must be middle-clickable, openable in a new tab, bookmarkable, and undoable
 * with the back button. A reviewer who wants to send a colleague "look at the
 * last ninety days" needs a URL, and a control built out of `onClick` does not
 * produce one. Same reasoning as `QueueTabs`, and `aria-current="page"` rather
 * than `aria-selected` for the same reason: this is not the ARIA tab pattern.
 *
 * The labels come through `formatDays`, so the numeral is Latin under `ar` and
 * the plural category is CLDR's rather than a hand-written ICU branch.
 */
export async function DateRange({
  active,
  locale,
}: {
  active: RangeKey;
  locale: Locale;
}) {
  const t = await getTranslations("analytics");

  return (
    <nav aria-label={t("rangeLabel")}>
      <ul className="flex flex-wrap items-center gap-1">
        {RANGE_KEYS.map((key) => (
          <li key={key}>
            <Link
              href={{ pathname: "/admin/analytics", query: { range: key } }}
              aria-current={key === active ? "page" : undefined}
              className={`inline-flex min-h-9 items-center rounded-md border px-3 text-sm transition-colors ${
                key === active
                  ? "border-foreground bg-secondary font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent"
              }`}
            >
              <bdi>
                {key === "all" ? t("rangeAll") : formatDays(Number(key), locale)}
              </bdi>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
