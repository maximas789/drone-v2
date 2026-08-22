import "server-only";

import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailLog, notification } from "@/lib/db/schema";

/**
 * The sent-mail log: *the decision happened, the notification exists, the email
 * failed, here is why.*
 *
 * **`skipped` is not `failed`, and the difference is the panel's whole point.**
 * `sendEmail` writes four statuses — `queued`, `sent`, `skipped`, `failed` —
 * and `skipped` means only that no `RESEND_API_KEY` was configured, so the
 * message printed to the terminal instead. Rendering the two the same sends an
 * operator to debug a delivery failure that never happened. The status codes
 * come from the code that writes them, so there is no second list here to drift.
 */

export const EMAIL_STATUSES = ["queued", "sent", "skipped", "failed"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export function isEmailStatus(value: string): value is EmailStatus {
  return (EMAIL_STATUSES as readonly string[]).includes(value);
}

export type EmailLogRow = {
  id: string;
  toAddress: string;
  subject: string;
  template: string;
  locale: string;
  status: string;
  /** The provider's own message, in full, when it refused. */
  error: string | null;
  providerMessageId: string | null;
  /** What the mail was about — a drone, a booking. Links the loop. */
  entityId: string | null;
  sentAt: Date | null;
  createdAt: Date;
  /**
   * The in-app notification that accompanied it, when F15 linked one. This is
   * the half that closes the loop the criteria ask for: from a failed email
   * back to the notification the pilot did still receive.
   */
  notificationId: string | null;
  notificationType: string | null;
};

export type EmailLogFilters = {
  status?: EmailStatus;
  template?: string;
};

export async function listEmailLog(
  filters: EmailLogFilters = {},
  limit = 50,
): Promise<EmailLogRow[]> {
  const clauses: SQL[] = [];
  if (filters.status) clauses.push(eq(emailLog.status, filters.status));
  if (filters.template) clauses.push(eq(emailLog.template, filters.template));

  return db
    .select({
      id: emailLog.id,
      toAddress: emailLog.toAddress,
      subject: emailLog.subject,
      template: emailLog.template,
      locale: emailLog.locale,
      status: emailLog.status,
      error: emailLog.error,
      providerMessageId: emailLog.providerMessageId,
      entityId: emailLog.entityId,
      sentAt: emailLog.sentAt,
      createdAt: emailLog.createdAt,
      notificationId: notification.id,
      notificationType: notification.type,
    })
    .from(emailLog)
    /**
     * A left join, and from `notification` to `email_log` rather than the other
     * way: most mail has no notification beside it (a password reset is not a
     * decision), and an inner join would hide exactly the rows an operator is
     * looking for.
     */
    .leftJoin(notification, eq(notification.emailLogId, emailLog.id))
    .where(clauses.length > 0 ? and(...clauses) : undefined)
    .orderBy(desc(emailLog.createdAt))
    .limit(limit);
}

/** The templates that actually appear in the log — the filter's options. */
export async function listEmailTemplates(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ template: emailLog.template })
    .from(emailLog)
    .orderBy(emailLog.template);
  return rows.map((row) => row.template);
}
