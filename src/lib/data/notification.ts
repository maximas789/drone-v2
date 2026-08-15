import "server-only";

import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notification, notificationPreference } from "@/lib/db/schema";
import type { Session } from "@/lib/session";

/**
 * Notifications store a `type` key plus `params` — **never rendered text**. A
 * pilot who switches to English must see their old notifications in English,
 * so rendering happens at read time against the current locale.
 */

export async function listMyNotifications(session: Session, limit = 50) {
  return db.query.notification.findMany({
    where: eq(notification.userId, session.user.id),
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

export async function getMyPreferences(session: Session) {
  return db.query.notificationPreference.findMany({
    where: eq(notificationPreference.userId, session.user.id),
  });
}
