import { useTranslations } from "next-intl";
import { TimeUntilBadge } from "@/components/admin/time-until-badge";
import { SlotTime } from "@/components/booking/slot-time";
import { Link } from "@/i18n/navigation";
import type { BookingQueueRow } from "@/lib/data/review";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * The pending-booking queue.
 *
 * A real `<table>` inside an `overflow-x-auto` box, for `QueueTable`'s reasons:
 * every row is the same six facts about a different flight, and the page body
 * must never scroll sideways at 375 px — the table scrolls inside its own
 * container instead.
 *
 * **The slot is rendered by `SlotTime`, not by concatenating a date and a time
 * range.** `19 أغسطس 2026 15:00 – 17:00` in a `dir="ltr"` container renders as
 * `19 17:00 – 15:00 2026 أغسطس`: the Arabic month is a strong RTL run and the
 * numerals around it are neutral. `SlotTime` isolates each part with `<bdi>`,
 * and it is the only thing in this codebase allowed to draw a slot.
 *
 * The **Remote ID, not the aircraft's nickname**, is the identifier column: a
 * nickname is what a pilot calls their drone, and the code is what is
 * broadcast, scanned and written on the booking. The nickname sits under it as
 * context.
 */
export function BookingQueueTable({
  rows,
  now,
  locale,
}: {
  rows: readonly BookingQueueRow[];
  now: Date;
  locale: Locale;
}) {
  const t = useTranslations("review");

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <caption className="sr-only">{t("queueBookingsCaption")}</caption>
        <thead className="bg-muted/50">
          <tr className="text-start">
            <Th>{t("colSlot")}</Th>
            <Th>{t("colUntil")}</Th>
            <Th>{t("colZone")}</Th>
            <Th>{t("colPilot")}</Th>
            <Th>{t("colIdentification")}</Th>
            <Th>
              <span className="sr-only">{t("colOpen")}</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t align-top">
              <Td>
                <SlotTime start={row.slotStart} end={row.slotEnd} locale={locale} />
              </Td>

              <Td>
                <div className="flex flex-col items-start gap-1.5">
                  <TimeUntilBadge
                    slotStart={row.slotStart}
                    now={now}
                    locale={locale}
                  />
                  <span className="text-muted-foreground text-xs">
                    {t("requestedAt", { at: formatDate(row.createdAt, locale) })}
                  </span>
                </div>
              </Td>

              <Td>{locale === "ar" ? row.zoneNameAr : row.zoneNameEn}</Td>

              <Td>
                {(locale === "ar" ? row.pilotNameAr : row.pilotNameEn) ??
                  t("pilotUnnamed")}
              </Td>

              <Td>
                <div className="flex flex-col gap-1">
                  {row.remoteIdCode ? (
                    <span dir="ltr" className="font-mono text-xs">
                      {row.remoteIdCode}
                    </span>
                  ) : null}
                  {row.droneNickname ? (
                    <span className="text-muted-foreground text-xs">
                      {row.droneNickname}
                    </span>
                  ) : null}
                </div>
              </Td>

              <Td>
                <Link
                  href={`/admin/bookings/${row.id}`}
                  className="text-sm underline"
                >
                  {t("review")}
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="text-muted-foreground p-3 text-start font-medium">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="p-3 text-start">{children}</td>;
}
