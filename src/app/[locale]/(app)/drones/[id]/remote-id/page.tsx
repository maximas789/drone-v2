import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { DeclaredModules } from "@/components/remote-id/declared-modules";
import { IdCard } from "@/components/remote-id/id-card";
import { PrivacyExplainer } from "@/components/remote-id/privacy-explainer";
import { ButtonLink } from "@/components/ui/button-link";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth-guards";
import { getMyDroneDetail } from "@/lib/data/drone";
import { getMyProfile } from "@/lib/data/pilot";
import { listDeclarations } from "@/lib/data/remote-id";
import { toLocale } from "@/lib/locale";
import { registrationStatusOf } from "@/lib/remote-id/redact";
import { fileUrlFor } from "@/lib/storage";

/**
 * `/drones/[id]/remote-id` — the digital ID card.
 *
 * **Owner-only, through `getMyDroneDetail`.** Not `getDroneById`, which also
 * answers for a reviewer: this page carries the owner's name and their
 * aircraft's serial, and a reviewer who wants that has F11's `/rid/[code]` with
 * its audited Reveal. So a card that is not yours 404s, whoever you are, and
 * "not yours" and "does not exist" answer identically.
 *
 * **Unreachable for a drone that is not approved**, for the same reason its QR
 * would be meaningless: the code is issued on approval, the QR resolves to a
 * public record, and there is no record until there is a decision. A draft with
 * a card would be a registration a pilot could show an inspector before anybody
 * granted it.
 */
export default async function RemoteIdCardPage({
  params,
}: PageProps<"/[locale]/drones/[id]/remote-id">) {
  const locale = toLocale(await localeParam());
  const session = await requireUser(locale);
  const t = await getTranslations("remoteId.card");
  const tDrones = await getTranslations("drones");

  const { id } = await params;
  const detail = await getMyDroneDetail(session, id);
  if (!detail) notFound();

  const { drone, remoteId } = detail;
  if (drone.status !== "approved" || !remoteId) notFound();

  const [profile, declarations] = await Promise.all([
    getMyProfile(session),
    listDeclarations(session, remoteId.id),
  ]);

  /**
   * The same derivation the public page uses, not a second reading of the two
   * status columns. An expired registration whose nightly sweep has not run yet
   * must read `expired` on the pilot's own card as well — the clock is what
   * makes a registration lapse, and a card that disagrees with the scan page is
   * a card an inspector will not trust.
   */
  const registrationStatus = registrationStatusOf({
    remoteIdStatus: remoteId.status,
    droneStatus: drone.status,
    validUntil: drone.registrationExpiresAt,
    // Never null here: this is the owner's own card, reached through a guard
    // that already established they own it.
    ownerUserId: drone.ownerUserId,
  });

  /**
   * Through `/api/files/…`, which re-checks ownership on every request — never
   * a storage URL, which would resolve for anyone it reached and keep doing so
   * after the row is gone.
   */
  const qrUrl = remoteId.qrPathname ? fileUrlFor(remoteId.qrPathname) : null;

  const ownerName =
    (locale === "ar" ? profile?.fullNameAr : profile?.fullNameEn) ??
    profile?.fullNameAr ??
    null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <Link
          href={`/drones/${drone.id}`}
          className="text-muted-foreground text-sm underline"
        >
          {tDrones("backToDrone")}
        </Link>
      </div>

      <IdCard
        droneId={drone.id}
        code={remoteId.code}
        registrationStatus={registrationStatus}
        issuedAt={remoteId.issuedAt}
        validUntil={drone.registrationExpiresAt}
        qrUrl={qrUrl}
        ownerName={ownerName}
        drone={drone}
        locale={locale}
      />

      <DeclaredModules
        droneId={drone.id}
        declarations={declarations}
        broadcastCapable={remoteId.broadcastCapable}
        networkCapable={remoteId.networkCapable}
        locale={locale}
      />

      {/**
       * The print view, and the only route to a printable artefact. It is a
       * link rather than a `window.print()` on this page, because what gets
       * printed is a wallet card and a sticker sheet — not this screen.
       */}
      <div className="flex flex-col items-start gap-2">
        <ButtonLink variant="outline" href={`/drones/${drone.id}/remote-id/print`}>
          {t("openPrintView")}
        </ButtonLink>
        <p className="text-muted-foreground text-xs">{t("openPrintViewHint")}</p>
      </div>

      <PrivacyExplainer code={remoteId.code} />

      {/**
       * The deploy trap, said where the pilot is about to act on it. The QR
       * encodes `APP_URL` **at render time**: if that was wrong when this image
       * was made, every sticker printed from it is dead, and nothing else in
       * the app would say so. F29's system page checks the same thing from the
       * other end.
       */}
      <p className="text-muted-foreground text-xs">{t("printWarning")}</p>
    </main>
  );
}
