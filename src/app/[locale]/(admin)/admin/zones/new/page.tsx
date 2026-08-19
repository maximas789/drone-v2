import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { ZoneForm } from "@/components/admin/zone/zone-form";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { listCitiesForAdmin, listZoneContext } from "@/lib/data/zone-admin";
import { toLocale } from "@/lib/locale";
import { zonesToGeoJson } from "@/lib/maps/layer-styles";

/**
 * `/admin/zones/new` — draw a zone.
 *
 * It saves a **draft**, and says so on the button. A draft is invisible to
 * pilots and produces no slots, which is what makes F23a safe to ship before
 * the publish lifecycle exists: nothing anybody draws here can affect a flight
 * until F23b gives somebody the button.
 *
 * The active zones travel to the client as GeoJSON so the editor can draw them
 * faintly underneath. Drawing airspace next to airspace without seeing the
 * airspace is how boundaries end up fifty metres apart.
 */
export default async function NewZonePage() {
  const locale = toLocale(await localeParam());
  const session = await requireAdmin();
  const t = await getTranslations("zoneAdmin");

  const [cities, context] = await Promise.all([
    listCitiesForAdmin(session),
    listZoneContext(session),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <Link
          href="/admin/zones"
          className="text-muted-foreground text-sm underline"
        >
          {t("backToZones")}
        </Link>
      </div>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("newZone")}</h1>
        <p className="text-muted-foreground text-sm">{t("newZoneIntro")}</p>
      </header>

      {cities.length === 0 ? (
        /*
          A zone belongs to a city, and F23c is what adds one. Saying so beats
          a select with nothing in it.
        */
        <p className="text-muted-foreground text-sm">{t("noCities")}</p>
      ) : (
        <ZoneForm
          cities={cities}
          contextGeojson={zonesToGeoJson(context, locale)}
          locale={locale}
        />
      )}
    </main>
  );
}
