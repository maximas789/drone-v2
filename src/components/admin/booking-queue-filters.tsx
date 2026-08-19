import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import type { BookingFilters } from "@/lib/admin/filters";
import { URGENCY_BUCKETS } from "@/lib/admin/urgency";
import type { Locale } from "@/lib/locale";

/**
 * The bookings queue's filters — an ordinary **GET form**, like the drone
 * queue's, for the same three reasons: the filtered queue is a link a reviewer
 * can send to a colleague, the back button returns to the previous filter, and
 * the control ships no JavaScript.
 *
 * **A separate component rather than a `QueueFilters` with four optional
 * fields.** A booking is not narrowed by build type or by the pilot's home
 * city; it is narrowed by where and when it is meant to happen. One component
 * covering both would render two dead controls on whichever page it was on.
 */
export function BookingQueueFilters({
  filters,
  filtered,
  zones,
  locale,
  resultCount,
  totalCount,
}: {
  filters: BookingFilters;
  filtered: boolean;
  zones: ReadonlyArray<{ id: string; nameAr: string; nameEn: string }>;
  locale: Locale;
  /** Both counts arrive pre-formatted — thread 22. */
  resultCount: string;
  totalCount: string;
}) {
  const t = useTranslations("review");

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border p-4"
      role="search"
      aria-label={t("filtersLabel")}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-q">{t("filterSearch")}</Label>
          <Input
            id="booking-q"
            name="q"
            type="search"
            defaultValue={filters.q}
            maxLength={100}
            autoComplete="off"
            placeholder={t("filterSearchPlaceholder")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-zone">{t("filterZone")}</Label>
          <Select id="booking-zone" name="zone" defaultValue={filters.zone}>
            <option value="">{t("filterAny")}</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {locale === "ar" ? zone.nameAr : zone.nameEn}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-urgency">{t("filterUrgency")}</Label>
          <Select
            id="booking-urgency"
            name="urgency"
            defaultValue={filters.urgency}
          >
            {URGENCY_BUCKETS.map((bucket) => (
              <option key={bucket} value={bucket}>
                {t(`urgencyBuckets.${bucket}`)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline">
          {t("filterApply")}
        </Button>
        {filtered ? (
          <>
            <Link href="/admin/bookings" className="text-sm underline">
              {t("filterReset")}
            </Link>
            <span className="text-muted-foreground text-sm">
              {t("filterShowing", { shown: resultCount, total: totalCount })}
            </span>
          </>
        ) : null}
      </div>
    </form>
  );
}
