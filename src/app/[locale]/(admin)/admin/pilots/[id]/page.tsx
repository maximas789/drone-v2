import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { AuditTrail } from "@/components/admin/audit-trail";
import { IdentityDecision } from "@/components/admin/identity-decision";
import { OwnSubmissionNotice } from "@/components/admin/own-submission-notice";
import { PilotHistoryPanel } from "@/components/admin/pilot-history";
import { PilotIdentityReveal } from "@/components/admin/pilot-identity-reveal";
import { ReviewPresence } from "@/components/admin/review-presence";
import { SlotTime } from "@/components/booking/slot-time";
import { BookingStatusBadge } from "@/components/booking/status-badge";
import { DroneStatusBadge } from "@/components/drones/status-badge";
import { MaskedId } from "@/components/profile/masked-id";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { requireReviewer } from "@/lib/auth-guards";
import { getPilotForReview } from "@/lib/data/review";
import { formatDate } from "@/lib/format";
import { toLocale } from "@/lib/locale";
import { isOwnSubmission } from "@/lib/workflow";

/**
 * `/admin/pilots/[id]` — the person, and the one decision that is about them
 * rather than about something they submitted.
 *
 * **Identity verification is the check the whole product rests on**, and the
 * honesty rules make it a human one: no SMS, no document scanner, no score.
 * A reviewer reveals the document through the audited control, reads it, and
 * records what they found. Nothing on this page may suggest otherwise.
 *
 * **Four eyes applies here most of all.** A reviewer vouching for their own
 * identity document is self-certification of the check that gates every
 * booking, so the controls are replaced — not merely disabled — by
 * `OwnSubmissionNotice`, and `verifyIdentity` refuses independently before any
 * write.
 *
 * The aircraft and bookings lists are **read-only here**. Deciding a
 * registration happens on its own screen with the photographs in front of you;
 * a row on a pilot page that could approve one would be a decision made without
 * the evidence.
 */
export default async function AdminPilotDetailPage({
  params,
}: PageProps<"/[locale]/admin/pilots/[id]">) {
  const locale = toLocale(await localeParam());
  const session = await requireReviewer();
  const t = await getTranslations("review");
  const tDrones = await getTranslations("drones");

  const { id } = await params;
  const now = new Date();
  const detail = await getPilotForReview(session, id, now);
  if (!detail) notFound();

  const { profile, city, account, drones, bookings, history, trail } = detail;
  const own = isOwnSubmission(session.user.id, profile.userId);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <Link
          href="/admin/pilots"
          className="text-muted-foreground text-sm underline"
        >
          {t("backToPilots")}
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">
            {locale === "ar" ? profile.fullNameAr : profile.fullNameEn}
          </h1>
          <p className="text-muted-foreground text-sm" dir="ltr">
            {locale === "ar" ? profile.fullNameEn : profile.fullNameAr}
          </p>
        </div>
        {profile.verifiedAt ? (
          <Badge>
            {t("identityVerifiedOn", {
              at: formatDate(profile.verifiedAt, locale),
            })}
          </Badge>
        ) : profile.rejectedAt ? (
          <Badge variant="destructive">{t("identityRejectedBadge")}</Badge>
        ) : (
          <Badge variant="secondary">{t("identityUnverified")}</Badge>
        )}
      </header>

      {/* Who else is on this record right now. Advisory only — see the component. */}
      <ReviewPresence
        entityType="pilot_profile"
        entityId={profile.id}
        locale={locale}
      />

      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Row label={t("pilotMobile")} value={profile.mobileE164} ltr />
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

        {/*
          The mask, and the audited reveal beside it. `MaskedId` renders the
          mask — it is not a number with characters hidden by CSS — so no branch
          anywhere shows a whole document except the action, which writes its
          audit event before it answers.
        */}
        <div className="flex flex-col gap-3">
          <MaskedId
            number={profile.idDocumentNumber}
            documentType={profile.idDocumentType}
          />
          <PilotIdentityReveal userId={profile.userId} locale={locale} />
        </div>

        {profile.rejectedAt && profile.rejectionReason ? (
          <div className="border-destructive flex flex-col gap-1 rounded-lg border border-s-4 p-3">
            <span className="text-sm font-medium">
              {t("identityRejectedOn", {
                at: formatDate(profile.rejectedAt, locale),
              })}
            </span>
            {/* Verbatim: this is the text the pilot is reading on their own screen. */}
            <p className="text-sm whitespace-pre-wrap">
              {profile.rejectionReason}
            </p>
          </div>
        ) : null}
      </section>

      {own ? (
        <OwnSubmissionNotice />
      ) : (
        <IdentityDecision
          userId={profile.userId}
          verified={profile.verifiedAt !== null}
          locale={locale}
        />
      )}

      {history ? <PilotHistoryPanel history={history} locale={locale} /> : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("pilotDronesHeading")}</h2>
        {drones.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("pilotNoDrones")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {drones.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"
              >
                <Link
                  href={`/admin/drones/${row.id}`}
                  className="font-medium underline"
                >
                  {row.nickname}
                </Link>
                <span className="text-muted-foreground text-xs">
                  {tDrones(`buildTypes.${row.buildType}`)}
                </span>
                {row.remoteIdCode ? (
                  <span dir="ltr" className="font-mono text-xs">
                    {row.remoteIdCode}
                  </span>
                ) : null}
                <DroneStatusBadge status={row.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("pilotBookingsHeading")}</h2>
        {bookings.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("pilotNoBookings")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {bookings.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"
              >
                <Link
                  href={`/admin/bookings/${row.id}`}
                  className="font-medium underline"
                >
                  {locale === "ar" ? row.zoneNameAr : row.zoneNameEn}
                </Link>
                <span className="text-muted-foreground">
                  <SlotTime
                    start={row.slotStart}
                    end={row.slotEnd}
                    locale={locale}
                  />
                </span>
                <BookingStatusBadge status={row.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("trailHeading")}</h2>
        <p className="text-muted-foreground text-sm">{t("trailIntro")}</p>
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
      {/* `dir="ltr"` only on a Latin run with no formatted Arabic date in it. */}
      <dd dir={ltr ? "ltr" : undefined} className="text-sm">
        {value ?? "—"}
      </dd>
    </div>
  );
}
