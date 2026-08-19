import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/lib/locale";
import { SlotTime } from "./slot-time";
import { BookingStatusBadge } from "./status-badge";

/**
 * One booking, as a row in the list.
 *
 * **The Remote ID is on the row, not only on the detail page.** A pilot
 * scanning their bookings for the one an inspector just asked about is
 * matching a code on a sticker, and making them open each row in turn to find
 * it is the difference between a list and a filing cabinet.
 *
 * The whole row is the link. A small "view" affordance at the end would be a
 * smaller touch target for the same destination, on the screen most likely to
 * be read on a phone.
 */

export type BookingRowData = {
  id: string;
  status: string;
  slotStart: Date;
  slotEnd: Date;
  zoneNameAr: string | null;
  zoneNameEn: string | null;
  remoteIdCode: string | null;
};

export async function BookingRow({
  booking,
  locale,
}: {
  booking: BookingRowData;
  locale: Locale;
}) {
  const t = await getTranslations("bookings");
  const zoneName =
    (locale === "ar" ? booking.zoneNameAr : booking.zoneNameEn) ??
    t("unknownZone");

  return (
    <li>
      <Link
        href={`/bookings/${booking.id}`}
        className="hover:border-ring flex flex-col gap-2 rounded-lg border p-4 transition-colors"
      >
        <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="font-medium">{zoneName}</span>
          <BookingStatusBadge status={booking.status} />
        </span>

        <span className="text-muted-foreground text-sm">
          <SlotTime
            start={booking.slotStart}
            end={booking.slotEnd}
            locale={locale}
          />
        </span>

        {booking.remoteIdCode ? (
          <span dir="ltr" className="text-muted-foreground text-start font-mono text-xs">
            {booking.remoteIdCode}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
