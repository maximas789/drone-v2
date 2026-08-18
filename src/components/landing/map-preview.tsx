import { getTranslations } from "next-intl/server";
import { ZoneDrawing } from "@/components/airspace/zone-drawing";
import { ButtonLink } from "@/components/ui/button-link";
import { Disclaimer } from "@/components/layout/disclaimer";
import { getSession } from "@/lib/auth-guards";
import { listActiveZones } from "@/lib/data/zone";
import type { Locale } from "@/lib/locale";

/**
 * The seeded Riyadh airspace on the front door.
 *
 * **Real rows, not an illustration** — `listActiveZones` is the same reader the
 * rest of the app uses, so what the front door shows is what a pilot will
 * actually be judged against. If the seed changes, this changes.
 *
 * The drawing itself lives in `components/airspace/zone-drawing.tsx`, shared
 * with `/zones`, which is the page that carries the hours and the ceilings this
 * one deliberately does not.
 */
export async function MapPreview({ locale }: { locale: Locale }) {
  const t = await getTranslations("landing");
  const session = await getSession();
  const zones = await listActiveZones(session);

  if (zones.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">{t("mapTitle")}</h2>
        <p className="text-muted-foreground max-w-2xl">{t("mapBody")}</p>
      </div>

      <ZoneDrawing zones={zones} />

      <Disclaimer locale={locale} />

      <div>
        <ButtonLink variant="outline" href="/zones">
          {t("mapCta")}
        </ButtonLink>
      </div>
    </section>
  );
}
