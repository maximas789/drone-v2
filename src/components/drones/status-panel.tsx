import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button-link";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { DeleteDroneButton, DroneAction } from "./drone-actions";
import { RejectionNotice } from "./rejection-notice";

/**
 * What this registration's status **means**, and the one thing to do about it.
 *
 * Six statuses, six panels, and each one answers the same two questions: where
 * is my registration, and what happens next. A status badge alone answers
 * neither — `expired` is a word, "renew it and you keep the same Remote ID" is
 * an instruction.
 *
 * **Every panel names exactly one primary action, or says plainly that there
 * isn't one.** `pending` and `revoked` are the two with nothing for the pilot to
 * do, and both say so rather than leaving a panel that looks like it is missing
 * a button.
 *
 * The Remote ID code is rendered as **text** here. F19 owns the card, the QR,
 * tap-to-copy and the print view; two surfaces rendering a QR is the drift
 * F11's single-projection rule exists to prevent.
 */
export function DroneStatusPanel({
  drone,
  remoteIdCode,
  photoCount,
  locale,
}: {
  drone: {
    id: string;
    nickname: string;
    status: string;
    submittedAt: Date | null;
    decidedAt: Date | null;
    rejectionReason: string | null;
    rejectionCount: number;
    registrationExpiresAt: Date | null;
    revokedAt: Date | null;
    revocationReason: string | null;
  };
  remoteIdCode: string | null;
  /** Decides which control on a draft reads as the next step. */
  photoCount: number;
  locale: Locale;
}) {
  const t = useTranslations("drones");

  switch (drone.status) {
    /**
     * Nothing has been claimed yet. The wizard is where the remaining panes
     * live, so "continue" goes back to it with the draft id — building a second
     * five-pane flow here would be two forms that can disagree about what a
     * complete registration is.
     */
    case "draft":
      return (
        <Panel title={t("draftTitle")} body={t("draftBody")}>
          <div className="flex flex-wrap items-start gap-3">
            {/**
             * **Which of these is the primary action depends on the draft.**
             * With no photograph, submitting is a button that can only be
             * refused, so Continue leads; with one, the pilot is finished and
             * Submit leads. The submission gate still runs either way — this
             * only decides which control looks like the next step.
             */}
            <ButtonLink
              variant={photoCount > 0 ? "outline" : "default"}
              href={`/drones/new?draft=${drone.id}`}
            >
              {t("continueDraft")}
            </ButtonLink>
            <DroneAction
              droneId={drone.id}
              kind="submit"
              locale={locale}
              variant={photoCount > 0 ? "default" : "outline"}
            />
            <DeleteDroneButton
              droneId={drone.id}
              nickname={drone.nickname}
              locale={locale}
            />
          </div>
        </Panel>
      );

    /**
     * **Read-only, and it says why.** A pilot who cannot find the Edit button
     * assumes the app lost it; a pilot told the request is in front of a
     * reviewer knows what changed and when it will change back.
     */
    case "pending":
      return (
        <Panel
          title={
            drone.submittedAt
              ? t("pendingSince", { date: formatDate(drone.submittedAt, locale) })
              : t("statusPending")
          }
          body={t("pendingBody")}
        >
          <p className="text-muted-foreground text-sm">{t("pendingNoAction")}</p>
        </Panel>
      );

    /**
     * The aircraft has an identity. The code, its validity and the page a
     * scanner reaches — nothing here promises a flight can be booked, because
     * F21 owns booking and does not exist yet; a "Book a flight" button whose
     * only destination is a 404 is the affordance F18a already refused to ship
     * on the list card.
     */
    case "approved":
      return (
        <Panel title={t("approvedTitle")} body={t("approvedBody")}>
          <div className="flex flex-col gap-3">
            {remoteIdCode ? (
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">
                  {t("remoteIdLabel")}
                </span>
                {/* Latin in both locales: a code is a code, not text to localise. */}
                <span dir="ltr" className="text-start font-mono text-lg">
                  {remoteIdCode}
                </span>
              </div>
            ) : null}

            {drone.registrationExpiresAt ? (
              <p className="text-sm">
                {t("validUntil", {
                  date: formatDate(drone.registrationExpiresAt, locale),
                })}
              </p>
            ) : null}

            {remoteIdCode ? (
              <div className="flex flex-col items-start gap-3">
                {/**
                 * The card leads, and the public record follows it. F18 showed
                 * the code as text and linked only to `/rid/{code}`, because
                 * F19 owned the card and it did not exist yet; it does now, and
                 * it is where the QR, the printable sticker and the privacy
                 * explainer live.
                 */}
                <ButtonLink href={`/drones/${drone.id}/remote-id`}>
                  {t("viewCard")}
                </ButtonLink>
                <div className="flex flex-col items-start gap-2">
                  <ButtonLink variant="outline" href={`/rid/${remoteIdCode}`}>
                    {t("viewPublicRecord")}
                  </ButtonLink>
                  <p className="text-muted-foreground text-xs">
                    {t("viewPublicRecordHint")}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </Panel>
      );

    /** The reviewer's own words, and the two things that answer them. */
    case "rejected":
      return (
        <RejectionNotice
          reason={drone.rejectionReason}
          decidedAt={drone.decidedAt}
          rejectionCount={drone.rejectionCount}
          locale={locale}
        >
          <div className="flex flex-wrap items-start gap-3">
            <ButtonLink href={`/drones/${drone.id}/edit`}>
              {t("editDetails")}
            </ButtonLink>
            <DroneAction
              droneId={drone.id}
              kind="resubmit"
              locale={locale}
              variant="outline"
            />
          </div>
        </RejectionNotice>
      );

    /**
     * **Renewal, not re-registration** — and the panel says so before the pilot
     * presses anything. The commonest fear at this screen is that renewing
     * mints a new code and strands every QR sticker already on the airframe;
     * `renewDrone` does not touch the code, so saying it here is a promise the
     * code keeps.
     */
    case "expired":
      return (
        <Panel title={t("expiredTitle")} body={t("expiredBody")}>
          <div className="flex flex-col gap-3">
            {remoteIdCode ? (
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">
                  {t("remoteIdLabel")}
                </span>
                <span dir="ltr" className="text-start font-mono text-sm">
                  {remoteIdCode}
                </span>
              </div>
            ) : null}
            <p className="text-sm">{t("renewKeepsCode")}</p>
            <div className="flex items-start">
              <DroneAction droneId={drone.id} kind="renew" locale={locale} />
            </div>
          </div>
        </Panel>
      );

    /**
     * The one status with no path back through this page. Reinstatement is an
     * admin decision (`reinstateDroneAction` is admin-only), so the panel names
     * that rather than offering a button that would always be refused.
     */
    case "revoked":
      return (
        <section
          role="alert"
          className="border-destructive flex flex-col gap-3 rounded-lg border p-4"
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-destructive text-sm font-medium">
              {t("revokedTitle")}
            </h2>
            {drone.revokedAt ? (
              <p className="text-muted-foreground text-xs">
                {t("revokedOn", { date: formatDate(drone.revokedAt, locale) })}
              </p>
            ) : null}
          </div>

          {/**
           * Verbatim, and `dir="auto"` for the same reason the rejection
           * quote carries it: an admin's sentence is in the admin's language,
           * not the reader's, and inheriting the page's direction mis-sets the
           * punctuation of the other one. See `rejection-notice.tsx`.
           */}
          {drone.revocationReason ? (
            <blockquote
              dir="auto"
              className="border-s-2 ps-3 text-start text-sm whitespace-pre-wrap"
            >
              {drone.revocationReason}
            </blockquote>
          ) : null}

          <p className="text-sm">{t("revokedBody")}</p>
          <p className="text-muted-foreground text-sm">{t("revokedNoAction")}</p>
        </section>
      );

    default:
      // An unrecognised status renders the code rather than an empty panel: a
      // screen that silently shows nothing hides a row nobody understands.
      return (
        <Panel title={drone.status} body={t("statusUnknown")}>
          {null}
        </Panel>
      );
  }
}

function Panel({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-muted-foreground text-sm">{body}</p>
      </div>
      {children}
    </section>
  );
}
