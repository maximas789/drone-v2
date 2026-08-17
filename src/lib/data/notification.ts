import "server-only";

import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/lib/db";
import { notification, notificationPreference } from "@/lib/db/schema";
import type { NotificationCategory } from "@/lib/notify";
import type { Session } from "@/lib/session";

/**
 * Notifications store a `type` key plus `params` — **never rendered text**. A
 * pilot who switches to English must see their old notifications in English,
 * so rendering happens at read time against the current locale.
 *
 * **Strictly per-user, with no exception.** A reviewer does not see a pilot's
 * notifications and a pilot does not see a reviewer's — there is no
 * `isReviewer` escape hatch anywhere in this file, unlike most of
 * `src/lib/data/`. A notification is addressed to one person by construction.
 *
 * `notification.status` is written here rather than through
 * `src/lib/workflow/`, and the ESLint rule names this file as an exemption for
 * the same reason it names `jobs-table.ts`: **read/unread is not a domain
 * status.** It has no transitions, no actor, nothing to notify and nothing a
 * regulator would audit. Putting "a pilot opened their bell menu" in the
 * approval trail would bury the trail that rule exists to keep readable.
 */

export async function listMyNotifications(session: Session, limit = 50) {
  return db.query.notification.findMany({
    where: eq(notification.userId, session.user.id),
    orderBy: [desc(notification.createdAt)],
    limit,
  });
}

/** The bell: the ten most recent, whatever their state. */
export async function listMyRecentNotifications(session: Session, limit = 10) {
  return listMyNotifications(session, limit);
}

export async function listMyUnreadNotifications(session: Session, limit = 50) {
  return db.query.notification.findMany({
    where: and(
      eq(notification.userId, session.user.id),
      eq(notification.status, "unread"),
    ),
    orderBy: [desc(notification.createdAt)],
    limit,
  });
}

export async function countMyUnread(session: Session) {
  const [row] = await db
    .select({ value: count() })
    .from(notification)
    .where(
      and(
        eq(notification.userId, session.user.id),
        eq(notification.status, "unread"),
      ),
    );
  return row?.value ?? 0;
}

/**
 * Marks one as read. **Scoped by `userId` in the `where` clause**, not checked
 * afterwards — so another pilot's id updates zero rows and comes back `false`,
 * which the action turns into the same 404 a nonexistent id gets. The
 * difference between "not yours" and "not there" is deliberately invisible.
 */
export async function markNotificationRead(
  session: Session,
  id: string,
): Promise<boolean> {
  const updated = await db
    .update(notification)
    .set({ status: "read", readAt: new Date() })
    .where(
      and(
        eq(notification.id, id),
        eq(notification.userId, session.user.id),
        // Idempotent: re-reading an already-read row must not move `readAt`,
        // which is the record of when they actually saw it.
        eq(notification.status, "unread"),
      ),
    )
    .returning({ id: notification.id });

  if (updated.length > 0) return true;

  // Already read is a success from the caller's point of view; it is only a
  // failure if the row is not theirs or not there at all.
  const existing = await db.query.notification.findFirst({
    where: and(
      eq(notification.id, id),
      eq(notification.userId, session.user.id),
    ),
    columns: { id: true },
  });
  return Boolean(existing);
}

export async function markAllNotificationsRead(
  session: Session,
): Promise<number> {
  const updated = await db
    .update(notification)
    .set({ status: "read", readAt: new Date() })
    .where(
      and(
        eq(notification.userId, session.user.id),
        eq(notification.status, "unread"),
      ),
    )
    .returning({ id: notification.id });
  return updated.length;
}

// --- preferences ----------------------------------------------------------

export async function getMyPreferences(session: Session) {
  return db.query.notificationPreference.findMany({
    where: eq(notificationPreference.userId, session.user.id),
  });
}

/**
 * **Absent means on.** A user who has never opened this page has no rows at
 * all, and defaulting those to "off" would silently mute every reminder the app
 * has. `notify()` and `emailEnabled()` already read it that way; this writes
 * the row only when somebody actually chooses.
 */
export async function setMyPreference(
  session: Session,
  category: NotificationCategory,
  values: { emailEnabled?: boolean; inAppEnabled?: boolean },
): Promise<void> {
  const existing = await db.query.notificationPreference.findFirst({
    where: and(
      eq(notificationPreference.userId, session.user.id),
      eq(notificationPreference.category, category),
    ),
  });

  if (existing) {
    await db
      .update(notificationPreference)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(notificationPreference.id, existing.id));
    return;
  }

  await db.insert(notificationPreference).values({
    userId: session.user.id,
    category,
    emailEnabled: values.emailEnabled ?? true,
    inAppEnabled: values.inAppEnabled ?? true,
  });
}

// --- the email link -------------------------------------------------------

/**
 * Ties a notification to the email that carried it, so the answer to "the
 * notification is there, why didn't the email arrive?" is one join away.
 *
 * Matched on the **entity**, not by guessing: `email_log.entityId` and
 * `notification.entityId` are both set by the code that wrote them, and the
 * newest unlinked notification for that user and entity is the one this email
 * is about.
 *
 * Takes no session — it is called from an Inngest job, which has none, and it
 * writes nothing a caller could use to read somebody else's rows. Same
 * reasoning as `src/lib/inngest/queries.ts`.
 */
export async function linkNotificationEmail(
  tx: DbExecutor,
  {
    userId,
    entityId,
    emailLogId,
  }: { userId: string; entityId: string; emailLogId: string },
): Promise<boolean> {
  const [target] = await tx
    .select({ id: notification.id })
    .from(notification)
    .where(
      and(
        eq(notification.userId, userId),
        eq(notification.entityId, entityId),
        isNull(notification.emailLogId),
      ),
    )
    .orderBy(desc(notification.createdAt))
    .limit(1);

  if (!target) return false;

  await tx
    .update(notification)
    .set({ emailLogId })
    .where(eq(notification.id, target.id));
  return true;
}
