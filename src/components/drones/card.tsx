import { useTranslations } from "next-intl";
import { DroneStatusBadge } from "./status-badge";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * One aircraft in the list.
 *
 * **The Remote ID code is the prominent element**, because it is the aircraft's
 * registration identity — the thing a pilot reads out over a phone and the
 * thing printed on the sticker. Before approval there is no code, and the card
 * says *"issued on approval"* rather than showing an empty space: a blank where
 * an identifier belongs reads as something that failed.
 *
 * **No QR here.** F19 owns the card, the QR and the print view; this links to
 * it. Two surfaces rendering a QR is the drift F11's single-projection rule
 * exists to prevent.
 *
 * The expiry tint is `<= 30 days`, computed by the caller so the card stays a
 * pure render — a component that reads the clock renders differently on the
 * server and in the browser and produces a hydration mismatch.
 */
export function DroneCard({
  drone,
  photoUrl,
  remoteIdCode,
  expiringSoon,
  locale,
}: {
  drone: {
    id: string;
    nickname: string;
    manufacturer: string | null;
    model: string | null;
    buildType: string;
    weightClass: string;
    status: string;
    submittedAt: Date | null;
    registrationExpiresAt: Date | null;
  };
  photoUrl: string | null;
  remoteIdCode: string | null;
  expiringSoon: boolean;
  locale: Locale;
}) {
  const t = useTranslations("drones");

  const makeModel = [drone.manufacturer, drone.model].filter(Boolean).join(" · ");

  return (
    <li
      className={`flex flex-col gap-3 rounded-lg border p-4 ${
        expiringSoon ? "border-destructive" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {photoUrl ? (
            /**
             * A plain `<img>`, deliberately. The bytes are streamed through
             * `/api/files/…`, which checks ownership on **every** request;
             * `next/image` would need that route in `remotePatterns` and would
             * then cache an owner-scoped photograph at the edge, where the
             * ownership check no longer runs. A slower LCP on a thumbnail is a
             * fair price for that not happening.
             */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt=""
              className="size-16 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="bg-muted size-16 shrink-0 rounded-md" />
          )}
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{drone.nickname}</span>
            {makeModel ? (
              <span className="text-muted-foreground text-xs">{makeModel}</span>
            ) : null}
            <span className="text-muted-foreground text-xs">
              {t(`buildTypes.${drone.buildType}`)} ·{" "}
              {t(`weightClasses.${drone.weightClass}`)}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <DroneStatusBadge status={drone.status} />
          {expiringSoon ? (
            <span className="text-destructive text-xs">{t("expiringSoon")}</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">{t("remoteIdLabel")}</span>
        {remoteIdCode ? (
          // Latin in both locales, monospace, grouping preserved: a code is a
          // code, not text to be localised.
          <span dir="ltr" className="text-start font-mono text-sm">
            {remoteIdCode}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">
            {t("remoteIdPending")}
          </span>
        )}
      </div>

      {drone.status === "pending" && drone.submittedAt ? (
        <p className="text-muted-foreground text-xs">
          {t("pendingSince", { date: formatDate(drone.submittedAt, locale) })}
        </p>
      ) : null}

      {drone.registrationExpiresAt ? (
        <p className="text-muted-foreground text-xs">
          {t("validUntil", {
            date: formatDate(drone.registrationExpiresAt, locale),
          })}
        </p>
      ) : null}

      {/**
       * **No link to `/drones/[id]` yet.** F18b builds that page; linking to it
       * now would ship a card whose only affordance is a 404, which is worse
       * than a card that does not claim to go anywhere.
       */}
    </li>
  );
}
