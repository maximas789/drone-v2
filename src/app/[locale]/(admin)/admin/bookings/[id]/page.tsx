import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { AirspaceRecheck } from "@/components/admin/airspace-recheck";
import { AuditTrail } from "@/components/admin/audit-trail";
import { BookingDecisionPanel } from "@/components/admin/booking-decision-panel";
import { BookingZoneMap } from "@/components/admin/booking-zone-map";
import { OwnSubmissionNotice } from "@/components/admin/own-submission-notice";
import { PilotHistoryPanel } from "@/components/admin/pilot-history";
import { PilotIdentityReveal } from "@/components/admin/pilot-identity-reveal";
import { ReviewPresence } from "@/components/admin/review-presence";
import { SlotTime } from "@/components/booking/slot-time";
import { BookingStatusBadge } from "@/components/booking/status-badge";
import { Disclaimer } from "@/components/layout/disclaimer";
import { MaskedId } from "@/components/profile/masked-id";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { registrationAtSlot } from "@/lib/admin/validity";
import { requireReviewer } from "@/lib/auth-guards";
import { getBookingForReview, getPilotHistory } from "@/lib/data/review";
import { listActiveZones } from "@/lib/data/zone";
import { formatAltitude, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { toLocale } from "@/lib/locale";
import { isOwnSubmission } from "@/lib/workflow";
import type { Metadata } from "next";
import { privatePageTitle } from "@/lib/site/metadata";

/**
 * `/admin/bookings/[id]` — one flight request, and the decision.
 *
 * **The airspace decision is re-run, at the top, before anything else.** A
 * booking is a request about the future and the future moves: a closure
 * published since the request, or a registration that has lapsed since, changes
 * the answer. The stored `decisionSnapshot` says what was true when the pilot
 * asked, and a reviewer deciding from it would authorise a flight against
 * expired facts. So this page evaluates again and shows what it got — and
 * `approveBooking` evaluates a third time inside the transaction that writes
 * the approval, which is the one that counts.
 *
 * **Registration validity is stated against the slot, not against today.** A
 * registration expiring the morning after the request still reads as valid in
 * any list of aircraft; `registrationAtSlot` asks the question the flight
 * actually poses, with the engine's own boundaries.
 *
 * `notFound()` for a booking that does not exist, and the `(admin)` layout's
 * `requireReviewer` for anyone who is not staff — both 404, both saying nothing
 * about what is behind them. The guard is repeated here because a page is cheap
 * to guard twice and a layout is not a boundary a refactor is obliged to keep.
 *
 * **The pilot's own controls are absent.** Check-in and pilot-cancel belong to
 * `/bookings/[id]`; a reviewer must never be handed the owner's actions over a
 * flight that is not theirs. What is here instead is the authority's
 * cancellation, which is a different act with a different audit action.
 */
export default async function AdminBookingReviewPage({
  params,
}: PageProps<"/[locale]/admin/bookings/[id]">) {
  const locale = toLocale(await localeParam());
  const session = await requireReviewer();
  const t = await getTranslations("review");
  const tBookings = await getTranslations("bookings");
  const tBooking = await getTranslations("booking");

  const { id } = await params;
  // One instant for the page: the re-run's clock and the badges' clock are the
  // same `now`, so nothing on screen can disagree with anything else on it.
  const now = new Date();
  const detail = await getBookingForReview(session, id, now);
  if (!detail) notFound();

  const {
    booking,
    zone,
    drone,
    remoteId,
    profile,
    city,
    account,
    occupancy,
    trail,
    decision,
  } = detail;

  const [history, zones] = await Promise.all([
    getPilotHistory(session, booking.pilotUserId, undefined, now),
    listActiveZones(session),
  ]);

  const registration = registrationAtSlot(
    drone?.registrationExpiresAt ?? null,
    booking.slotStart,
    booking.slotEnd,
  );
  const registrationProblem = registration !== "valid";
  /**
   * Four eyes — F22c. It covers the authority cancellation as well as the
   * decision, and for a reason worth stating: an authority cancel has no
   * lead-time limit, so a reviewer cancelling their own flight would be walking
   * round `pilotMayCancel`'s two-hour cutoff with a power granted for somebody
   * else's emergency. Their own booking is cancelled with the pilot control.
   */
  const own = isOwnSubmission(session.user.id, booking.pilotUserId);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <Link
          href="/admin/bookings"
          className="text-muted-foreground text-sm underline"
        >
          {t("backToBookings")}
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">
            {zone
              ? locale === "ar"
                ? zone.nameAr
                : zone.nameEn
              : tBookings("title")}
          </h1>
          <p className="text-muted-foreground">
            <SlotTime
              start={booking.slotStart}
              end={booking.slotEnd}
              locale={locale}
            />
          </p>
          <p className="text-muted-foreground text-sm">
            {t("requestedAt", { at: formatDateTime(booking.createdAt, locale) })}
          </p>
        </div>
        <BookingStatusBadge status={booking.status} />
      </header>

      {/*
        The re-run above the decision, deliberately in that order: the answer a
        reviewer is being asked to act on has to be on screen before the button
        that acts on it.
      */}
      <AirspaceRecheck decision={decision} locale={locale} />

      {/* Who else has this open right now. Advisory — see the component. */}
      <ReviewPresence
        entityType="booking"
        entityId={booking.id}
        locale={locale}
      />

      {(booking.status === "pending" || booking.status === "approved") && own ? (
        <OwnSubmissionNotice />
      ) : booking.status === "pending" || booking.status === "approved" ? (
        <BookingDecisionPanel
          bookingId={booking.id}
          status={booking.status}
          locale={locale}
        />
      ) : (
        <div className="rounded-lg border p-4">
          <p className="text-sm">{t("bookingAlreadyDecided")}</p>
          {/*
            Verbatim, both of them. A rejection and an authority cancellation
            are decisions somebody made in words, and the record has to hold the
            words the pilot received.
          */}
          {booking.rejectionReason ? (
            <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">
              {booking.rejectionReason}
            </p>
          ) : null}
          {booking.cancellationReason ? (
            <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">
              {booking.cancellationReason}
            </p>
          ) : null}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">{t("mapHeading")}</h2>
          {zone ? (
            <BookingZoneMap zone={zone} context={zones} locale={locale} />
          ) : null}
          {/* Every map surface carries it — the zones are authored, not GACA's. */}
          <Disclaimer locale={locale} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">{t("aircraftHeading")}</h2>
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            {/*
              The Remote ID first and largest: the flight binds to the identity
              an inspector scans, not to the airframe.
            */}
            {remoteId ? (
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">
                  {tBookings("remoteId")}
                </span>
                <span dir="ltr" className="text-start font-mono text-xl">
                  {remoteId.code}
                </span>
              </div>
            ) : null}

            <dl className="grid gap-3 sm:grid-cols-2">
              <Row label={t("colAircraft")} value={drone?.nickname ?? null} />
              <Row
                label={tBooking("plannedAltitude")}
                value={
                  booking.plannedAltitudeM === null
                    ? null
                    : formatAltitude(booking.plannedAltitudeM, locale)
                }
                ltr
              />
              <Row
                label={tBooking("purpose")}
                value={
                  booking.purpose
                    ? tBooking(`purposes.${booking.purpose}` as never)
                    : null
                }
              />
              {booking.purposeNote ? (
                <Row
                  label={tBooking("purposeNote")}
                  value={booking.purposeNote}
                />
              ) : null}
            </dl>

            {/*
              **Validity at the slot, not validity today.** A registration that
              lapses between the request and the flight looks perfectly valid in
              any list of aircraft; the flight is what the question is about.
              Flagged prominently when it is a problem, because the engine will
              refuse the approval on exactly this and the reviewer should know
              why before pressing the button.
            */}
            <div
              className={`flex flex-col gap-1 rounded-lg border p-3 ${
                registrationProblem ? "border-destructive" : ""
              }`}
            >
              {drone?.registrationExpiresAt ? (
                <span className="text-sm">
                  {t("registrationValidUntil", {
                    at: formatDate(drone.registrationExpiresAt, locale),
                  })}
                </span>
              ) : null}
              <span
                className={
                  registrationProblem
                    ? "text-sm font-medium"
                    : "text-muted-foreground text-sm"
                }
              >
                {t(`registrationAtSlot.${registration}`)}
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("pilotHeading")}</h2>
        <div className="flex flex-col gap-4 rounded-lg border p-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Row label={t("pilotName")} value={profile?.fullNameAr ?? null} />
            <Row
              label={t("pilotNameEn")}
              value={profile?.fullNameEn ?? null}
              ltr
            />
            <Row
              label={t("pilotMobile")}
              value={profile?.mobileE164 ?? null}
              ltr
            />
            <Row
              label={t("pilotCity")}
              value={(locale === "ar" ? city?.nameAr : city?.nameEn) ?? null}
            />
            <Row label={t("pilotEmail")} value={account?.email ?? null} ltr />
            <Row
              label={t("accountAge")}
              value={
                account?.createdAt ? formatDate(account.createdAt, locale) : null
              }
            />
          </dl>

          {profile ? (
            <div className="flex flex-col gap-3">
              <MaskedId
                number={profile.idDocumentNumber}
                documentType={profile.idDocumentType}
              />
              <div className="flex flex-wrap items-center gap-3">
                {profile.verifiedAt ? (
                  <Badge>
                    {t("identityVerifiedOn", {
                      at: formatDate(profile.verifiedAt, locale),
                    })}
                  </Badge>
                ) : (
                  <Badge variant="secondary">{t("identityUnverified")}</Badge>
                )}
                <PilotIdentityReveal
                  userId={booking.pilotUserId}
                  locale={locale}
                />
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t("noProfile")}</p>
          )}
        </div>

        {history ? (
          <PilotHistoryPanel history={history} locale={locale} />
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("occupancyHeading")}</h2>
        <p className="text-muted-foreground text-sm">{t("occupancyIntro")}</p>
        {occupancy.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("occupancyEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {occupancy.map((seat) => (
              <li
                key={seat.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"
              >
                <span className="text-muted-foreground text-xs">
                  {/* Pre-formatted — a bare number in an ICU message renders
                      Arabic-Indic digits (thread 22). Seats are zero-based in
                      the database and one-based to a human. */}
                  {t("occupancySeat", {
                    seat: formatNumber(seat.seatIndex + 1, locale),
                  })}
                </span>
                {seat.remoteIdCode ? (
                  <span dir="ltr" className="font-mono">
                    {seat.remoteIdCode}
                  </span>
                ) : null}
                <BookingStatusBadge status={seat.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("trailHeading")}</h2>
        <AuditTrail events={trail} locale={locale} />
      </section>
    </main>
  );
}

function Row({
  label,
  value,
  ltr = false,
}: {
  label: string;
  value: string | null;
  ltr?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      {/*
        `dir="ltr"` only on a Latin run with no formatted Arabic date in it — a
        mobile number, an email, an altitude. Never on an element containing a
        date: the month is a strong RTL run and the numerals around it are
        neutral, so forcing the container resolves the line into an order nobody
        wrote, and `innerText` stays correct so no text assertion catches it.
      */}
      <dd dir={ltr ? "ltr" : undefined} className="text-sm">
        {value ?? "—"}
      </dd>
    </div>
  );
}

/**
 * Its own tab title, from the same string this page renders as its heading.
 * `robots` comes from the route group's layout — see `PRIVATE_ROBOTS`.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/bookings/[id]">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "review.tabBookings");
}
