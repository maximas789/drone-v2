import { getTranslations } from "next-intl/server";

/**
 * The oversight side of the same system.
 *
 * **Named capabilities, and no claim of adoption.** Every item here describes
 * what the platform offers a regulator — not anything a regulator has said,
 * agreed to, or reviewed. The heading is "for", never "with", and there is no
 * logo, no seal and no quotation.
 */
const ITEMS = ["queues", "compliance", "lookup", "audit"] as const;

export async function ForGaca() {
  const t = await getTranslations("landing");

  return (
    <section className="bg-card flex flex-col gap-6 rounded-lg border p-6 sm:p-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">{t("forGacaTitle")}</h2>
        <p className="text-muted-foreground max-w-2xl">{t("forGacaBody")}</p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {ITEMS.map((item) => (
          <li key={item} className="flex flex-col gap-1">
            <h3 className="font-medium">{t(`forGaca.${item}.title`)}</h3>
            <p className="text-muted-foreground text-sm">{t(`forGaca.${item}.body`)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
