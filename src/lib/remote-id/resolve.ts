import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { remoteId, remoteIdScan } from "@/lib/db/schema";
import {
  getRemoteIdRecordByCode,
  listBookingsForRemoteId,
  listScansForRemoteId,
} from "@/lib/data/remote-id";
import { clientIpFrom, hashIp } from "@/lib/ip-hash";
import { enforceLimit } from "@/lib/rate-limit";
import { isAdmin, isReviewer, type Session } from "@/lib/session";
import { normalizeCode } from "./codec";
import { redactRemoteId, type RedactedRemoteId, type ViewerLevel } from "./redact";

/**
 * Resolution: code in, masked view out, scan row written.
 *
 * **Both surfaces call this and nothing else** — `/[locale]/rid/[code]` and
 * `/api/rid/[code]`. They differ in how they render the answer and in nothing
 * else, which is what makes "the JSON twin returns the same field set as the
 * page" a property of the code rather than a promise in a document.
 */

export type ResolveOutcome =
  | { ok: true; view: RedactedRemoteId }
  /**
   * **Not a 404.** "This code is not registered" is the most useful answer a
   * field inspector can get, and a 404 makes the tool look broken at exactly
   * the moment it is working correctly.
   */
  | { ok: false; reason: "not_registered"; code: string }
  /** The input was not a Remote ID at all — not even after normalisation. */
  | { ok: false; reason: "invalid_code"; code: string }
  | { ok: false; reason: "rate_limited"; retryAfterSeconds: number };

export type ResolveInput = {
  /** Whatever was in the URL. Normalised here, never by the caller. */
  rawCode: string;
  session: Session | null;
  /** The request's headers, for the IP hash and the user agent. */
  headers: Headers;
  now?: Date;
};

/**
 * The viewer level, **computed from the session and the record**.
 *
 * Never a parameter, never a header, never a query string. `owner` is not a
 * role — it is the relationship between the person asking and the drone in
 * front of them, and it is the reason this cannot be something a caller states
 * about itself.
 */
export function viewerLevelFor(
  session: Session | null,
  ownerUserId: string | null,
): ViewerLevel {
  if (!session) return "anonymous";
  if (isAdmin(session)) return "admin";
  if (isReviewer(session)) return "reviewer";
  if (ownerUserId && session.user.id === ownerUserId) return "owner";
  return "pilot";
}

export async function resolveRemoteId({
  rawCode,
  session,
  headers,
  now = new Date(),
}: ResolveInput): Promise<ResolveOutcome> {
  const ip = clientIpFrom(headers);
  /**
   * No header, no hash. Bucketing every header-less request under `"unknown"`
   * would rate-limit the whole internet as one client, and writing `"unknown"`
   * into a scan row would be a fact nobody can use. Local development is the
   * usual case for this.
   */
  const ipHash = ip ? hashIp(ip) : null;
  const userAgent = headers.get("user-agent");

  if (ipHash) {
    const limit = await enforceLimit("rid.resolve", "ip", ipHash, now);
    if (!limit.ok) {
      return {
        ok: false,
        reason: "rate_limited",
        retryAfterSeconds: limit.retryAfterSeconds,
      };
    }
  }

  const code = normalizeCode(rawCode);
  if (!code) {
    /**
     * A malformed code is still logged. A run of them is precisely the
     * enumeration attempt `remote_id_scan` exists to make visible, and
     * discarding it would leave the one signal worth having on the floor.
     */
    await logScan({
      remoteIdId: null,
      scannedCode: truncate(rawCode),
      session,
      level: viewerLevelFor(session, null),
      ipHash,
      userAgent,
    });
    return { ok: false, reason: "invalid_code", code: truncate(rawCode) };
  }

  const record = await getRemoteIdRecordByCode(session, code, now);
  if (!record) {
    await logScan({
      remoteIdId: null,
      scannedCode: code,
      session,
      level: viewerLevelFor(session, null),
      ipHash,
      userAgent,
    });
    return { ok: false, reason: "not_registered", code };
  }

  const level = viewerLevelFor(session, record.ownerUserId);

  // Both scoped by the session, in the data layer — see the note there on why
  // the record itself is not.
  const [bookings, scans] = await Promise.all([
    listBookingsForRemoteId(session, {
      remoteIdId: record.remoteIdId,
      ownerUserId: record.ownerUserId,
    }),
    listScansForRemoteId(session, record.remoteIdId),
  ]);

  await logScan({
    remoteIdId: record.remoteIdId,
    scannedCode: code,
    session,
    level,
    ipHash,
    userAgent,
  });

  return {
    ok: true,
    view: redactRemoteId({ ...record, bookings, scans }, level, now),
  };
}

/**
 * One scan row, plus the counter on the code itself.
 *
 * In a transaction because they are one fact: a resolution that incremented the
 * counter but left no row would be a resolution nobody can attribute, which is
 * the opposite of what this table is for.
 *
 * The scan log is written **after** the read and **before** the answer is
 * returned. It does not carry the reveal — that is `revealIdentity`'s row to
 * flip, in its own transaction alongside the audit event.
 */
async function logScan({
  remoteIdId,
  scannedCode,
  session,
  level,
  ipHash,
  userAgent,
}: {
  remoteIdId: string | null;
  scannedCode: string;
  session: Session | null;
  level: ViewerLevel;
  ipHash: string | null;
  userAgent: string | null;
}): Promise<string | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(remoteIdScan)
      .values({
        remoteIdId,
        scannedCode,
        viewerUserId: session?.user.id ?? null,
        viewerLevel: level,
        ipHash,
        userAgent,
      })
      .returning({ id: remoteIdScan.id });

    if (remoteIdId) {
      await tx
        .update(remoteId)
        .set({
          resolveCount: sql`${remoteId.resolveCount} + 1`,
          lastResolvedAt: new Date(),
        })
        .where(eq(remoteId.id, remoteIdId));
    }

    return row?.id ?? null;
  });
}

/** A scanned code column is not a place to store an arbitrary URL segment. */
function truncate(value: string): string {
  return value.slice(0, 32);
}
