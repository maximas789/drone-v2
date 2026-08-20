"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * **Whose flights this act touches — named, not counted.**
 *
 * "This will cancel 3 bookings" is a number somebody accepts without thinking;
 * three people's names beside three times is a decision. Three surfaces need
 * exactly that list — suspending a zone, moving a published boundary, and
 * publishing a closure — so it is one component rather than three tables that
 * would drift in what they show and, worse, in what they omit.
 *
 * The time is wrapped in `<bdi>`, never in `dir="ltr"`: a formatted Arabic date
 * is a strong RTL run with neutral numerals around it, and forcing the
 * direction renders `19 أغسطس 2026 15:00` as `19 15:00 2026 أغسطس`. `innerText`
 * stays correct either way, so only a screenshot catches it.
 */
export type ImpactRow = {
  bookingId: string;
  pilotName: string;
  droneNickname: string | null;
  slotStart: string;
  slotEnd: string;
  status: string;
};

export function ImpactTable({
  rows,
  locale,
  emptyLabel,
  countLabel,
}: {
  rows: readonly ImpactRow[];
  locale: Locale;
  emptyLabel: string;
  /**
   * The sentence above the table, given both the **formatted** count and the
   * raw number.
   *
   * Two arguments rather than one because Arabic has six plural categories and
   * only a real number can select between them — while the number that is
   * *printed* has to be a string, or ICU formats it under the page locale and
   * emits Arabic-Indic digits (thread 22). So `n` chooses the branch and never
   * appears; `count` appears and never chooses.
   */
  countLabel?: (count: string, n: number) => string;
}) {
  const t = useTranslations("zoneAdmin");
  const tBookings = useTranslations("bookings");

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;
  }

  return (
    <>
      {countLabel ? (
        <p className="text-sm">
          {countLabel(formatNumber(rows.length, locale), rows.length)}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[30rem] border-collapse text-sm">
          <caption className="sr-only">{t("impactHeading")}</caption>
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="p-2 text-start font-medium">
                {t("colPilot")}
              </th>
              <th scope="col" className="p-2 text-start font-medium">
                {t("colWhen")}
              </th>
              <th scope="col" className="p-2 text-start font-medium">
                {t("colBookingStatus")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.bookingId} className="border-t">
                <td className="p-2 text-start">
                  {row.pilotName}
                  {row.droneNickname ? (
                    <span className="text-muted-foreground block text-xs">
                      {row.droneNickname}
                    </span>
                  ) : null}
                </td>
                <td className="p-2 text-start">
                  <bdi>{formatDateTime(new Date(row.slotStart), locale)}</bdi>
                </td>
                <td className="p-2 text-start">
                  <Badge variant="outline">
                    {tBookings.has(`status${capitalise(row.status)}`)
                      ? tBookings(
                          `status${capitalise(row.status)}` as "statusPending",
                        )
                      : row.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function capitalise(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
