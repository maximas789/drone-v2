import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { notFound } from "next/navigation";
import { ZoneDrawing } from "@/components/airspace/zone-drawing";
import { BookingActions } from "@/components/booking/booking-actions";
import {
  StatusTimeline,
  type TimelineStep,
} from "@/components/booking/status-timeline";
import { requireUser } from "@/lib/auth-guards";
import { getBookingById, getBookingCopilots } from "@/lib/data/booking";
import { getDroneById, getRemoteIdForDrone } from "@/lib/data/drone";
import { listActiveZones } from "@/lib/data/zone";
import { SlotTime } from "@/components/booking/slot-time";
import { formatAltitude } from "@/lib/format";
import { toLocale } from "@/lib/locale";

/**
 * `/bookings/[id]` — one flight, and everything an inspector or a reviewer
 * would ask about it.
 *
 * **`getBookingById` is the whole authorisation.** It returns `null` for a row
 * that is not this session's, and the difference between "does not exist" and
 * "is not yours" is deliberately invisible — otherwise the 404/403 split
 * enumerates other pilots' flights. Pilot B opening pilot A's booking gets the
 * same page a nonexistent id gets.
 *
 * **The Remote ID is the headline.** `booking.remoteIdId` is `NOT NULL` because
 * the flight binds to the identity an inspector scans, not to the airframe —
 * so it is the one value on this page rendered large, monospaced and `ltr`.
 *
 * **Check-in and cancel windows are computed here, on the server clock.** A
 * browser three hours out would otherwise draw a check-in button outside the
 * slot. The actions refuse independently; this only decides what to offer.
 */

/** Check-in opens a quarter of an hour early — F13's window, restated. */
const CHECK_IN_LEAD_MS = 15 * 60_000;
/** And cancellation shuts two hours before. Later is a no-show with manners. */
const CANCEL_CUTOFF_MS = 2 * 60 * 60_000;

export default async function BookingDetailPage({
  params,
}: PageProps<"/[locale]/bookings/[id]">) {
  const locale = toLocale(await localeParam());
  const session = await requireUser(locale);
  const t = await getTranslations("bookings");
  const tBooking = await getTranslations("booking");

  const { id } = await params;
  const row = await getBookingById(session, id);
  if (!row) notFound();

  const [copilots, drone, zones] = await Promise.all([
    getBookingCopilots(session, row.id),
    getDroneById(session, row.droneId),
    listActiveZones(session),
  ]);
  const remoteId = drone ? await getRemoteIdForDrone(session, drone.id) : null;
  const zone = zones.find((candidate) => candidate.id === row.zoneId) ?? null;

  // `new Date()`, as everywhere else in this codebase — the window is decided
  // on the server's clock, never the browser's.
  const now = new Date().getTime();
  const slotStart = row.slotStart.getTime();
  const cancelCutoff = new Date(slotStart - CANCEL_CUTOFF_MS);

  const live = row.status === "approved" || row.status === "pending";
  const canCheckIn =
    row.status === "approved" &&
    row.checkedInAt === null &&
    now >= slotStart - CHECK_IN_LEAD_MS &&
    now <= row.slotEnd.getTime();
  const canCancel = live && now < cancelCutoff.getTime();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">
          {zone ? (locale === "ar" ? zone.nameAr : zone.nameEn) : t("title")}
        </h1>
        <p className="text-muted-foreground">
          <SlotTime start={row.slotStart} end={row.slotEnd} locale={locale} />
        </p>
      </header>

      {/**
       * The identifier a field inspector asks for, first and largest. An
       * approved booking with its Remote ID buried three sections down is a
       * screen that fails at the one moment it exists for.
       */}
      {remoteId ? (
        <section className="bg-card flex flex-col gap-1 rounded-lg border p-5">
          <h2 className="text-muted-foreground text-sm">{t("remoteId")}</h2>
          <p dir="ltr" className="text-start font-mono text-2xl">
            {remoteId.code}
          </p>
          {drone ? (
            <p className="text-muted-foreground text-sm">{drone.nickname}</p>
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">{t("status")}</h2>
        <StatusTimeline steps={timelineFor(row)} locale={locale} />
      </section>

      {/**
       * **Verbatim.** A rejection or an authority cancellation is a decision
       * somebody made in words, and paraphrasing it — or replacing it with a
       * generic "not approved" — removes the only thing that tells the pilot
       * what to change.
       */}
      {row.rejectionReason ? (
        <section className="border-destructive flex flex-col gap-2 rounded-lg border border-s-4 p-4">
          <h2 className="font-medium">{t("rejectedTitle")}</h2>
          <p className="text-sm whitespace-pre-wrap">{row.rejectionReason}</p>
        </section>
      ) : null}
      {row.cancellationReason ? (
        <section className="flex flex-col gap-2 rounded-lg border border-s-4 p-4">
          <h2 className="font-medium">{t("cancelledTitle")}</h2>
          <p className="text-sm whitespace-pre-wrap">{row.cancellationReason}</p>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">{t("details")}</h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Row label={tBooking("plannedAltitude")}>
            <span dir="ltr">
              {row.plannedAltitudeM === null
                ? "—"
                : formatAltitude(row.plannedAltitudeM, locale)}
            </span>
          </Row>
          <Row label={tBooking("purpose")}>
            {row.purpose
              ? tBooking(`purposes.${row.purpose}` as never)
              : tBooking("purposeNone")}
          </Row>
          {row.purposeNote ? (
            <Row label={tBooking("purposeNote")}>{row.purposeNote}</Row>
          ) : null}
        </dl>

        {copilots.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="font-medium">{tBooking("copilotsCount")}</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {copilots.map((copilot) => (
                <li key={copilot.id} className="flex flex-wrap gap-x-3">
                  <span>
                    {locale === "ar" ? copilot.fullNameAr : copilot.fullNameEn}
                  </span>
                  {copilot.mobileE164 ? (
                    <span dir="ltr" className="text-muted-foreground">
                      {copilot.mobileE164}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {live ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">{t("actions")}</h2>
          <BookingActions
            bookingId={row.id}
            canCheckIn={canCheckIn}
            canCancel={canCancel}
            cancelCutoff={cancelCutoff.toISOString()}
            locale={locale}
          />
        </section>
      ) : null}

      {/**
       * **The zone, not the point.** `booking` has no coordinate column — the
       * seat is in a zone, and F20's map is where a point is chosen — so
       * drawing a marker here would be inventing a location the record does not
       * hold. The same SVG the landing page uses, given one zone.
       */}
      {zone ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">{t("whereTitle")}</h2>
          <ZoneDrawing zones={[zone]} />
        </section>
      ) : null}
    </main>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3 sm:block">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-start">{children}</dd>
    </div>
  );
}

/**
 * The steps this booking actually went through.
 *
 * A rejected or cancelled booking ends there: the remaining steps are not
 * "upcoming", they are never happening, and drawing them greyed would say
 * otherwise.
 */
function timelineFor(row: {
  status: string;
  createdAt: Date;
  decidedAt: Date | null;
  cancelledAt: Date | null;
  checkedInAt: Date | null;
  slotEnd: Date;
}): TimelineStep[] {
  const iso = (value: Date | null) => (value ? value.toISOString() : null);
  const requested: TimelineStep = {
    key: "requested",
    at: iso(row.createdAt),
    current: row.status === "pending",
  };

  if (row.status === "rejected") {
    return [
      requested,
      { key: "rejected", at: iso(row.decidedAt), current: true },
    ];
  }
  if (row.status === "cancelled") {
    return [
      requested,
      { key: "cancelled", at: iso(row.cancelledAt), current: true },
    ];
  }
  if (row.status === "no_show") {
    return [
      requested,
      { key: "approved", at: iso(row.decidedAt), current: false },
      { key: "noShow", at: iso(row.slotEnd), current: true },
    ];
  }

  return [
    requested,
    {
      key: "approved",
      at: iso(row.decidedAt),
      current: row.status === "approved" && row.checkedInAt === null,
    },
    {
      key: "checkedIn",
      at: iso(row.checkedInAt),
      current: row.checkedInAt !== null && row.status !== "completed",
    },
    {
      key: "completed",
      at: row.status === "completed" ? iso(row.slotEnd) : null,
      current: row.status === "completed",
    },
  ];
}
