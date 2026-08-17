"use server";

import { revalidatePath } from "next/cache";
import { refuse, refuseWith, type ActionResult } from "@/lib/actions/result";
import { getSession } from "@/lib/auth-guards";
import {
  markAllNotificationsRead,
  markNotificationRead,
  setMyPreference,
} from "@/lib/data/notification";
import type { NotificationCategory } from "@/lib/notify";
import { notificationCategory } from "@/lib/db/enums";
import { enforceLimit } from "@/lib/rate-limit";

/**
 * Marking notifications read, and choosing which ones arrive at all.
 *
 * The guard is repeated in each **on purpose**: an action is an ordinary POST
 * to a URL, invokable with `fetch` by anyone holding the action id, and
 * whatever layout guarded the page it was rendered on never runs. Ownership is
 * enforced a second time inside the `where` clause of every write, so a
 * forged id updates zero rows rather than somebody else's.
 */

export async function markNotificationReadAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");

  const limit = await enforceLimit("notification.read", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  // Not yours, or not there. One answer, so the refusal cannot be used to find
  // out which — the same shape as every other ownership refusal in this app.
  if (!(await markNotificationRead(session, id))) return refuse("not_found");

  revalidatePath("/[locale]/notifications", "page");
  return { ok: true, data: { id } };
}

export async function markAllNotificationsReadAction(): Promise<
  ActionResult<{ count: number }>
> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");

  const limit = await enforceLimit("notification.read", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const count = await markAllNotificationsRead(session);

  revalidatePath("/[locale]/notifications", "page");
  return { ok: true, data: { count } };
}

/**
 * Switching a category on or off.
 *
 * **Only three categories exist**, and they are the three that are genuinely
 * optional: booking reminders, expiry warnings, and closure notices. A decision
 * — approved, rejected, revoked — carries no category at all, which is what
 * makes it unswitchable-off by construction rather than by a rule somebody
 * has to remember. Letting a pilot unsubscribe from "your registration was
 * rejected" would be a compliance failure dressed up as a preference.
 */
export async function setNotificationPreferenceAction(
  category: string,
  values: { emailEnabled?: boolean; inAppEnabled?: boolean },
): Promise<ActionResult<{ category: string }>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");

  const limit = await enforceLimit("notification.read", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  if (!isCategory(category)) return refuse("invalid_category");

  await setMyPreference(session, category, {
    emailEnabled: values.emailEnabled,
    inAppEnabled: values.inAppEnabled,
  });

  revalidatePath("/[locale]/notifications", "page");
  return { ok: true, data: { category } };
}

/** Narrowed against the enum itself, so a new category cannot be forgotten here. */
function isCategory(value: string): value is NotificationCategory {
  return (notificationCategory.enumValues as readonly string[]).includes(value);
}
