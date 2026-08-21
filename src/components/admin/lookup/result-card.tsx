"use client";

import { useTranslations } from "next-intl";
import { AuditTrail, type TrailEvent } from "@/components/admin/audit-trail";
import { RevealDialog } from "@/components/admin/lookup/reveal-dialog";
import { BookingStatusBadge } from "@/components/booking/status-badge";
import { StatusBadge, StatusBody } from "@/components/remote-id/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateRange, formatNumber } from "@/lib/format";
import { pick } from "@/lib/i18n-content";
import type { Locale } from "@/lib/locale";
import { flightAuthorisationOf } from "@/lib/lookup/authorisation";
import {
  isIdentified,
  type BuildType,
  type RedactedRemoteId,
  type WeightClass,
} from "@/lib/remote-id/redact";

/**
 * One resolved registration, as an officer standing beside the aircraft needs
 * it.
 *
 * **The answer comes first and it is one word.** *"Is this drone authorised to
 * be flying right now?"* is the question actually being asked; everything else
 * on this card is the evidence behind it. Putting a booking table on screen and
 * leaving the officer to work it out is a design failure — the facts are at
 * opposite ends of the page and the cost of getting it wrong is somebody
 * grounded who should be flying, or the reverse.
 *
 * **Nothing here is a bespoke projection.** The record arrives already through
 * `redactRemoteId` at reviewer level — the same function the public scan page
 * uses — so the national ID is masked before it reaches the browser and the
 * whole number exists only as the answer to a logged reveal.
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

export function ResultCard({
  view,
  trail,
  locale,
}: {
  view: RedactedRemoteId;
  /** The aircraft's history, drone and Remote ID rows in one chronology. */
  trail: readonly TrailEvent[];
  locale: Locale;
}) {
  const t = useTranslations("lookup");
  const tRemote = useTranslations("remoteId");
  const tCard = useTranslations("remoteId.card");
  const tDrones = useTranslations("drones");
  const tReview = useTranslations("review");
  const tCommon = useTranslations("common");

  const answer = flightAuthorisationOf(view);

  return (
    <div className="flex flex-col gap-4">
      {/*
        The verdict panel. `role="status"` so a screen reader announces the
        answer when it arrives rather than leaving it to be found — this is the
        one thing on the page somebody came for.
      */}
      <section
        role="status"
        className={`flex flex-col gap-2 rounded-xl border-2 p-5 ${
          answer.authorised
            ? "border-primary bg-primary/5"
            : "border-destructive bg-destructive/5"
        }`}
      >
        <p className="text-muted-foreground text-sm">{t("authorisedQuestion")}</p>
        <p className="text-3xl font-semibold">
          {answer.authorised ? t("authorisedYes") : t("authorisedNo")}
        </p>
        <p className="text-sm">
          {answer.authorised
            ? t("authorisedYesBody")
            : answer.because === "not_registered"
              ? t("authorisedNoRegistration")
              : t("authorisedNoFlight")}
        </p>

        {/*
          The zone and the slot, but only on a yes — and only here, on a staff
          screen. A bystander is told whether a flight is authorised and never
          where, because the zone is where the operator is standing.
        */}
        {answer.authorised ? (
          <dl className="mt-1 grid gap-2 text-sm sm:grid-cols-2">
            <Fact
              label={tRemote("flightZone")}
              value={pick(
                {
                  ar: answer.flight.zoneNameAr,
                  en: answer.flight.zoneNameEn,
                },
                locale,
              )}
            />
            <Fact
              label={tRemote("flightWindow")}
              value={formatDateRange(
                answer.flight.slotStart,
                answer.flight.slotEnd,
                locale,
              )}
            />
          </dl>
        ) : null}
      </section>

      <section className="border-border flex flex-col items-start gap-3 rounded-xl border p-5">
        <span className="text-muted-foreground text-sm">{tRemote("code")}</span>
        {/* Latin in both languages, and the letter-spacing is `ltr:`-only —
            it would sever the letter joins in any Arabic that reached it. */}
        <span
          dir="ltr"
          className="font-mono text-2xl font-semibold ltr:tracking-wide sm:text-3xl"
        >
          {view.code}
        </span>
        <StatusBadge status={view.registrationStatus} />
        {/*
          The body sentence, not only the badge. An expired registration must
          read as *expired* — a fact with a consequence — rather than as a
          missing "active", which is what a bare absent badge would look like.
        */}
        <StatusBody status={view.registrationStatus} />
        <dl className="grid w-full gap-2 text-sm sm:grid-cols-2">
          <Fact
            label={tRemote("validUntil")}
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
            label={tRemote("registeredCity")}
            value={
              view.cityNameAr
                ? pick(
                    {
                      ar: view.cityNameAr,
                      en: view.cityNameEn ?? view.cityNameAr,
                    },
                    locale,
                  )
                : null
            }
          />
          <Fact
            label={tRemote("networkRid")}
            value={view.networkCapable ? tCommon("yes") : tCommon("no")}
          />
          <Fact
            label={tRemote("broadcastRid")}
            value={view.broadcastCapable ? tCommon("yes") : tCommon("no")}
          />
        </dl>
      </section>

      {!isIdentified(view) ? (
        /*
          Unreachable from this page — `requireReviewer` guards it and
          `viewerLevelFor` returns `reviewer` or `admin` for anyone who gets
          here. Rendered rather than asserted because the union is the thing
          that keeps the masking honest, and a `!` here would be the first
          crack in it.
        */
        <p className="text-muted-foreground text-sm">{tRemote("scanRedacted")}</p>
      ) : (
        <>
          <section className="border-border flex flex-col gap-2 rounded-xl border p-5">
            <h2 className="font-medium">{tRemote("aircraftSection")}</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Fact label={tDrones("nickname")} value={view.nickname} />
              <Fact label={tDrones("manufacturer")} value={view.manufacturer} />
              <Fact label={tDrones("model")} value={view.model} />
              {/*
                Absent, not blank, on a self-built airframe — and the badge
                below says so out loud. On a reviewer's screen silence invites
                "incomplete record", which is the opposite of the truth: a
                serial-less registration is what this product exists for.
              */}
              <Fact
                label={tDrones("serialNumber")}
                value={view.serialNumber}
                ltr
              />
              <Fact
                label={tDrones("weightGrams")}
                value={formatNumber(view.weightGrams, locale)}
              />
              <Fact
                label={tDrones("hasCamera")}
                value={view.hasCamera ? tCommon("yes") : tCommon("no")}
              />
            </dl>
            {view.serialNumber ? null : (
              <Badge
                variant="secondary"
                /* `h-auto` with the wrap: `Badge` is `h-5 overflow-hidden`, so
                   `whitespace-normal` alone wraps the text and then clips the
                   second line. See `proposal-notice.tsx`. */
                className="h-auto w-fit whitespace-normal py-1 text-start"
              >
                {t("noSerialNote")}
              </Badge>
            )}
          </section>

          <section className="border-border flex flex-col gap-3 rounded-xl border p-5">
            <h2 className="font-medium">{tRemote("ownerSection")}</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Fact
                label={tRemote("ownerName")}
                value={pick(
                  {
                    ar: view.ownerNameAr ?? "",
                    en: view.ownerNameEn ?? view.ownerNameAr ?? "",
                  },
                  locale,
                )}
              />
              <Fact label={tRemote("ownerMobile")} value={view.ownerMobile} ltr />
              {/* The mask, and the only projection of a document number that a
                  rendered page ever carries. */}
              <Fact
                label={tRemote("idDocument")}
                value={view.ownerIdDocumentMasked}
                ltr
              />
            </dl>
            {view.canReveal ? (
              <RevealDialog code={view.code} locale={locale} />
            ) : null}
          </section>

          <section className="border-border flex flex-col gap-2 rounded-xl border p-5">
            <h2 className="font-medium">{t("bookingsSection")}</h2>
            {view.bookings.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {tRemote("bookingHistoryEmpty")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {view.bookings.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-x-3">
                    <span className="font-medium">
                      {pick(
                        { ar: item.zoneNameAr, en: item.zoneNameEn },
                        locale,
                      )}
                    </span>
                    {/*
                      `formatDateRange` emits an Arabic month name flanked by
                      Latin numerals. A `dir="ltr"` here would set the whole run
                      backwards; `<bdi>` isolates it without imposing a
                      direction. See `slot-time.tsx`.
                    */}
                    <bdi className="text-muted-foreground">
                      {formatDateRange(item.slotStart, item.slotEnd, locale)}
                    </bdi>
                    {/* The one badge every booking surface renders, so
                        "what colour is rejected" is answered in one place. */}
                    <BookingStatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border-border flex flex-col gap-2 rounded-xl border p-5">
            <h2 className="font-medium">{tRemote("declarations")}</h2>
            {view.declarations.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {tRemote("declarationsEmpty")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {view.declarations.map((declaration, index) => (
                  <li
                    /*
                        **The index is always in the key, not a fallback for a
                        null serial.** `remote_id_declaration` is a history
                        table: superseding a module writes a *second* row with
                        the same kind and the same serial, so `kind-serial`
                        collides the moment anyone re-declares the same
                        hardware — which is the ordinary case. React then warns
                        and may duplicate or omit a row on the regulator-facing
                        list of what an aircraft broadcasts.
                      */
                      key={`${declaration.kind}-${declaration.moduleSerial ?? ""}-${index}`}
                    className="flex flex-wrap items-center gap-2"
                  >
                    {/* A stored enum member, translated at render — the same
                        `moduleKinds` catalogue the pilot's own card uses. */}
                    <span className="font-medium">
                      {tCard(`moduleKinds.${declaration.kind}`)}
                    </span>
                    {declaration.moduleSerial ? (
                      <span dir="ltr" className="font-mono">
                        {declaration.moduleSerial}
                      </span>
                    ) : null}
                    <Badge variant={declaration.verifiedAt ? "default" : "outline"}>
                      {declaration.verifiedAt
                        ? tRemote("declarationVerified")
                        : tRemote("declarationUnverified")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {view.canReveal ? (
        <section className="border-border flex flex-col gap-3 rounded-xl border p-5">
          <h2 className="font-medium">{tReview("trailHeading")}</h2>
          {/* The same component the drone review screen renders, over the same
              query. Append-only, no edit control, and there must never be one. */}
          <AuditTrail events={trail} locale={locale} />
        </section>
      ) : null}

      {view.canReveal ? (
        <section className="border-border flex flex-col gap-2 rounded-xl border p-5">
          <h2 className="font-medium">{tRemote("scanLog")}</h2>
          {view.scans.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {tRemote("scanLogEmpty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {view.scans.map((scan) => (
                <li key={scan.id} className="flex flex-wrap items-center gap-x-3">
                  <bdi className="text-muted-foreground">
                    {formatDate(scan.createdAt, locale)}
                  </bdi>
                  <span>{tRemote(`viewerLevels.${scan.viewerLevel}`)}</span>
                  {scan.revealedIdentity ? (
                    <Badge variant="destructive">{tRemote("scanRevealed")}</Badge>
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
