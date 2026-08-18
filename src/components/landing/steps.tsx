import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button-link";

/**
 * Four concrete steps — named actions, not adjectives.
 *
 * Each one is something the app actually does today, in the order a pilot meets
 * them. "Book a zone" is here because F13 and F14 exist behind it; nothing on
 * this list is aspirational.
 */
const STEPS = ["register", "remoteId", "book", "fly"] as const;

export async function Steps() {
  const t = await getTranslations("landing");

  return (
    <section className="flex flex-col gap-6 py-10">
      <h2 className="text-2xl font-semibold">{t("stepsTitle")}</h2>

      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step} className="flex flex-col gap-2 border-s-2 ps-4">
            <span aria-hidden className="text-primary font-mono text-sm">
              {`0${index + 1}`}
            </span>
            <h3 className="font-medium">{t(`steps.${step}.title`)}</h3>
            <p className="text-muted-foreground text-sm">{t(`steps.${step}.body`)}</p>
          </li>
        ))}
      </ol>

      {/* Four steps is the summary; /how-it-works is the version that answers
          "and then what happens?". Without this link the front door has no
          route to it at all. */}
      <div>
        <ButtonLink variant="outline" href="/how-it-works">
          {t("stepsCta")}
        </ButtonLink>
      </div>
    </section>
  );
}
