import { getTranslations } from "next-intl/server";
import { formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * What has happened to this booking, and when.
 *
 * **Only steps that actually occurred carry a time**, and a step that ended the
 * booking is the last one shown. A timeline that draws "approved → checked in →
 * completed" in grey beneath a *rejected* booking is showing a future that is
 * not going to happen, which is worse than showing nothing.
 *
 * Every instant goes through `formatDateTime`, so it is Riyadh, Gregorian and
 * Latin-numeralled in both locales.
 */

export type TimelineStep = {
  /** Catalogue key under `bookings.timeline`. */
  key: string;
  at: string | null;
  /** The step the booking is currently at. */
  current: boolean;
};

export async function StatusTimeline({
  steps,
  locale,
}: {
  steps: readonly TimelineStep[];
  locale: Locale;
}) {
  const t = await getTranslations("bookings");

  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step) => (
        <li key={step.key} className="flex items-start gap-3">
          <span
            aria-hidden
            className={[
              "mt-1.5 size-2 shrink-0 rounded-full",
              step.at ? "bg-primary" : "bg-input",
              step.current ? "ring-3 ring-ring/40" : "",
            ].join(" ")}
          />
          <span className="flex flex-col">
            <span className={step.at ? "font-medium" : "text-muted-foreground"}>
              {t(`timeline.${step.key}` as never)}
            </span>
            {step.at ? (
              <span dir="ltr" className="text-muted-foreground text-sm">
                {formatDateTime(new Date(step.at), locale)}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
