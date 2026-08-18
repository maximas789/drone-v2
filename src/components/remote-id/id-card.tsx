import { useTranslations } from "next-intl";
import { CopyCode } from "@/components/remote-id/copy-code";
import { QrDisplay } from "@/components/remote-id/qr-display";
import { StatusBadge } from "@/components/remote-id/status-badge";
import { formatDate, formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import type { RegistrationStatus } from "@/lib/remote-id/redact";
import { serialRequiredFor, type BuildType } from "@/lib/validation/drone";

/**
 * The card a pilot holds up to an inspector.
 *
 * **Designed for one glance at arm's length, in daylight, on a phone.** The
 * code is the largest thing on it and the QR is the second largest; everything
 * else is there to confirm that the aircraft in front of the inspector is the
 * one the code describes.
 *
 * **This renders the drone's own record, not a redacted view.** The viewer is
 * the owner by definition — the page 404s for anybody else — so there is no
 * masking here and no `redactRemoteId` call. The redacted projection is the
 * *public* page's, at `/rid/[code]`, and the card links to it through the
 * privacy explainer rather than trying to preview it.
 *
 * Dates go through `format.ts`, which forces Gregorian and Latin numerals in
 * both locales; the weight goes through `formatNumber` before ICU sees it
 * (thread 22).
 */
export function IdCard({
  droneId,
  code,
  registrationStatus,
  issuedAt,
  validUntil,
  qrUrl,
  ownerName,
  drone,
  locale,
}: {
  droneId: string;
  code: string;
  registrationStatus: RegistrationStatus;
  issuedAt: Date;
  validUntil: Date | null;
  qrUrl: string | null;
  ownerName: string | null;
  drone: {
    nickname: string;
    manufacturer: string | null;
    model: string | null;
    buildType: string;
    weightClass: string;
    weightGrams: number;
    serialNumber: string | null;
  };
  locale: Locale;
}) {
  const t = useTranslations("remoteId.card");
  const tDrones = useTranslations("drones");

  const facts: Array<[string, string]> = [];
  if (drone.manufacturer) facts.push([tDrones("manufacturer"), drone.manufacturer]);
  if (drone.model) facts.push([tDrones("model"), drone.model]);
  facts.push([tDrones("buildType"), tDrones(`buildTypes.${drone.buildType}`)]);
  facts.push([
    tDrones("weightClass"),
    `${tDrones(`weightClasses.${drone.weightClass}`)} · ${tDrones("weightValue", {
      weight: formatNumber(drone.weightGrams, locale),
    })}`,
  ]);
  /**
   * Absent, not empty, for a self-built or FPV airframe — the same rule as the
   * wizard and the spec table. A row reading "Serial number: —" on the card
   * that exists *because* the aircraft has no serial would be the product
   * arguing against itself.
   */
  if (serialRequiredFor(drone.buildType as BuildType) && drone.serialNumber) {
    facts.push([tDrones("serialNumber"), drone.serialNumber]);
  }

  return (
    <article className="bg-card flex flex-col items-center gap-5 rounded-xl border p-5 shadow-sm sm:p-6">
      <header className="flex w-full flex-col items-center gap-2">
        <p className="text-muted-foreground text-xs">{t("issuer")}</p>
        {/**
         * `dir="auto"`, like every pilot-authored string in this app. An
         * Arabic nickname on the English card — or the reverse — is the one
         * run of text on the page whose direction is not the page's, and
         * inherited direction puts its punctuation at the wrong end. F18b
         * found this on a reviewer's quoted rejection reason; a nickname, a
         * manufacturer and an owner's name are the same case.
         */}
        <h1 dir="auto" className="text-center text-lg font-semibold">
          {drone.nickname}
        </h1>
        <StatusBadge status={registrationStatus} />
      </header>

      <CopyCode code={code} />

      <QrDisplay droneId={droneId} code={code} qrUrl={qrUrl} locale={locale} />

      <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-3 border-t pt-4">
        <Fact label={t("issuedAt")} value={formatDate(issuedAt, locale)} />
        {/**
         * No "valid until" when there is no date. F18b found the mirror of this
         * on the list card: `registrationExpiresAt` outlives the registration
         * it belonged to, and printing it beside a suspended Remote ID told the
         * pilot their revoked registration was good for another three years.
         */}
        {validUntil ? (
          <Fact label={t("validUntil")} value={formatDate(validUntil, locale)} />
        ) : null}
        {facts.map(([label, value]) => (
          <Fact key={label} label={label} value={value} />
        ))}
        {ownerName ? <Fact label={t("owner")} value={ownerName} /> : null}
      </dl>

      {/**
       * The card is not a shareable link and says so. Somebody who is handed
       * this URL gets a 404, and a pilot who assumes otherwise might send it to
       * a buyer along with their own name on it.
       */}
      <p className="text-muted-foreground text-center text-xs">{t("notShareable")}</p>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd dir="auto" className="text-start text-sm font-medium">
        {value}
      </dd>
    </div>
  );
}
