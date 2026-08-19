import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { AuditTrail } from "@/components/admin/audit-trail";
import { DecisionPanel } from "@/components/admin/decision-panel";
import { ModuleReview } from "@/components/admin/module-review";
import { OwnSubmissionNotice } from "@/components/admin/own-submission-notice";
import { PhotoLightbox } from "@/components/admin/photo-lightbox";
import { PilotHistoryPanel } from "@/components/admin/pilot-history";
import { PilotIdentityReveal } from "@/components/admin/pilot-identity-reveal";
import { ReviewPresence } from "@/components/admin/review-presence";
import { DroneSpecTable } from "@/components/drones/spec-table";
import { DroneStatusBadge } from "@/components/drones/status-badge";
import { MaskedId } from "@/components/profile/masked-id";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { requireReviewer } from "@/lib/auth-guards";
import { getDroneForReview, getPilotHistory } from "@/lib/data/review";
import { formatDate, formatDateTime } from "@/lib/format";
import { toLocale } from "@/lib/locale";
import { fileUrlFor } from "@/lib/storage";
import { serialRequiredFor, type BuildType } from "@/lib/validation/drone";
import { isOwnSubmission } from "@/lib/workflow";

/**
 * `/admin/drones/[id]` — one submission, and the decision.
 *
 * **Everything on one screen, no tabs.** A reviewer checking a build against
 * its description needs the photographs and the specifications visible at the
 * same time; putting either behind a tab makes the comparison a memory test.
 *
 * **`getDroneForReview`, not `getMyDroneDetail`.** The latter is the pilot's
 * own surface and offers Submit, Edit, Renew and Delete — a reviewer must never
 * be handed the owner's controls over a registration that is not theirs. This
 * reader asks the staff question instead, and returns a drone in **any**
 * status: a reviewer following a stale queue link to an already-decided
 * submission must see what happened to it, not a 404 that reads as a deleted
 * row.
 *
 * `notFound()` for a drone that does not exist, and the `(admin)` layout's
 * `requireReviewer` for anyone who is not staff — both 404, both saying nothing
 * about what is behind them. The guard is repeated here rather than trusted
 * from the layout because a page is cheap to guard twice and a layout is not a
 * boundary a future refactor is obliged to keep.
 *
 * **Revoke and reinstate are absent.** They are admin-only actions on an
 * *approved* registration, and they are not decisions this screen exists for;
 * `revokeDroneAction` and `reinstateDroneAction` refuse a non-admin
 * independently. F22c owns wherever they belong.
 */
export default async function AdminDroneReviewPage({
  params,
}: PageProps<"/[locale]/admin/drones/[id]">) {
  const locale = toLocale(await localeParam());
  const session = await requireReviewer();
  const t = await getTranslations("review");
  const tDrones = await getTranslations("drones");

  const { id } = await params;
  const detail = await getDroneForReview(session, id);
  if (!detail) notFound();

  const { drone, photos, remoteId, declarations, profile, city, account, trail } =
    detail;

  const history = await getPilotHistory(session, drone.ownerUserId, drone.id);
  const needsSerial = serialRequiredFor(drone.buildType as BuildType);
  /**
   * **Four eyes.** F22c's rule, and the reason F22a deferred it: every pending
   * drone in the dev database belongs to the only account, which is also the
   * only reviewer, so shipping this in F22a would have made every decision in
   * the feature untestable. The controls are replaced rather than disabled, and
   * `approveDrone` refuses independently before the transition.
   */
  const own = isOwnSubmission(session.user.id, drone.ownerUserId);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <Link href="/admin" className="text-muted-foreground text-sm underline">
          {t("backToQueue")}
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{drone.nickname}</h1>
          {drone.submittedAt ? (
            <p className="text-muted-foreground text-sm">
              {t("submittedAt", {
                at: formatDateTime(drone.submittedAt, locale),
              })}
            </p>
          ) : null}
        </div>
        <DroneStatusBadge status={drone.status} />
      </header>

      {/* Who else has this open right now. Advisory — see the component. */}
      <ReviewPresence entityType="drone" entityId={drone.id} locale={locale} />

      {/*
        The decision, at the top. A reviewer who has already read the page and
        come back to act should not have to scroll past everything they have
        finished with to reach the two buttons.

        It appears only for a `pending` submission — an approved or rejected row
        is a record, and "Approve" on one is a control whose only outcome is
        `invalid_transition` — and only when the submission is somebody else's.
      */}
      {drone.status === "pending" && own ? (
        <OwnSubmissionNotice />
      ) : drone.status === "pending" ? (
        <DecisionPanel droneId={drone.id} locale={locale} />
      ) : (
        <div className="rounded-lg border p-4">
          <p className="text-sm">{t("alreadyDecided")}</p>
          {drone.rejectionReason ? (
            <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">
              {drone.rejectionReason}
            </p>
          ) : null}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">{t("photosHeading")}</h2>
          <PhotoLightbox photos={photos} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">{tDrones("detailsHeading")}</h2>
          <DroneSpecTable drone={drone} locale={locale} />

          {/*
            **The serial number, stated rather than omitted.**

            `DroneSpecTable` leaves the row out entirely for a self-built or FPV
            airframe, which is right on the pilot's own screen — nothing is
            missing, so nothing should read as missing. On a *reviewer's* screen
            silence is the wrong answer: the person deciding is looking for the
            serial, and an absent row invites "incomplete submission". So this
            surface says the thing out loud. It is a deliberate design, not a
            gap, and the sentence has to make that unmistakable.
          */}
          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-medium">{tDrones("serialNumber")}</h3>
            {needsSerial && drone.serialNumber ? (
              <p dir="ltr" className="mt-1 font-mono text-sm">
                {drone.serialNumber}
              </p>
            ) : (
              <>
                <Badge variant="outline" className="mt-2 whitespace-normal">
                  {t("noSerialBadge")}
                </Badge>
                <p className="text-muted-foreground mt-2 text-sm">
                  {t("noSerialExplainer")}
                </p>
              </>
            )}
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

          {/*
            The mask, and the reveal beside it. `MaskedId` is the only
            projection of a document number in the codebase — it does not mask,
            it *renders* the mask — so there is no branch anywhere that shows a
            whole number. The single path to one is the action, which writes the
            audit event before it answers.
          */}
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
                  userId={drone.ownerUserId}
                  locale={locale}
                />
              </div>
              {/*
                Verifying an identity is F22c's control, on the pilots screen.
                Saying so is better than a disabled button that looks broken —
                and far better than putting the action here where it has no
                pilot-level context around it.
              */}
              {profile.verifiedAt ? null : (
                <p className="text-muted-foreground text-xs">
                  {t("identityVerificationElsewhere")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("noProfile")}
            </p>
          )}
        </div>

        {history ? <PilotHistoryPanel history={history} locale={locale} /> : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("modulesHeading")}</h2>
        {remoteId ? (
          <p className="text-muted-foreground text-sm">
            {t("remoteIdIssued", { code: remoteId.code })}
          </p>
        ) : (
          /*
            A first registration has no Remote ID yet — it is issued at
            approval — so there is nothing for a module to hang off. Said
            plainly rather than shown as an empty list, which would read as
            "this pilot declared nothing".
          */
          <p className="text-muted-foreground text-sm">
            {t("noRemoteIdYet")}
          </p>
        )}
        {/*
          The module list is rendered only when there *is* a Remote ID to hang
          one off. Without that guard a pending first registration showed the
          "no Remote ID yet" sentence and then `ModuleReview`'s own "no modules
          declared" empty state directly beneath it — two sentences saying the
          same thing, the second of which reads as though the pilot omitted
          something. Found by opening the page.
        */}
        {remoteId ? (
        <ModuleReview
          decidable={!own}
          declarations={declarations.map((row) => ({
            id: row.id,
            kind: row.kind,
            manufacturer: row.manufacturer,
            moduleSerial: row.moduleSerial,
            docReference: row.docReference,
            docUrl: row.docPath ? fileUrlFor(row.docPath) : null,
            validFrom: row.validFrom,
            validUntil: row.validUntil,
            verifiedAt: row.verifiedAt,
            rejectedAt: row.rejectedAt,
            rejectionReason: row.rejectionReason,
            supersededAt: row.supersededAt,
            createdAt: row.createdAt,
          }))}
          locale={locale}
        />
        ) : null}
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
      {/*
        `dir="ltr"` only on a Latin run with no formatted date in it — a mobile
        number or an email. Never on an element containing an Arabic date: the
        month is a strong RTL run and the numerals around it are neutral, so
        forcing the container resolves the line into an order nobody wrote, and
        `innerText` stays correct so no text assertion catches it (F21b).
      */}
      <dd dir={ltr ? "ltr" : undefined} className="text-sm">
        {value ?? "—"}
      </dd>
    </div>
  );
}
