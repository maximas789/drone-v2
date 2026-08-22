import { getTranslations } from "next-intl/server";
import { formatNumber } from "@/lib/format";
import type { DataCounts } from "@/lib/ops/counts";
import type { Locale } from "@/lib/locale";

/**
 * Row counts, after a deploy or a seed.
 *
 * **Every number goes through `formatNumber`**, which is the whole reason
 * `src/lib/format.ts` exists: a bare `{n}` interpolated into an Arabic page
 * renders Arabic-Indic digits, and this app shows Latin numerals in both
 * languages. A counts panel is exactly where somebody would forget.
 *
 * The grouped rows come from the enum rather than from the data, so a status
 * with no rows shows `0` instead of vanishing — see `counts.ts`.
 */
export async function DataCountsPanel({
  counts,
  locale,
}: {
  counts: DataCounts;
  locale: Locale;
}) {
  const t = await getTranslations("ops");

  const totals = [
    { key: "pilots", value: counts.pilots },
    { key: "remoteIds", value: counts.remoteIds },
    { key: "auditEvents", value: counts.auditEvents },
  ];

  const groups = [
    { key: "drones", rows: counts.drones, labels: "droneStatus" },
    { key: "bookings", rows: counts.bookings, labels: "bookingStatus" },
    { key: "zones", rows: counts.zones, labels: "zoneKind" },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {totals.map((entry) => (
          <div
            key={entry.key}
            className="flex flex-col gap-1 rounded-lg border p-3"
          >
            <dt className="text-muted-foreground text-xs">
              {t(`counts.${entry.key}`)}
            </dt>
            <dd className="text-lg font-medium">
              {formatNumber(entry.value, locale)}
            </dd>
          </div>
        ))}
      </dl>

      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">{t(`counts.${group.key}`)}</h4>
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {group.rows.map((row) => (
              <div key={row.key} className="flex gap-1">
                <dt className="text-muted-foreground">
                  {t(`${group.labels}.${row.key}`)}
                </dt>
                <dd className="font-medium">
                  {formatNumber(row.value, locale)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
