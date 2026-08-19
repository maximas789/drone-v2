import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button-link";

/**
 * What a pilot sees on day one: three steps, the first of them live.
 *
 * **Not an empty dashboard with placeholder cards.** A brand-new account has no
 * flights, no aircraft and no history, and a grid of empty boxes tells them the
 * product is broken rather than that they have not started. F21's requirement
 * is a "short, purposeful onboarding … with the first step live and the rest
 * shown as upcoming".
 *
 * **Later steps are visibly not-yet, not disabled buttons.** A greyed control
 * invites a click that does nothing; a numbered step with no control reads as
 * a sequence, which is what this is.
 */

export type OnboardingStep = {
  /** Catalogue key under `dashboard.onboarding`. */
  key: string;
  done: boolean;
  /** Present only on the step that is next — exactly one, or none. */
  href?: string;
};

export async function Onboarding({ steps }: { steps: readonly OnboardingStep[] }) {
  const t = await getTranslations("dashboard");

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{t("onboardingTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("onboardingIntro")}</p>
      </div>

      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className={[
              "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border p-4",
              step.href ? "" : "opacity-70",
            ].join(" ")}
          >
            <span className="flex items-baseline gap-3">
              {/**
               * The number is `aria-hidden`: the `<ol>` already announces the
               * position, and a screen reader saying "1. 1. Complete your
               * profile" is the ordered list read twice.
               */}
              <span aria-hidden className="text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <span className="flex flex-col">
                <span className={step.done ? "text-muted-foreground line-through" : ""}>
                  {t(`onboarding.${step.key}` as never)}
                </span>
                <span className="text-muted-foreground text-sm">
                  {t(`onboardingHint.${step.key}` as never)}
                </span>
              </span>
            </span>

            {step.href ? (
              <ButtonLink href={step.href} size="sm">
                {t(`onboardingCta.${step.key}` as never)}
              </ButtonLink>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
