import "server-only";

import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { job } from "@/lib/db/schema";
import { CRON_SCHEDULES, riyadhCron } from "@/lib/inngest/rules";
import { nextCronRun } from "@/lib/ops/cron";

/**
 * The background-job panel's two questions: *what has run*, and *is the
 * schedule doing what it says*.
 *
 * Both answer from the `job` table, which F08's middleware writes on every run
 * — so this page needs no second source and no Inngest API call to say what
 * happened. That was the reason the table exists: *"a hosting dashboard that
 * keeps 30 days of history is not a substitute for a record the app owns."*
 */

export type JobRun = {
  id: string;
  runId: string;
  functionId: string;
  status: string;
  attempt: number;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  /** The **whole** message. Truncating it here is how "an error occurred" happens. */
  error: string | null;
  triggerEvent: string | null;
  /** Set when this run was started by the Re-run button on an earlier one. */
  rerunOfRunId: string | null;
};

export async function listJobRuns(limit = 50): Promise<JobRun[]> {
  return db
    .select({
      id: job.id,
      runId: job.runId,
      functionId: job.functionId,
      status: job.status,
      attempt: job.attempt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      durationMs: job.durationMs,
      error: job.error,
      triggerEvent: job.triggerEvent,
      rerunOfRunId: job.rerunOfRunId,
    })
    .from(job)
    .orderBy(desc(job.startedAt))
    .limit(limit);
}

export type ScheduledFunction = {
  functionId: string;
  /** With the `TZ=Asia/Riyadh` prefix, exactly as Inngest receives it. */
  cron: string;
  lastRun: Date | null;
  lastStatus: string | null;
  /** `null` when the expression is one `nextCronRun` will not guess at. */
  nextDue: Date | null;
};

/**
 * The six cron functions, their schedule, their last run and their next.
 *
 * **`CRON_SCHEDULES` is the source**, not the function definitions — F08
 * exported it as data for exactly this, so that listing the schedule does not
 * mean importing the whole Inngest graph into a page render.
 *
 * The last run comes from **one ordered query**, reduced to newest-per-function
 * in JavaScript. Six separate "latest row" queries to fill a six-row table
 * would make this the slowest panel on the page, and a `distinct on` would not
 * be worth dropping to raw SQL for six rows already in memory.
 */
export async function listScheduledFunctions(
  now: Date = new Date(),
): Promise<ScheduledFunction[]> {
  const ids = Object.keys(CRON_SCHEDULES);

  const latest = await db
    .select({
      functionId: job.functionId,
      startedAt: job.startedAt,
      status: job.status,
    })
    .from(job)
    .where(inArray(job.functionId, ids))
    .orderBy(job.functionId, desc(job.startedAt));

  /**
   * The value key is `lastStatus`, not `status`. ESLint rule 11 bans a `status:`
   * property outside `src/lib/workflow/` — it cannot tell a write from a read,
   * and this module must stay banned from writing one. Naming the field for
   * what it holds satisfies both, and reads better besides.
   */
  const newest = new Map<string, { startedAt: Date; lastStatus: string }>();
  for (const row of latest) {
    if (!newest.has(row.functionId)) {
      newest.set(row.functionId, {
        startedAt: row.startedAt,
        lastStatus: row.status,
      });
    }
  }

  return ids.map((functionId) => {
    const expression = CRON_SCHEDULES[functionId as keyof typeof CRON_SCHEDULES];
    const last = newest.get(functionId);
    return {
      functionId,
      cron: riyadhCron(expression),
      lastRun: last?.startedAt ?? null,
      lastStatus: last?.lastStatus ?? null,
      nextDue: nextCronRun(expression, now),
    };
  });
}

/** One run, for the actions to check before they touch Inngest. */
export async function getJobRun(runId: string) {
  return db.query.job.findFirst({ where: eq(job.runId, runId) });
}
