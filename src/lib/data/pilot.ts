import "server-only";

import { asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { city, pilotProfile } from "@/lib/db/schema";
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

export async function listCities(_session: Session | null) {
  return db.query.city.findMany({ orderBy: [asc(city.nameAr)] });
}
