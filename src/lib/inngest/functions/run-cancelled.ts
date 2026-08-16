import { eq } from "drizzle-orm";
import { internalEvents } from "inngest";
import { db } from "@/lib/db";
import { job } from "@/lib/db/schema";
import { inngest } from "../client";

/**
 * Closes out a cancelled run in the `job` table.
 *
 * The middleware cannot: a cancelled run stops at a step boundary and never
 * reaches `onRunComplete` or `onRunError`, so without this the row would sit at
 * `running` forever and the system page would show a job that never ends.
 *
 * Inngest emits `inngest/function.cancelled` for it, which is an ordinary event
 * and can be subscribed to like any other. `cancelling` is **not** written here
 * — that is the state between an operator pressing cancel and the run actually
 * stopping, and F29 writes it when it sends the request.
 */
export const runCancelled = inngest.createFunction(
  {
    id: "run-cancelled",
    name: "Record a cancelled run",
    triggers: [{ event: internalEvents.FunctionCancelled }],
  },
  async ({ event, step }) => {
    const runId = event.data.run_id as string | undefined;
    if (!runId) return { skipped: "no-run-id" };

    return step.run("mark-cancelled", async () => {
      const existing = await db.query.job.findFirst({
        where: eq(job.runId, runId),
        columns: { id: true, startedAt: true, status: true },
      });
      // A run this app never mirrored, or one already finished before the
      // cancellation landed. Neither is worth inventing a row for.
      if (!existing) return { runId, updated: false };
      if (existing.status !== "running" && existing.status !== "cancelling") {
        return { runId, updated: false };
      }

      const now = new Date();
      await db
        .update(job)
        .set({
          status: "cancelled",
          finishedAt: now,
          durationMs: now.getTime() - existing.startedAt.getTime(),
          updatedAt: now,
        })
        .where(eq(job.id, existing.id));

      return { runId, updated: true };
    });
  },
);
