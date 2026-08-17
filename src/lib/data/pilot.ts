import "server-only";

import { and, asc, count, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { booking, city, pilotProfile } from "@/lib/db/schema";
import { isReviewer, type Session } from "@/lib/session";

export async function getMyProfile(session: Session) {
  return db.query.pilotProfile.findFirst({
    where: eq(pilotProfile.userId, session.user.id),
  });
}

/**
 * A booking requires a profile that is both complete and **verified by a
 * human**. Identity is never verified automatically, and nothing in this
 * codebase may imply otherwise.
 */
export async function isProfileBookable(session: Session) {
  const profile = await getMyProfile(session);
  return Boolean(profile?.completedAt && profile.verifiedAt);
}

export async function getProfileByUserId(session: Session, userId: string) {
  if (userId !== session.user.id && !isReviewer(session)) return null;
  return db.query.pilotProfile.findFirst({
    where: eq(pilotProfile.userId, userId),
  });
}

/** The identity queue: submitted, not yet decided. Reviewers only. */
export async function listPendingIdentityVerifications(
  session: Session,
  limit = 50,
) {
  if (!isReviewer(session)) return [];
  return db.query.pilotProfile.findMany({
    where: isNull(pilotProfile.verifiedAt),
    orderBy: [asc(pilotProfile.createdAt)],
    limit,
  });
}

/** The window a no-show counts against the pilot for. Ninety days, rolling. */
export const NO_SHOW_WINDOW_DAYS = 90;
/** Three strikes and auto-approve is off. */
export const NO_SHOW_LIMIT = 3;

/**
 * No-shows in the last 90 days.
 *
 * **Counted, never stored.** A boolean flag on the pilot would need a job to
 * clear it, and a job that failed would leave somebody penalised for ever. A
 * count over a rolling window self-heals: on day 91 the oldest no-show falls
 * out of the window and auto-approve comes back with nobody having to reset
 * anything.
 */
export async function countRecentNoShows(
  _session: Session | null,
  userId: string,
  now = new Date(),
): Promise<number> {
  const since = new Date(
    now.getTime() - NO_SHOW_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  const [row] = await db
    .select({ value: count() })
    .from(booking)
    .where(
      and(
        eq(booking.pilotUserId, userId),
        eq(booking.status, "no_show"),
        gte(booking.slotStart, since),
      ),
    );
  return row?.value ?? 0;
}

/**
 * Whether this pilot still gets the auto-approve fast path.
 *
 * A zone's `autoApprove` says the *place* needs no human; this says the
 * *person* has not repeatedly taken a slot and failed to turn up. Both must
 * hold — a zone that trusts everyone and a pilot who no-shows weekly is how
 * capacity gets burned by nobody flying.
 */
export async function autoApproveEligible(
  session: Session | null,
  userId: string,
  now = new Date(),
): Promise<boolean> {
  return (await countRecentNoShows(session, userId, now)) < NO_SHOW_LIMIT;
}

export async function listCities(_session: Session | null) {
  return db.query.city.findMany({ orderBy: [asc(city.nameAr)] });
}
