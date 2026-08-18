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
 * **Still the SVG, not MapLibre — see open thread 53.** F20a built the MapLibre
 * map in `src/components/map/`, and it does not render: its GeoJSON source
 * never finishes loading, which leaves the whole style permanently dirty so
 * even the basemap stays blank. Reproduced identically against a production
 * build, so it is not a dev-bundler artefact. Rather than ship a public page
 * with an empty grey rectangle on it, this page keeps F16b's server-rendered
 * SVG, which works. **`MapMount` is wired and one import away** — swapping it
 * back in is the last step of that thread, not a rewrite.
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
