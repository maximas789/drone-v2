import "server-only";

import { eq } from "drizzle-orm";
import { audit, type Actor } from "@/lib/audit";
import type { DbExecutor } from "@/lib/db";
import { droneReport } from "@/lib/db/schema";

/**
 * Triage of a filed report — **thread 35, closed.**
 *
 * Since F11 a member of the public could scan a Remote ID and report the
 * aircraft; the row was written, audited and listed on `/admin`, and there it
 * stayed for ever. There was no "handled" state, no assignment and no way to
 * close one, deliberately: an enum member nothing writes is a lie about what
 * the app does, so the columns waited for the controls that write them.
 *
 * `status` lives in this folder for rule 11's reason — it is a status, and one
 * function writes it together with its audit event in a single transaction.
 *
 * **`open` is not reachable from here.** A report is filed open and a reviewer
 * moves it to `actioned` or `dismissed`; there is no un-handle. If the decision
 * was wrong the next reviewer records a *new* decision over it, which is how
 * the trail keeps both — reopening by clearing the column would erase the fact
 * that somebody once closed it.
 */

export type ReportOutcome =
  | { ok: true; status: "actioned" | "dismissed" }
  | { ok: false; reason: "not_found" | "already_applied" };

/**
 * Record what a reviewer did with a report.
 *
 * **`actioned` and `dismissed` are not a judgement of the reporter.** The first
 * means the report led somewhere — a Remote ID suspended, somebody called; the
 * second means a reviewer read it and it needed nothing. Neither is stored as
 * text, so both read correctly to whoever opens the record next, in whichever
 * language.
 *
 * The note is the reviewer's own words and reaches **nobody**: a report is
 * usually filed by a member of the public who left no way to reply. It is for
 * the next reviewer, and for the regulator reading the trail — which is why it
 * goes in `reason`, the same column a rejection's words go in.
 */
export async function triageReport(
  tx: DbExecutor,
  {
    reportId,
    actor,
    status,
    note,
    at = new Date(),
  }: {
    reportId: string;
    actor: Actor;
    status: "actioned" | "dismissed";
    note: string;
    at?: Date;
  },
): Promise<ReportOutcome> {
  const [row] = await tx
    .select({
      id: droneReport.id,
      status: droneReport.status,
      reportedCode: droneReport.reportedCode,
    })
    .from(droneReport)
    .where(eq(droneReport.id, reportId))
    .for("update");
  if (!row) return { ok: false, reason: "not_found" };
  /**
   * Already closed by somebody else while this page was open. The caller
   * refreshes and shows what actually happened rather than overwriting it —
   * the same answer `applyTransition` gives for a decided submission.
   */
  if (row.status !== "open") return { ok: false, reason: "already_applied" };

  await tx
    .update(droneReport)
    .set({
      status,
      handledAt: at,
      handledByUserId: actor.userId,
      handlingNote: note.trim() || null,
      updatedAt: at,
    })
    .where(eq(droneReport.id, reportId));

  await audit(tx, {
    actor,
    entityType: "drone_report",
    entityId: row.id,
    action:
      status === "actioned" ? "drone_report.actioned" : "drone_report.dismissed",
    before: { status: row.status },
    after: { status, reportedCode: row.reportedCode },
    reason: note.trim() || null,
  });

  return { ok: true, status };
}
