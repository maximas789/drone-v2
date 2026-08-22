import { getTranslations } from "next-intl/server";
import type { HealthCheck, HealthState } from "@/lib/ops/health";

/**
 * The integration list: what each one is for, whether it has what it needs, and
 * **what changes if it does not**.
 *
 * **The consequence line is the point of the panel.** A red dot beside
 * "Resend" tells an operator nothing they can act on; *"emails print to the
 * terminal only"* tells them whether to stop what they are doing. So a degraded
 * row always renders its consequence, and a row cannot be degraded without one
 * — `runHealthChecks` supplies it, and there is no branch here that would
 * render a bare state.
 *
 * **State is not carried by colour alone.** Each row has a word as well as a
 * tint, because a red dot and a grey dot are the same dot to a colourblind
 * reader and to a black-and-white printout of a screenshot.
 */

const TONE: Record<HealthState, string> = {
  ok: "border-s-primary/60",
  degraded: "border-s-muted-foreground/60",
  // The only one that is destructive-coloured: `down` means something a person
  // has to fix now, and a page where everything is red has nothing urgent on it.
  down: "border-s-destructive",
};

export async function HealthGrid({ checks }: { checks: HealthCheck[] }) {
  const t = await getTranslations("ops");

  return (
    <ul className="flex flex-col gap-2">
      {checks.map((check) => (
        <li
          key={check.id}
          className={`flex flex-col gap-1 rounded-e-lg border-s-4 bg-muted/30 p-4 ${TONE[check.state]}`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium">
              {t(`check.${check.id}.title`)}
            </span>
            <span className="text-muted-foreground text-xs">
              {t(`state.${check.state}`)}
            </span>
          </div>

          <p className="text-muted-foreground text-sm">
            {t(`check.${check.id}.what`)}
          </p>

          {/**
           * Detail values are facts the check measured — a latency, a function
           * count, a URL. Rendered `<bdi dir="ltr">` because most of them are
           * Latin runs inside an Arabic sentence, and the URL ones would
           * otherwise reorder around the surrounding words.
           */}
          {check.detail ? (
            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {Object.entries(check.detail).map(([key, value]) => (
                <div key={key} className="flex gap-1">
                  <dt className="text-muted-foreground">
                    {t(`detail.${key}`)}
                  </dt>
                  <dd>
                    <bdi dir="ltr" className="font-mono">
                      {String(value)}
                    </bdi>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {check.consequence ? (
            <p className="text-sm font-medium">
              {t(`consequence.${check.consequence}`)}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
