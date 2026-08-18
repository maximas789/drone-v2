import { locale as localeParam } from "next/root-params";
import { getTranslations } from "next-intl/server";
import { ZoneDrawing } from "@/components/airspace/zone-drawing";
import { ZoneList } from "@/components/airspace/zone-list";
import { Disclaimer } from "@/components/layout/disclaimer";
import { PublicPage } from "@/components/layout/public-page";
import { ButtonLink } from "@/components/ui/button-link";
import { getSession } from "@/lib/auth-guards";
import { listActiveZones, listHoursForZones } from "@/lib/data/zone";
import { toLocale } from "@/lib/locale";

/**
 * The published airspace, read-only.
 *
 * **This ships before [F20](../../../../../.claude/plans/features/F20-airspace-map.md),
 * deliberately** — settled with the user before building. F16 promises a public
 * zone page and F30 wants it indexable; waiting for the interactive map would
 * leave a 404 where a shared link lands, for the whole of the largest feature
 * left. The picture here is F16a's SVG and the list is real: codes, ceilings,
 * weight and build limits, and the full week of opening windows out of
 * `zone_hour`. **F20 replaces the picture and leaves the list alone.**
 *
 * There is deliberately no second MapLibre map on this page. One interactive
 * map, owned by F20.
 *
 * **No booking here.** A slot needs an account and an aircraft — the airspace
 * engine's answer depends on the drone's weight and build type, so a "book"
 * button on a page that knows neither would be promising an outcome it cannot
 * check. This page publishes the rule; the engine applies it.
 *
 * Nothing in `<head>` is set here. F30 owns the title.
 */
export default async function ZonesPage() {
  const locale = toLocale(await localeParam());
  const t = await getTranslations("zones");
  const session = await getSession();
  const signedIn = Boolean(session);

  const zones = await listActiveZones(session);
  const hours = await listHoursForZones(
    session,
    zones.map((zone) => zone.id),
  );

  return (
    <PublicPage signedIn={signedIn}>
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold text-balance sm:text-4xl">
          {t("pageTitle")}
        </h1>
        <p className="text-muted-foreground text-lg">{t("pageLead")}</p>
        <Disclaimer locale={locale} />
      </header>

      {zones.length > 0 ? (
        <>
          <ZoneDrawing zones={zones} />
          <ZoneList zones={zones} hours={hours} locale={locale} />
        </>
      ) : (
        /**
         * The seed has not been run. Saying so beats an empty page that looks
         * like a country with no airspace in it.
         */
        <p className="text-muted-foreground">{t("noZones")}</p>
      )}

      <section className="bg-card flex flex-col gap-3 rounded-lg border p-5">
        <h2 className="text-lg font-medium">{t("bookingTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("bookingBody")}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={signedIn ? "/drones/new" : "/sign-up"}>
            {t("bookingCta")}
          </ButtonLink>
          <ButtonLink variant="outline" href="/how-it-works">
            {t("howItWorksCta")}
          </ButtonLink>
        </div>
      </section>
    </PublicPage>
  );
}
