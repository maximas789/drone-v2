import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import type { QueueFilters } from "@/lib/admin/filters";
import { AGE_BUCKETS } from "@/lib/admin/queue";
import type { Locale } from "@/lib/locale";
import { BUILD_TYPES } from "@/lib/validation/drone";

/**
 * The queue's filters, as an ordinary **GET form**.
 *
 * No `"use client"`, no state, no router push. The filters end up in the query
 * string because the browser puts them there, which buys three things a
 * client-side filter panel does not: the filtered queue is a **link** a
 * reviewer can send to a colleague, the back button returns to the previous
 * filter rather than to the previous page, and the whole control ships no
 * JavaScript. Same reasoning as F21b putting the bookings tab in the URL.
 *
 * `action` is omitted deliberately — a GET form with no action submits to the
 * current URL, so this component does not need to know the locale prefix it is
 * rendered under.
 *
 * **Native `required` appears nowhere**, per the standing rule: it cancels the
 * submit and speaks the browser's language, so the app's own bilingual refusal
 * never runs. Nothing here is required anyway; every field's empty value is a
 * meaningful "no filter".
 */
export function QueueFilters({
  filters,
  filtered,
  cities,
  locale,
  resultCount,
  totalCount,
}: {
  filters: QueueFilters;
  filtered: boolean;
  cities: ReadonlyArray<{ id: string; nameAr: string; nameEn: string }>;
  locale: Locale;
  /** Both counts arrive pre-formatted — thread 22. */
  resultCount: string;
  totalCount: string;
}) {
  const t = useTranslations("review");
  const tDrones = useTranslations("drones");

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border p-4"
      // A search form, announced as one.
      role="search"
      aria-label={t("filtersLabel")}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="queue-q">{t("filterSearch")}</Label>
          <Input
            id="queue-q"
            name="q"
            type="search"
            defaultValue={filters.q}
            maxLength={100}
            autoComplete="off"
            placeholder={t("filterSearchPlaceholder")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="queue-build">{tDrones("buildType")}</Label>
          <Select id="queue-build" name="build" defaultValue={filters.build}>
            <option value="">{t("filterAny")}</option>
            {BUILD_TYPES.map((value) => (
              <option key={value} value={value}>
                {tDrones(`buildTypes.${value}`)}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="queue-city">{t("filterCity")}</Label>
          <Select id="queue-city" name="city" defaultValue={filters.city}>
            <option value="">{t("filterAny")}</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {locale === "ar" ? city.nameAr : city.nameEn}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="queue-age">{t("filterAge")}</Label>
          <Select id="queue-age" name="age" defaultValue={filters.age}>
            {AGE_BUCKETS.map((bucket) => (
              <option key={bucket} value={bucket}>
                {t(`ageBuckets.${bucket}`)}
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
            {/*
              The reset is a plain link back to the unfiltered path, not a
              button that clears the fields — clearing them leaves the URL
              saying one thing and the form another until somebody presses
              submit again.
            */}
            <Link href="/admin" className="text-sm underline">
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
