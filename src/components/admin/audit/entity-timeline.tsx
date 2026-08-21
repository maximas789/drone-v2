import { useTranslations } from "next-intl";
import { AuditTrail, type TrailEvent } from "@/components/admin/audit-trail";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/lib/locale";

/**
 * One record's own history, inline on its detail page.
 *
 * **A section, not a second trail component.** `AuditTrail` already renders the
 * rows and has done since F22; what was missing was a place to put it. Three of
 * the four detail pages had one — drones, bookings, pilots — and
 * `/admin/zones/[id]` did not, which meant a boundary move and the closure that
 * cancelled eleven flights were visible only to somebody who knew to go looking
 * in the full log. This is that place.
 *
 * It carries two things the bare trail does not: the **append-only sentence**,
 * because the claim that nothing rewrites this is worth making where somebody
 * is reading a record rather than only on the browser; and a link into the
 * browser filtered to this record, so "and then what happened" is one click
 * rather than a search.
 */
export function EntityTimeline({
  events,
  entityId,
  locale,
}: {
  events: readonly TrailEvent[];
  /** Deep-links the audit browser to this record. */
  entityId: string;
  locale: Locale;
}) {
  const t = useTranslations("audit");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">{t("trailTitle")}</h2>
        <Link
          href={{ pathname: "/admin/audit", query: { entityId } }}
          className="text-sm underline"
        >
          {t("title")}
        </Link>
      </div>

      <AuditTrail events={events} locale={locale} />

      <p className="text-muted-foreground text-xs">{t("appendOnly")}</p>
    </section>
  );
}
