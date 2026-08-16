import "server-only";

import { eq } from "drizzle-orm";
import { Middleware, internalEvents } from "inngest";
import { db } from "@/lib/db";
import { job } from "@/lib/db/schema";

/**
 * Mirrors every Inngest run into our own `job` table.
 *
 * **Middleware, not a line in each job body.** A function cannot forget to
 * report itself, a new function is covered the day it is written, and the
 * mirroring is one implementation rather than nine that drift.
 *
 * **A mirroring failure never fails the run it describes.** Every write is
 * wrapped: a bookkeeping row is not worth cancelling an expiry sweep over. The
 * failure is logged loudly, because a jobs table that is quietly not being
 * written is worse than one that is obviously broken — F29 reads it to answer
 * "did last night's sweep run?", and an empty table would answer "no".
 */
export class JobsTableMiddleware extends Middleware.BaseMiddleware {
  readonly id = "ajniha:jobs-table";

  /**
   * Fires once per run, on the first request only. Retries and later step
   * requests do **not** call it — which is why the completion hooks upsert
   * rather than update.
   */
  async onRunStart({ ctx, fn }: Middleware.OnRunStartArgs): Promise<void> {
    await mirror("start", async () => {
      await db
        .insert(job)
        .values({
          runId: ctx.runId,
          functionId: fn.id(),
          status: "running",
          attempt: ctx.attempt,
          triggerEvent: triggerEventName(ctx.event?.name),
          startedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: job.runId,
          set: { attempt: ctx.attempt, updatedAt: new Date() },
        });
    });
  }

  async onRunComplete({
    ctx,
    fn,
    output,
  }: Middleware.OnRunCompleteArgs): Promise<void> {
    await mirror("complete", async () => {
      await finish({
        runId: ctx.runId,
        functionId: fn.id(),
        attempt: ctx.attempt,
        triggerEvent: triggerEventName(ctx.event?.name),
        status: "completed",
        error: null,
        output: jsonSafe(output),
      });
    });
  }

  /**
   * Called on **every** failed attempt, not only the last one. A run that will
   * be retried stays `running` with its error recorded — showing `failed` and
   * then flipping back would make the system page contradict itself while
   * Inngest is still working.
   */
  async onRunError({
    ctx,
    fn,
    error,
    isFinalAttempt,
  }: Middleware.OnRunErrorArgs): Promise<void> {
    await mirror("error", async () => {
      await finish({
        runId: ctx.runId,
        functionId: fn.id(),
        attempt: ctx.attempt,
        triggerEvent: triggerEventName(ctx.event?.name),
        status: isFinalAttempt ? "failed" : "running",
        // The full message, never a summary: F29 shows it verbatim and it is
        // the whole reason an operator opens that page.
        error: error.stack ?? error.message,
        output: null,
        finished: isFinalAttempt,
      });
    });
  }
}

type FinishInput = {
  runId: string;
  functionId: string;
  attempt: number;
  triggerEvent: string | null;
  status: "completed" | "failed" | "running";
  error: string | null;
  output: unknown;
  /** A non-final failure is not an ending — leave `finishedAt` unset. */
  finished?: boolean;
};

async function finish({
  runId,
  functionId,
  attempt,
  triggerEvent,
  status,
  error,
  output,
  finished = true,
}: FinishInput): Promise<void> {
  const now = new Date();

  const existing = await db.query.job.findFirst({
    where: eq(job.runId, runId),
    columns: { id: true, startedAt: true },
  });

  const startedAt = existing?.startedAt ?? now;
  const durationMs = finished ? now.getTime() - startedAt.getTime() : null;

  if (!existing) {
    /**
     * `onRunStart` never fired — the run was already past its first request
     * when this process picked it up, or the start write failed. A row that
     * appears only at the end is still better than a run with no record.
     */
    await db.insert(job).values({
      runId,
      functionId,
      status,
      attempt,
      triggerEvent,
      startedAt,
      finishedAt: finished ? now : null,
      durationMs,
      error,
      output: output ?? null,
    });
    return;
  }

  await db
    .update(job)
    .set({
      status,
      attempt,
      finishedAt: finished ? now : null,
      durationMs,
      error,
      output: output ?? null,
      updatedAt: now,
    })
    .where(eq(job.id, existing.id));
}

/**
 * A cron has no meaningful trigger event — Inngest sends its own internal
 * `inngest/scheduled.timer`, and putting that string in every nightly row would
 * be noise that looks like information.
 */
function triggerEventName(name: string | undefined): string | null {
  if (!name) return null;
  return name === internalEvents.ScheduledTimer ? null : name;
}

/**
 * The column is `jsonb`. A function that returns something unserialisable
 * (a `Map`, a cycle) must not take the run down with it on the way out.
 */
function jsonSafe(value: unknown): unknown {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { unserialisable: true };
  }
}

async function mirror(phase: string, write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch (cause) {
    console.error(`[jobs-table] failed to mirror run ${phase}:`, cause);
  }
}
