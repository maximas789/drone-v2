import { useTranslations } from "next-intl";
import type { Reason } from "@/lib/airspace/types";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * The one place an airspace refusal becomes a sentence.
 *
 * The engine is pure and has no locale, so every reason arrives as a code plus
 * structured params — `{ ceiling: 120 }`, not "120 m". This component is where
 * they meet the catalogue, and it exists as a shared piece precisely so that
 * F20's map and F21's booking form do not each grow their own version and drift
 * apart on what a refusal says.
 *
 * **A refusal is always paired with its fix.** `airspace.reasons.<code>` says
 * no; `airspace.fixes.<code>` says what would work. Rendering one without the
 * other turns a helpful answer back into a form that just says "invalid".
 */

/**
 * Instant-valued params, which are formatted as a date and time rather than as
 * a number. An explicit list rather than a guess at the shape of the value: a
 * silent misclassification here would print an epoch millisecond count into an
 * Arabic sentence.
 */
const INSTANT_PARAMS = new Set(["nextOpen", "sunrise", "sunset"]);

/**
 * **Every number goes through `src/lib/format.ts` before ICU sees it.**
 *
 * next-intl formats a bare numeric argument itself, using the page locale — so
 * `{ceiling: 120}` renders as `١٢٠` under `ar`, which is the exact defect rule 6
 * exists to prevent, arriving by a route the ESLint rule cannot see (open thread
 * 22). Pre-formatting to a string is what stops it.
 */
export function formatReasonParams(
  params: Record<string, string | number> | undefined,
  locale: Locale,
): Record<string, string> {
  const formatted: Record<string, string> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (INSTANT_PARAMS.has(key)) {
      formatted[key] = formatDateTime(new Date(String(value)), locale);
    } else if (typeof value === "number") {
      formatted[key] = formatNumber(value, locale);
    } else {
      formatted[key] = value;
    }
  }
  return formatted;
}

export function DecisionReasons({
  reasons,
  locale,
}: {
  reasons: readonly Reason[];
  locale: Locale;
}) {
  const t = useTranslations("airspace");
  if (reasons.length === 0) return null;

  /**
   * The per-reason zone caption earns its place only when the reasons cite
   * **more than one** zone — a no-fly overlay refusing a point inside a
   * permitted carve-out, say. With a single zone it repeats whatever named the
   * zone above, and the map's panel does exactly that: the reader was shown
   * *العمارية* as the heading and then *العمارية* again under every line.
   * Found by opening the page.
   */
  const distinctZones = new Set(
    reasons.map((reason) => reason.zoneId).filter(Boolean),
  ).size;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{t("reasonsTitle")}</h3>
      <ul className="space-y-3">
        {reasons.map((reason, index) => (
          <li
            key={`${reason.code}-${index}`}
            className="border-s-2 border-destructive ps-3"
          >
            <p className="text-sm">
              {t(`reasons.${reason.code}`, formatReasonParams(reason.params, locale))}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              {t(
                `fixes.${reason.code}`,
                formatReasonParams(
                  // The fix often needs a value the refusal does not — the next
                  // opening is the whole answer to "the zone is closed".
                  { ...reason.params, ...reason.fixParams },
                  locale,
                ),
              )}
            </p>
            {distinctZones > 1 && reason.zoneNameAr && reason.zoneNameEn ? (
              <p className="text-muted-foreground mt-1 text-xs">
                {locale === "ar" ? reason.zoneNameAr : reason.zoneNameEn}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
