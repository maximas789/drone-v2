import { getTranslations } from "next-intl/server";

/**
 * The pitch, in three beats, **above any feature list**.
 *
 * A reader who does not yet believe there is a problem has no use for a list of
 * capabilities. The order is the argument: the rule, the aircraft the rule
 * cannot describe, and the consequence for the person flying one.
 */
const BEATS = ["rule", "gap", "consequence"] as const;

export async function Problem() {
  const t = await getTranslations("landing");

  return (
    <section className="flex flex-col gap-6 py-10">
      <h2 className="text-2xl font-semibold">{t("gapTitle")}</h2>

      <ol className="grid gap-4 md:grid-cols-3">
        {BEATS.map((beat, index) => (
          <li key={beat} className="bg-card flex flex-col gap-2 rounded-lg border p-5">
            {/**
             * The step number is decorative — the list is already ordered, and
             * a screen reader announcing "1" twice is noise. It is also plain
             * Latin text rather than a formatted number, because it is a
             * marker, not a quantity.
             */}
            <span aria-hidden className="text-primary font-mono text-sm">
              {`0${index + 1}`}
            </span>
            <h3 className="font-medium">{t(`beats.${beat}.title`)}</h3>
            <p className="text-muted-foreground text-sm">{t(`beats.${beat}.body`)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
