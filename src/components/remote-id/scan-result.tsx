"use client";

import { useTranslations } from "next-intl";
import { StatusBadge, StatusBody } from "@/components/remote-id/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateRange, formatNumber } from "@/lib/format";
import { pick } from "@/lib/i18n-content";
import type { Locale } from "@/lib/locale";
import {
  isIdentified,
  type BuildType,
  type RedactedRemoteId,
  type ViewerLevel,
  type WeightClass,
} from "@/lib/remote-id/redact";

/**
 * The scan page's body, for every viewer level.
 *
 * **It renders the union, and only the union.** The owner and staff sections
 * sit behind `view.level` checks that TypeScript narrows — on the anonymous
 * branch `ownerNameAr` does not exist as a property, so a future edit that
 * tries to show it fails the build rather than the privacy model.
 *
 * A client component so the whole page is one translation surface; the record
 * it receives has already been through `redactRemoteId` on the server, so
 * nothing withheld is in the payload that reaches the browser.
 */

const BUILD_TYPE = {
  commercial: "buildTypes.commercial",
  self_built: "buildTypes.self_built",
  fpv: "buildTypes.fpv",
} as const satisfies Record<BuildType, string>;

const WEIGHT_CLASS = {
  micro: "weightClasses.micro",
  light: "weightClasses.light",
  medium: "weightClasses.medium",
  heavy: "weightClasses.heavy",
} as const satisfies Record<WeightClass, string>;

const VIEWER_LEVEL = {
  anonymous: "viewerLevels.anonymous",
  pilot: "viewerLevels.pilot",
  owner: "viewerLevels.owner",
  reviewer: "viewerLevels.reviewer",
  admin: "viewerLevels.admin",
} as const satisfies Record<ViewerLevel, string>;

export function ScanResult({
  view,
  locale,
}: {
  view: RedactedRemoteId;
  locale: Locale;
}) {
  const t = useTranslations("remoteId");
  const tDrones = useTranslations("drones");
  const tCommon = useTranslations("common");

  return (
    <div className="flex flex-col gap-6">
      <section className="border-border flex flex-col items-start gap-3 rounded-xl border p-5">
        <span className="text-muted-foreground text-sm">{t("code")}</span>
        {/*
          The code is Latin in both languages. `dir="ltr"` keeps it from being
          reordered inside the Arabic page, and `ltr:tracking-wide` applies only
          inside this element — letter-spacing would sever Arabic letter joins
          anywhere it leaked out.
        */}
        <span
          dir="ltr"
          className="font-mono text-2xl font-semibold ltr:tracking-wide sm:text-3xl"
        >
          {view.code}
        </span>

        <StatusBadge status={view.registrationStatus} />
        <StatusBody status={view.registrationStatus} />
      </section>

      <section className="border-border flex flex-col gap-2 rounded-xl border p-5">
        <h2 className="font-medium">
          {view.flightInProgress
            ? t("flightInProgress")
            : t("noFlightInProgress")}
        </h2>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Fact
            label={t("validUntil")}
            value={view.validUntil ? formatDate(view.validUntil, locale) : null}
          />
          <Fact
            label={tDrones("buildType")}
            value={tDrones(BUILD_TYPE[view.buildType])}
          />
          <Fact
            label={tDrones("weightClass")}
            value={tDrones(WEIGHT_CLASS[view.weightClass])}
          />
          <Fact
            label={t("registeredCity")}
            value={
              view.cityNameAr
                ? pick(
                    { ar: view.cityNameAr, en: view.cityNameEn ?? view.cityNameAr },
                    locale,
                  )
                : null
            }
          />
          <Fact
            label={t("networkRid")}
            value={view.networkCapable ? tCommon("yes") : tCommon("no")}
          />
          <Fact
            label={t("broadcastRid")}
            value={view.broadcastCapable ? tCommon("yes") : tCommon("no")}
          />
        </dl>

        {/*
          The zone is deliberately absent above. Whether a flight is authorised
          is what a bystander needs; *where* it is tells them where the operator
          is standing, which the identified branches below get and nobody else.
        */}
        <p className="text-muted-foreground text-xs">{t("privacyNote")}</p>
      </section>

      {!isIdentified(view) ? (
        <p className="text-muted-foreground text-sm">{t("scanRedacted")}</p>
      ) : (
        <>
          {view.activeFlight ? (
            <section className="border-border flex flex-col gap-2 rounded-xl border p-5">
              <h2 className="font-medium">{t("flightZone")}</h2>
              <p className="text-sm">
                {pick(
                  {
                    ar: view.activeFlight.zoneNameAr,
                    en: view.activeFlight.zoneNameEn,
                  },
                  locale,
                )}
              </p>
              <p className="text-muted-foreground text-sm">
                {formatDateRange(
                  view.activeFlight.slotStart,
                  view.activeFlight.slotEnd,
                  locale,
                )}
              </p>
            </section>
          ) : null}

          <section className="border-border flex flex-col gap-2 rounded-xl border p-5">
            <h2 className="font-medium">{t("aircraftSection")}</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Fact label={tDrones("nickname")} value={view.nickname} />
              <Fact label={tDrones("manufacturer")} value={view.manufacturer} />
              <Fact label={tDrones("model")} value={view.model} />
              {/*
                Absent, not blank, for a self-built airframe — the whole reason
                this product exists is that such an aircraft has no serial and
                is registered anyway.
              */}
              <Fact label={tDrones("serialNumber")} value={view.serialNumber} ltr />
              <Fact
                label={tDrones("weightGrams")}
                value={formatNumber(view.weightGrams, locale)}
              />
            </dl>
          </section>

          <section className="border-border flex flex-col gap-2 rounded-xl border p-5">
            <h2 className="font-medium">{t("ownerSection")}</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Fact
                label={t("ownerName")}
                value={pick(
                  {
                    ar: view.ownerNameAr ?? "",
                    en: view.ownerNameEn ?? view.ownerNameAr ?? "",
                  },
                  locale,
                )}
              />
              <Fact label={t("ownerMobile")} value={view.ownerMobile} ltr />
              {/* Masked on every branch. The whole number comes only from a
                  logged reveal, never from rendering a page. */}
              <Fact
                label={t("idDocument")}
                value={view.ownerIdDocumentMasked}
                ltr
              />
            </dl>
          </section>

          {view.photoUrls.length > 0 ? (
            <section className="border-border flex flex-col gap-2 rounded-xl border p-5">
              <h2 className="font-medium">{t("photos")}</h2>
              <ul className="flex flex-wrap gap-2">
                {view.photoUrls.map((url) => (
                  <li key={url}>
                    {/* Served by /api/files, which checks ownership per request. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="border-border h-24 w-24 rounded-lg border object-cover"
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="border-border flex flex-col gap-2 rounded-xl border p-5">
            <h2 className="font-medium">{t("declarations")}</h2>
            {view.declarations.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t("declarationsEmpty")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {view.declarations.map((declaration, index) => (
                  <li
                    key={`${declaration.kind}-${declaration.moduleSerial ?? index}`}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span className="font-medium">{declaration.kind}</span>
                    {declaration.moduleSerial ? (
                      <span dir="ltr">{declaration.moduleSerial}</span>
                    ) : null}
                    <Badge
                      variant={declaration.verifiedAt ? "default" : "outline"}
                    >
                      {declaration.verifiedAt
                        ? t("declarationVerified")
                        : t("declarationUnverified")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border-border flex flex-col gap-2 rounded-xl border p-5">
            <h2 className="font-medium">{t("bookingHistory")}</h2>
            {view.bookings.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t("bookingHistoryEmpty")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {view.bookings.map((item) => (
                  <li key={item.id} className="flex flex-wrap gap-x-3">
                    <span>
                      {pick(
                        { ar: item.zoneNameAr, en: item.zoneNameEn },
                        locale,
                      )}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDateRange(item.slotStart, item.slotEnd, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {view.canReveal ? (
        <section className="border-border flex flex-col gap-2 rounded-xl border p-5">
          <h2 className="font-medium">{t("scanLog")}</h2>
          {view.scans.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("scanLogEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {view.scans.map((scan) => (
                <li key={scan.id} className="flex flex-wrap gap-x-3">
                  <span className="text-muted-foreground">
                    {formatDate(scan.createdAt, locale)}
                  </span>
                  {/* A stored code, translated at render — never the raw
                      `viewer_level` value, which would leave an Arabic page
                      reading "anonymous". */}
                  <span>{t(VIEWER_LEVEL[scan.viewerLevel])}</span>
                  {scan.revealedIdentity ? (
                    <Badge variant="destructive">{t("scanRevealed")}</Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

function Fact({
  label,
  value,
  ltr = false,
}: {
  label: string;
  value: string | null;
  ltr?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd dir={ltr ? "ltr" : undefined} className="font-medium">
        {value}
      </dd>
    </div>
  );
}
