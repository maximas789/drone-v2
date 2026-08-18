import { getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/locale";

/**
 * The authored-data disclaimer, in one component so it reads identically
 * wherever airspace is drawn.
 *
 * **It appears on every map surface**, which is a project rule rather than a
 * design preference: the Riyadh zones are authored for this proposal and are
 * not official GACA airspace. A picture of a city with green and red polygons
 * on it is exactly the kind of thing somebody screenshots, and the sentence has
 * to travel with it.
 */
export async function Disclaimer({ locale: _locale }: { locale: Locale }) {
  const t = await getTranslations("zones");

  return (
    <p role="note" className="text-muted-foreground border-s-2 ps-3 text-sm">
      {t("disclaimer")}
    </p>
  );
}
