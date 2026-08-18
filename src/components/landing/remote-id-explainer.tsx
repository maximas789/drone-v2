import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { DEMO_CARD_CODE, demoQrDataUri } from "@/lib/landing/demo-card";

/**
 * The answer, shown rather than described: an Ajniha Remote ID card with a QR
 * that actually scans.
 *
 * **Everything here is real.** The QR is produced by the same encoder that
 * writes the sticker on an approved aircraft — same payload builder, same error
 * correction, same quiet zone — so a phone pointed at this page reaches F11's
 * real scan page. It is not a picture of a QR.
 *
 * **The code belongs to nobody, permanently.** `AJN-DEM0-CARD` is reserved in
 * the codec and can never be issued, so the scan lands on the genuine lookup
 * and is told, honestly, that no registration holds it. Pointing the front door
 * at a real aircraft would publish a stranger's record; inventing a
 * registration would put a non-existent drone in a regulator-facing register.
 * The card is labelled an example on its face for the same reason.
 *
 * The dates are fixed rather than computed from `now`, so the card reads the
 * same on every render and nothing here can drift into looking like a live
 * record.
 */

const EXAMPLE_ISSUED = new Date("2026-01-11T00:00:00Z");
const EXAMPLE_VALID_UNTIL = new Date("2029-01-11T00:00:00Z");

export async function RemoteIdExplainer({ locale }: { locale: Locale }) {
  const t = await getTranslations("landing");
  const tDrones = await getTranslations("drones");

  const qr = await demoQrDataUri();

  return (
    <section className="flex flex-col gap-6 md:flex-row md:items-center md:gap-10">
      <div className="flex flex-col gap-3 md:flex-1">
        <h2 className="text-2xl font-semibold">{t("remoteIdTitle")}</h2>
        <p className="text-muted-foreground">{t("remoteIdBody")}</p>
        <p className="text-muted-foreground">{t("accountabilityBody")}</p>
      </div>

      <div className="md:flex-1">
        <article className="bg-card mx-auto flex max-w-sm flex-col items-center gap-4 rounded-xl border p-5 shadow-sm">
          <div className="flex w-full items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">{t("cardIssuer")}</span>
            {/* Said on the artefact, not only in the prose beside it. */}
            <Badge variant="secondary">{t("cardExampleLabel")}</Badge>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="text-muted-foreground text-xs">
              {t("cardCodeLabel")}
            </span>
            {/* Latin, LTR, monospace in both locales — a code is a code. */}
            <span
              dir="ltr"
              className="font-mono text-2xl font-semibold ltr:tracking-wide"
            >
              {DEMO_CARD_CODE}
            </span>
          </div>

          {/* White plate and padding: a QR needs its quiet zone and its
              contrast, in dark mode as much as in light. */}
          <div className="rounded-lg bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt={t("cardQrAlt")}
              width={176}
              height={176}
              className="size-44 max-w-full"
            />
          </div>

          <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-2 border-t pt-3">
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">
                {t("cardIssuedLabel")}
              </dt>
              <dd className="text-start text-sm font-medium">
                {formatDate(EXAMPLE_ISSUED, locale)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">
                {t("cardValidUntilLabel")}
              </dt>
              <dd className="text-start text-sm font-medium">
                {formatDate(EXAMPLE_VALID_UNTIL, locale)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">
                {tDrones("buildType")}
              </dt>
              <dd className="text-start text-sm font-medium">
                {tDrones("buildTypes.self_built")}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">
                {tDrones("weightClass")}
              </dt>
              <dd className="text-start text-sm font-medium">
                {tDrones("weightClasses.light")}
              </dd>
            </div>
          </dl>

          <p className="text-muted-foreground text-center text-xs">
            {t("cardScanHint")}
          </p>
        </article>
      </div>
    </section>
  );
}
