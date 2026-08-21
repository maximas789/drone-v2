import "server-only";

import { desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  city,
  drone,
  pilotProfile,
  remoteId,
  remoteIdDeclaration,
} from "@/lib/db/schema";
import { hashIdDocument } from "@/lib/id-hash";
import {
  registrationStatusOf,
  type BuildType,
  type RegistrationStatus,
  type WeightClass,
} from "@/lib/remote-id/redact";
import { isReviewer, type Session } from "@/lib/session";
import type { LookupQuery } from "./detect";

/**
 * The queries behind the lookup box. **Session first, and the guard is real** —
 * every export refuses a non-reviewer rather than trusting the page that called
 * it, because a server action is an ordinary POST and the layout that guarded
 * the page never runs for it.
 *
 * **A candidate carries no owner identity.** Not the name, not the mobile, not
 * a masked document number — nothing about a person. A partial-code search that
 * matched six aircraft would otherwise hand a reviewer six people's names for a
 * fragment they half-read, which is a browsable registry with extra steps.
 * Identity arrives only when one candidate is *opened*, and only through
 * `redactRemoteId`.
 */

export type LookupCandidate = {
  remoteIdId: string;
  code: string;
  droneId: string;
  buildType: BuildType;
  weightClass: WeightClass;
  manufacturer: string | null;
  model: string | null;
  cityNameAr: string | null;
  cityNameEn: string | null;
  registrationStatus: RegistrationStatus;
};

/** The most candidates a disambiguation list will ever show. */
const CANDIDATE_LIMIT = 25;

/**
 * One projection, six callers — so every route into the list returns the same
 * columns, and adding an identity column to one of them is impossible without
 * adding it here where the reason it must not be there is written down.
 */
async function candidatesWhere(
  where: SQL | undefined,
  now: Date,
  limit: number,
): Promise<LookupCandidate[]> {
  if (where === undefined) return [];

  const rows = await db
    .select({
      remoteIdId: remoteId.id,
      code: remoteId.code,
      remoteIdStatus: remoteId.status,
      droneId: drone.id,
      droneStatus: drone.status,
      validUntil: drone.registrationExpiresAt,
      buildType: drone.buildType,
      weightClass: drone.weightClass,
      manufacturer: drone.manufacturer,
      model: drone.model,
      cityNameAr: city.nameAr,
      cityNameEn: city.nameEn,
    })
    .from(remoteId)
    .innerJoin(drone, eq(drone.id, remoteId.droneId))
    // Left joins for the same reason `getRemoteIdRecordByCode` uses them: a
    // registration whose owner has not finished their profile still has to be
    // findable. A lookup that 500s on a null city is a lookup nobody can use.
    .leftJoin(pilotProfile, eq(pilotProfile.userId, drone.ownerUserId))
    .leftJoin(city, eq(city.id, pilotProfile.addressCityId))
    .where(where)
    .orderBy(desc(remoteId.issuedAt))
    .limit(limit);

  return rows.map((row) => ({
    remoteIdId: row.remoteIdId,
    code: row.code,
    droneId: row.droneId,
    buildType: row.buildType as BuildType,
    weightClass: row.weightClass as WeightClass,
    manufacturer: row.manufacturer,
    model: row.model,
    cityNameAr: row.cityNameAr,
    cityNameEn: row.cityNameEn,
    /**
     * The same derivation the scan page uses, not `drone.status` raw. An
     * approved registration past its expiry reads `expired` here too — the
     * clock makes a registration lapse, not the nightly sweep, and a
     * disambiguation list that said "active" until 03:00 would be wrong for
     * exactly the hours an officer is standing in a field.
     */
    registrationStatus: registrationStatusOf(row, now),
  }));
}

/**
 * `findCandidates(session, query)` — the classified term, resolved to
 * registrations.
 *
 * Returns **every** match, including none. "No registration found for this
 * identifier" is a real answer and the most useful one an officer can get; a
 * thrown error or an empty page would leave them unsure whether the tool
 * failed or the aircraft is genuinely unregistered, which is the one ambiguity
 * that matters here.
 */
export async function findCandidates(
  session: Session,
  query: LookupQuery,
  now: Date = new Date(),
  limit: number = CANDIDATE_LIMIT,
): Promise<LookupCandidate[]> {
  if (!isReviewer(session)) return [];

  switch (query.kind) {
    case "empty":
      return [];

    case "code":
      return candidatesWhere(eq(remoteId.code, query.code), now, limit);

    /**
     * The dashes are removed from the **column** before matching, so a
     * fragment that spans the group boundary — `K91XZ` out of `AJN-4F2K-91XZ`
     * — is found. Matching the stored form directly would silently miss it,
     * and an officer who read five symbols would be worse off than one who
     * read four.
     *
     * `%fragment%` rather than a prefix or a suffix: the officer does not know
     * which end of the code they managed to read.
     */
    case "partial":
      return candidatesWhere(
        sql`replace(${remoteId.code}, '-', '') ilike ${`%${query.symbols}%`}`,
        now,
        limit,
      );

    /**
     * **Hashed, never matched as digits.** `pilot_profile.id_document_number`
     * carries no index and must never be searched as text: an `ilike` over a
     * column of national IDs is a substring search across a national register,
     * and it is the one query this file must not be able to run. Hashing the
     * whole number and comparing against the unique `id_document_hash` gives an
     * exact match — and means a *partial* document search does not exist and
     * cannot be added by accident, because there is nothing to add it to.
     */
    case "national_id":
      return candidatesForOwners(
        eq(pilotProfile.idDocumentHash, hashIdDocument(query.digits)),
        now,
        limit,
      );

    case "mobile":
      return candidatesForOwners(
        eq(pilotProfile.mobileE164, query.e164),
        now,
        limit,
      );

    /**
     * Through the declaration to the registration it was declared against.
     * Superseded rows are included on purpose: a module physically bolted to an
     * airframe outlives the paperwork revision, and an officer reading a serial
     * off the hardware is asking "whose is this", not "what does the current
     * declaration say".
     */
    case "module_serial": {
      // An empty term would be `ilike '%%'` — the whole register, handed back
      // by a query that looks like a search. Refused here as well as at the
      // action, because this function is the one that touches the database.
      if (query.serial.trim() === "") return [];
      const declared = await db
        .selectDistinct({ remoteIdId: remoteIdDeclaration.remoteIdId })
        .from(remoteIdDeclaration)
        .where(ilike(remoteIdDeclaration.moduleSerial, `%${query.serial}%`))
        .limit(limit);
      if (declared.length === 0) return [];
      return candidatesWhere(
        inArray(
          remoteId.id,
          declared.map((row) => row.remoteIdId),
        ),
        now,
        limit,
      );
    }

    /**
     * Both name columns, with `ilike`. Postgres lower-cases per the database
     * collation and Arabic has no case, so this is a plain substring match on
     * the Arabic column — which is what an officer typing three letters of a
     * family name wants, in the language the name was authored in.
     */
    case "name": {
      if (query.text.trim() === "") return [];
      const like = `%${query.text}%`;
      return candidatesForOwners(
        or(
          ilike(pilotProfile.fullNameAr, like),
          ilike(pilotProfile.fullNameEn, like),
        ),
        now,
        limit,
      );
    }
  }
}

/**
 * Owner-side searches resolve to people first and then to their registrations.
 *
 * Two queries rather than one join, because the first one is the sensitive one
 * and keeping it alone makes it legible: it selects **`user_id` and nothing
 * else** off `pilot_profile`. No name, no number, nothing that could reach a
 * caller by accident.
 */
async function candidatesForOwners(
  where: SQL | undefined,
  now: Date,
  limit: number,
): Promise<LookupCandidate[]> {
  if (where === undefined) return [];

  const owners = await db
    .select({ userId: pilotProfile.userId })
    .from(pilotProfile)
    .where(where)
    .limit(limit);

  if (owners.length === 0) return [];

  return candidatesWhere(
    inArray(
      drone.ownerUserId,
      owners.map((row) => row.userId),
    ),
    now,
    limit,
  );
}
