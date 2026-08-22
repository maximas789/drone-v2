import { getTranslations } from "next-intl/server";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { JobRun, ScheduledFunction } from "@/lib/ops/jobs";
import type { Locale } from "@/lib/locale";

/**
 * What has run, and what is due to.
 *
 * **The error is printed whole.** Truncating it is how "an error occurred"
 * happens, and an operator who has to open a hosting dashboard to read the rest
 * has been sent on exactly the trip this page exists to save. It goes in a
 * `<pre>` that scrolls **inside its own box** — a stack trace is the widest
 * thing on the page, and under RTL a page that scrolls sideways hides the start
 * of every line.
 *
 * `formatDateTime` and `formatNumber` throughout: bare numbers and dates in an
 * Arabic page render as Arabic-Indic digits and a Hijri calendar, which is what
 * `src/lib/format.ts` exists to prevent.
 */

const STATUS_TONE: Record<string, string> = {
  completed: "text-muted-foreground",
  running: "text-foreground",
  cancelling: "text-foreground",
  cancelled: "text-muted-foreground",
  failed: "text-destructive",
};

function duration(run: JobRun, locale: Locale): string | null {
  if (run.durationMs === null) return null;
  return `${formatNumber(run.durationMs, locale)} ms`;
}

export async function JobsPanel({
  runs,
  scheduled,
  locale,
}: {
  runs: JobRun[];
  scheduled: ScheduledFunction[];
  locale: Locale;
}) {
  const t = await getTranslations("ops");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-medium">{t("jobs.scheduledTitle")}</h3>
        <p className="text-muted-foreground text-sm">
          {t("jobs.scheduledIntro")}
        </p>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead>
              <tr>
                {["function", "cron", "lastRun", "nextDue"].map((key) => (
                  <th
                    key={key}
                    className="border-b p-2 text-start align-top font-medium"
                  >
                    {t(`jobs.col.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scheduled.map((entry) => (
                <tr key={entry.functionId}>
                  <td className="border-b p-2 align-top">
                    <bdi dir="ltr" className="font-mono text-xs">
                      {entry.functionId}
                    </bdi>
                  </td>
                  <td className="border-b p-2 align-top">
                    {/* The expression exactly as Inngest receives it, TZ and
                        all — a cron read back without its timezone is the
                        thing that makes "did it run at 3am?" unanswerable. */}
                    <bdi dir="ltr" className="font-mono text-xs">
                      {entry.cron}
                    </bdi>
                  </td>
                  <td className="text-muted-foreground border-b p-2 align-top">
                    {entry.lastRun ? (
                      <>
                        {formatDateTime(entry.lastRun, locale)}
                        {entry.lastStatus ? (
                          <span
                            className={`ms-2 ${STATUS_TONE[entry.lastStatus] ?? ""}`}
                          >
                            {t(`jobs.status.${entry.lastStatus}`)}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      t("jobs.neverRun")
                    )}
                  </td>
                  <td className="text-muted-foreground border-b p-2 align-top">
                    {/* `null` when `nextCronRun` will not guess — a blank, never
                        a confident wrong time. */}
                    {entry.nextDue
                      ? formatDateTime(entry.nextDue, locale)
                      : t("jobs.nextUnknown")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-medium">{t("jobs.runsTitle")}</h3>
        <p className="text-muted-foreground text-sm">{t("jobs.runsIntro")}</p>

        {runs.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border p-4 text-sm">
            {t("jobs.noRuns")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {runs.map((run) => (
              <li key={run.id} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <bdi dir="ltr" className="font-mono text-xs">
                    {run.functionId}
                  </bdi>
                  <span
                    className={`text-xs ${STATUS_TONE[run.status] ?? ""}`}
                  >
                    {t(`jobs.status.${run.status}`)}
                  </span>
                </div>

                <dl className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <div className="flex gap-1">
                    <dt>{t("jobs.col.started")}</dt>
                    <dd>{formatDateTime(run.startedAt, locale)}</dd>
                  </div>
                  {duration(run, locale) ? (
                    <div className="flex gap-1">
                      <dt>{t("jobs.col.duration")}</dt>
                      <dd>
                        <bdi dir="ltr">{duration(run, locale)}</bdi>
                      </dd>
                    </div>
                  ) : null}
                  {run.attempt > 0 ? (
                    <div className="flex gap-1">
                      <dt>{t("jobs.col.attempt")}</dt>
                      <dd>{formatNumber(run.attempt, locale)}</dd>
                    </div>
                  ) : null}
                  <div className="flex gap-1">
                    <dt>{t("jobs.col.runId")}</dt>
                    <dd>
                      <bdi dir="ltr" className="font-mono">
                        {run.runId}
                      </bdi>
                    </dd>
                  </div>
                  {run.rerunOfRunId ? (
                    <div className="flex gap-1">
                      <dt>{t("jobs.col.rerunOf")}</dt>
                      <dd>
                        <bdi dir="ltr" className="font-mono">
                          {run.rerunOfRunId}
                        </bdi>
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {run.error ? (
                  <pre
                    dir="ltr"
                    className="bg-destructive/5 max-h-48 overflow-auto rounded p-2 text-start font-mono text-xs whitespace-pre-wrap"
                  >
                    {run.error}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
