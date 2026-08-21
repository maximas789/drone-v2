import "server-only";

import { getTranslations } from "next-intl/server";
import {
  formatDays,
  formatHours,
  formatMinuteOfDay,
  formatWeekday,
} from "@/lib/format";
import { pickColumns } from "@/lib/i18n-content";
import type { Locale } from "@/lib/locale";
import type { CsvSection } from "./csv";
import { bucketLabel, countLabel, rateLabel } from "./labels";
import { BUILD_TYPES, RESOLVERS } from "./palette";
import type { AnalyticsData } from "./queries";

/**
 * The current view, as CSV sections.
 *
 * **It reads the same `AnalyticsData` the page rendered**, not a second set of
 * queries written later. `getAnalytics` runs once per request in both places,
 * so an export can differ from the screen only by the seconds between two
 * clicks — never by a predicate somebody remembered to change in one file.
 *
 * **`getTranslations({ locale })`, with the locale passed in.** This module is
 * reached from a Route Handler, where `next/root-params` throws (thread 4).
 * A bare `getTranslations()` would fail at runtime, not at build.
 */
export async function analyticsSections(
  data: AnalyticsData,
  locale: Locale,
): Promise<readonly CsvSection[]> {
  const t = await getTranslations({ locale, namespace: "analytics" });
  const tDrones = await getTranslations({ locale, namespace: "drones" });

  const period = (key: string) =>
    bucketLabel(key, data.window.bucket, locale, t("weekOf"));

  const buildLabel = (type: (typeof BUILD_TYPES)[number]) =>
    tDrones(`buildTypes.${type}`);

  const edge = (hours: number) =>
    hours < 24 ? formatHours(hours, locale) : formatDays(hours / 24, locale);

  const tiles = data.tiles;

  return [
    {
      /**
       * The tiles go in the file even though they do not follow the range,
       * with the note that says so — a spreadsheet detached from this page has
       * no other way to carry that caveat, and a "median turnaround" column in
       * a file headed "last 7 days" would otherwise be read as a 7-day median.
       */
      title: t("tilesTitle"),
      head: [t("metric"), t("value")],
      rows: [
        [t("tilePendingDrones"), countLabel(tiles.pendingDrones, locale)],
        [t("tilePendingBookings"), countLabel(tiles.pendingBookings, locale)],
        [
          t("tileTurnaround"),
          tiles.medianTurnaroundHours === null
            ? "—"
            : formatHours(Math.round(tiles.medianTurnaroundHours), locale),
        ],
        [t("csvTurnaroundSample"), countLabel(tiles.turnaroundSampleSize, locale)],
        [t("tileActive"), countLabel(tiles.activeRegistrations, locale)],
        [t("tileExpiring"), countLabel(tiles.expiringWithin30Days, locale)],
        [t("tileAuthorisedToday"), countLabel(tiles.authorisedToday, locale)],
        [t("csvTilesNote"), t("tilesFixedNote")],
      ],
    },

    {
      title: t("registrationsTitle"),
      head: [t("period"), ...BUILD_TYPES.map(buildLabel), t("total")],
      rows: data.registrations.map((row) => [
        period(row.key),
        ...BUILD_TYPES.map((type) => countLabel(row.value[type], locale)),
        countLabel(
          BUILD_TYPES.reduce((sum, type) => sum + row.value[type], 0),
          locale,
        ),
      ]),
    },

    {
      title: t("outcomesTitle"),
      head: [t("period"), t("approved"), t("rejected")],
      rows: data.outcomes.map((row) => [
        period(row.key),
        countLabel(row.value.approved, locale),
        countLabel(row.value.rejected, locale),
      ]),
    },

    {
      title: t("turnaroundTitle"),
      head: [t("turnaroundBucket"), t("decisions")],
      rows: data.turnaround.map((bucket) => [
        bucket.to === null
          ? t("bucketOver", { from: edge(bucket.from) })
          : t("bucketRange", { from: edge(bucket.from), to: edge(bucket.to) }),
        countLabel(bucket.n, locale),
      ]),
    },

    {
      /**
       * **Every zone, not the eight the chart draws.** The bar chart is capped
       * because a ninth long Arabic name stops being readable; a spreadsheet
       * has no such limit, and the cap is only defensible because this section
       * carries the rest.
       */
      title: t("zonesTitle"),
      head: [t("zone"), t("bookings")],
      rows: data.zones.map((row) => [
        pickColumns(row, "name", locale),
        countLabel(row.n, locale),
      ]),
    },

    {
      title: t("utilisationTitle"),
      head: [t("weekday"), t("hour"), t("bookings")],
      rows: data.utilisation
        .slice()
        .sort((a, b) => a.weekday - b.weekday || a.hour - b.hour)
        .map((cell) => [
          formatWeekday(cell.weekday, locale),
          formatMinuteOfDay(cell.hour * 60, locale),
          countLabel(cell.n, locale),
        ]),
    },

    {
      title: t("noShowTitle"),
      head: [t("period"), t("noShows"), t("concluded"), t("rate")],
      rows: data.noShow.map((row) => {
        const total = row.value.noShow + row.value.attended;
        return [
          period(row.key),
          countLabel(row.value.noShow, locale),
          countLabel(total, locale),
          // A bucket with no concluded flights has no rate — a dash, not the
          // `0%` that would claim everybody turned up.
          total === 0 ? "—" : rateLabel(row.value.noShow / total, locale),
        ];
      }),
    },

    {
      title: t("resolutionsTitle"),
      head: [t("period"), ...RESOLVERS.map((side) => t(`resolver.${side}`))],
      rows: data.resolutions.map((row) => [
        period(row.key),
        ...RESOLVERS.map((side) => countLabel(row.value[side], locale)),
      ]),
    },
  ];
}
