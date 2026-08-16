import "server-only";

import { and, eq } from "drizzle-orm";
import type { DbExecutor } from "@/lib/db";
import { notification, notificationPreference } from "@/lib/db/schema";
import type { AuditEntityType } from "@/lib/audit";
import type { notificationCategory } from "@/lib/db/enums";

/**
 * The in-app half of telling somebody what happened.
 *
 * **Never store rendered text.** A row carries a `type` — a key inside the
 * `notifications` namespace of `messages/{ar,en}.json` — plus structured
 * `params`. A pilot who switches to English must see their *old* notifications
 * in English, which storing a sentence makes impossible.
 *
 * Called **inside the same transaction** as the state change it describes, so
 * the row and the status commit together or neither does. The email is a
 * separate, later step: a failing mail provider must never roll back a decision.
 *
 * > F15 owns the read surfaces (bell, list, preferences UI) and may add types.
 * > It should not add a second writer — this is the one.
 */

export type NotificationCategory =
  (typeof notificationCategory.enumValues)[number];

export type NotifyInput = {
  userId: string;
  /** A key under the `notifications` namespace, e.g. `registrationExpired`. */
  type: string;
  /**
   * Structured values only. A bilingual entity carries **both** variants
   * (`zoneNameAr` *and* `zoneNameEn`) so rendering needs no join, and any
   * number arrives pre-formatted as a string — ICU would otherwise format a
   * bare numeric argument itself and emit Arabic-Indic digits under `ar`.
   */
  params?: Record<string, string | null>;
  entityType?: AuditEntityType | null;
  entityId?: string | null;
  /** Locale-less. The renderer prefixes the active `/[locale]`. */
  href?: string | null;
  /**
   * When set, the recipient's preference for this category is honoured and the
   * row may be skipped entirely.
   *
   * **Decisions pass nothing.** Letting someone unsubscribe from "your
   * registration was rejected" would be a compliance failure dressed as a
   * preference, so approval, rejection, revocation and expiry are unconditional
   * by having no category to check.
   */
  category?: NotificationCategory;
};

/** `true` if a row was written, `false` if the recipient had it switched off. */
export async function notify(
  tx: DbExecutor,
  {
    userId,
    type,
    params = {},
    entityType = null,
    entityId = null,
    href = null,
    category,
  }: NotifyInput,
): Promise<boolean> {
  if (category && !(await inAppEnabled(tx, userId, category))) return false;

  await tx.insert(notification).values({
    userId,
    type,
    params,
    entityType,
    entityId,
    href,
  });
  return true;
}

/**
 * Whether the email half should go out. Separate from `notify` because the two
 * halves are separately switchable, and because the email is dispatched after
 * the transaction commits while the row goes inside it.
 *
 * **Absent means on.** A user who has never opened the settings page has no
 * preference rows at all, and defaulting those to "off" would silently mute
 * every reminder the app has.
 */
export async function emailEnabled(
  tx: DbExecutor,
  userId: string,
  category: NotificationCategory,
): Promise<boolean> {
  const row = await preferenceFor(tx, userId, category);
  return row?.emailEnabled ?? true;
}

async function inAppEnabled(
  tx: DbExecutor,
  userId: string,
  category: NotificationCategory,
): Promise<boolean> {
  const row = await preferenceFor(tx, userId, category);
  return row?.inAppEnabled ?? true;
}

async function preferenceFor(
  tx: DbExecutor,
  userId: string,
  category: NotificationCategory,
) {
  return tx.query.notificationPreference.findFirst({
    where: and(
      eq(notificationPreference.userId, userId),
      eq(notificationPreference.category, category),
    ),
  });
}
