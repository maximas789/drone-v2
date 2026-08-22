import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { PrintButton } from "@/components/remote-id/print-button";
import { StatusBadge } from "@/components/remote-id/status-badge";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth-guards";
import { getMyDroneDetail } from "@/lib/data/drone";
import { formatDate, formatNumber } from "@/lib/format";
import { toLocale } from "@/lib/locale";
import { registrationStatusOf } from "@/lib/remote-id/redact";
import { fileUrlFor } from "@/lib/storage";
import "@/app/print.css";

/**
 * `/drones/[id]/remote-id/print` — the wallet card and the sticker sheet.
 *
 * Same guard as the card it prints: **owner-only, approved-only**, through
 * `getMyDroneDetail`. A print view is not a lesser surface — it is the one that
 * ends up physically attached to an aircraft.
 *
 * **The QR must already exist.** There is no "generating…" state here and no
 * retry: a print view whose central element is a placeholder is a sheet of
 * blank stickers. If the QR is missing, this sends the pilot back to the card,
 * which is where the retry lives.
 *
 * Sizes are in **millimetres**, on screen as well as in print, so what is
 * previewed is what comes out of the printer.
 */
export default async function RemoteIdPrintPage({
  params,
}: PageProps<"/[locale]/drones/[id]/remote-id/print">) {
  const locale = toLocale(await localeParam());
  const session = await requireUser(locale);
  const t = await getTranslations("remoteId.card");
  const tCommon = await getTranslations("common");

  const { id } = await params;
  const detail = await getMyDroneDetail(session, id);
  if (!detail) notFound();

  const { drone, remoteId } = detail;
  if (drone.status !== "approved" || !remoteId) notFound();

  const registrationStatus = registrationStatusOf({
    remoteIdStatus: remoteId.status,
    droneStatus: drone.status,
    validUntil: drone.registrationExpiresAt,
    // Never null here: this is the owner's own card, reached through a guard
    // that already established they own it.
    ownerUserId: drone.ownerUserId,
  });

  if (!remoteId.qrPathname) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 p-6">
        <h1 className="text-lg font-medium">{t("printTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("printNoQr")}</p>
        <Link href={`/drones/${drone.id}/remote-id`} className="text-sm underline">
          {t("backToCard")}
        </Link>
      </main>
    );
  }

  const qrUrl = fileUrlFor(remoteId.qrPathname);
  const validUntil = drone.registrationExpiresAt;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      {/* Everything in this block is screen-only — see `.print-hidden`. */}
      <div className="print-hidden flex flex-col gap-3">
        <Link href={`/drones/${drone.id}/remote-id`} className="text-sm underline">
          {t("backToCard")}
        </Link>
        <h1 className="text-xl font-semibold">{t("printTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("printIntro")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <PrintButton label={tCommon("print")} />
          {/**
           * The QR bytes, as a file. Through `/api/files/…` like every other
           * stored object, so the ownership check runs on the download exactly
           * as it runs on the image — a storage URL handed out here would keep
           * resolving for anyone who ever saw it.
           *
           * `download` names the file after the code, so a pilot with three
           * aircraft does not end up with three files called `AJN.png`.
           */}
          <a
            href={qrUrl}
            download={`${remoteId.code}.png`}
            className="text-sm underline"
          >
            {t("downloadQr")}
          </a>
        </div>
        <p className="text-muted-foreground text-xs">{t("printWarning")}</p>
      </div>

      {/* --- The wallet card ------------------------------------------- */}

      <section className="print-sheet print-avoid-break flex flex-col gap-3">
        <h2 className="print-hidden text-base font-medium">{t("printWalletTitle")}</h2>

        <article className="wallet-card flex flex-col justify-between gap-2 rounded-lg border border-black/25 bg-white p-3 text-black">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-[7pt] text-black/60">{t("issuer")}</span>
              <span dir="auto" className="text-start text-[10pt] font-semibold">
                {drone.nickname}
              </span>
            </div>
            <StatusBadge status={registrationStatus} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[7pt] text-black/60">{t("codeLabel")}</span>
              {/* Latin, LTR, monospace — a code is a code in both locales. */}
              <span dir="ltr" className="text-start font-mono text-[14pt] font-bold">
                {remoteId.code}
              </span>
              {validUntil ? (
                <span className="text-[7pt] text-black/60">
                  {t("validUntil")}: {formatDate(validUntil, locale)}
                </span>
              ) : null}
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt={t("qrAlt", { code: remoteId.code })} className="qr-30" />
          </div>

          {/**
           * On the artefact itself, not only on the page that made it. A card
           * in a wallet outlives the browser tab, and this is a proposal — it
           * must never be mistaken for a GACA-issued document.
           */}
          <p className="text-[6pt] leading-tight text-black/60">
            {tCommon("proposalNotice")}
          </p>
        </article>
      </section>

      {/* --- The sticker sheet ------------------------------------------ */}

      <section className="print-sheet flex flex-col gap-3">
        <h2 className="print-hidden text-base font-medium">{t("printStickersTitle")}</h2>
        <p className="print-hidden text-muted-foreground text-sm">
          {t("printStickersIntro")}
        </p>

        <div className="flex flex-wrap items-start gap-6">
          {(
            [
              ["qr-50", 50],
              ["qr-30", 30],
              ["qr-20", 20],
            ] as const
          ).map(([sizeClass, millimetres]) => (
            <figure
              key={sizeClass}
              className="print-avoid-break flex flex-col items-center gap-1"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt={t("qrAlt", { code: remoteId.code })}
                className={`${sizeClass} bg-white`}
              />
              {/**
               * The code under every sticker, so a scuffed QR is still
               * readable by eye — which is the whole reason the code is
               * grouped in fours in the first place.
               */}
              <figcaption
                dir="ltr"
                className="text-start font-mono text-[6pt] text-black"
              >
                {remoteId.code}
              </figcaption>
              <span className="print-hidden text-muted-foreground text-xs">
                {/* Through `format.ts` before ICU sees it: a bare number in a
                    message renders Arabic-Indic digits under `ar` (thread 22),
                    and a sticker measured in ٥٠ is not a measurement anybody
                    can hold a ruler against. */}
                {t("stickerSize", { size: formatNumber(millimetres, locale) })}
              </span>
            </figure>
          ))}
        </div>

        <p className="text-[6pt] leading-tight text-black/60">
          {tCommon("proposalNotice")}
        </p>
      </section>
    </main>
  );
}
