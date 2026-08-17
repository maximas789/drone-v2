"use server";

import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { refuse, refuseWith, type ActionResult } from "@/lib/actions/result";
import { audit, type Actor } from "@/lib/audit";
import { requireReviewer, getSession } from "@/lib/auth-guards";
import { db, type DbExecutor } from "@/lib/db";
import { droneReport, remoteId, remoteIdScan } from "@/lib/db/schema";
import { getRemoteIdRecordByCode } from "@/lib/data/remote-id";
import { clientIpFrom, hashIp } from "@/lib/ip-hash";
import { enforceLimit } from "@/lib/rate-limit";
import { normalizeCode } from "@/lib/remote-id/codec";
import { viewerLevelFor } from "@/lib/remote-id/resolve";
import { roleOf } from "@/lib/session";

/**
 * The two acts that a scan page can trigger. Resolution itself is not here — it
 * happens as the page renders, in `src/lib/remote-id/resolve.ts`.
 *
 * Each guard is repeated inside the action **on purpose**: an action is an
 * ordinary POST to a URL, invokable with `fetch` by anyone holding its id, and
 * the layout that guarded the page it was rendered on never runs.
 */

const MIN_REASON_LENGTH = 10;
const MIN_DESCRIPTION_LENGTH = 10;
const MAX_TEXT_LENGTH = 2_000;

export type RevealedIdentity = {
  ownerNameAr: string | null;
  ownerNameEn: string | null;
  ownerMobile: string | null;
  ownerIdDocumentType: string | null;
  /** The **whole** number. This is the only place it ever leaves the database. */
  ownerIdDocumentNumber: string | null;
};

/**
 * Reveal the owner behind a Remote ID.
 *
 * ```
 * requireReviewer() → rateLimit(20/hr) → a written reason, at least 10 chars
 *   → audit_event 'remote_id.identity_revealed'   ← written BEFORE the return
 *   → remote_id_scan.revealedIdentity = true
 *   → the unmasked identity
 * ```
 *
 * **The log write happens first, in the same transaction.** If it fails, the
 * reveal fails and nothing comes back: a reveal that is not logged did not
 * happen, and the alternative — returning the identity and hoping the log
 * catches up — is the exact failure this feature exists to make impossible.
 */
export async function revealIdentityAction(
  code: string,
  reason: string,
): Promise<ActionResult<RevealedIdentity>> {
  const session = await requireReviewer();

  const limit = await enforceLimit("identity.reveal", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const written = reason.trim();
  if (written.length < MIN_REASON_LENGTH || written.length > MAX_TEXT_LENGTH) {
    return refuse("reveal_reason_required");
  }

  const normalized = normalizeCode(code);
  if (!normalized) return refuse("not_found");

  const record = await getRemoteIdRecordByCode(session, normalized);
  if (!record) return refuse("not_found");

  const actor: Actor = {
    userId: session.user.id,
    role: roleOf(session),
    isSystem: false,
  };
  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders);

  try {
    await db.transaction(async (tx) => {
      await audit(tx, {
        actor,
        entityType: "remote_id",
        entityId: record.remoteIdId,
        action: "remote_id.identity_revealed",
        after: { code: record.code, droneId: record.droneId },
        reason: written,
        ipHash: ip ? hashIp(ip) : null,
        userAgent: requestHeaders.get("user-agent"),
      });

      await markScanRevealed(tx, record.remoteIdId, session.user.id, {
        code: record.code,
        level: viewerLevelFor(session, record.ownerUserId),
        ipHash: ip ? hashIp(ip) : null,
        userAgent: requestHeaders.get("user-agent"),
      });
    });
  } catch (caught) {
    // Loud, and empty-handed. The identity is not returned on any path where
    // the trail did not commit.
    console.error("[remote-id] identity reveal was not logged:", caught);
    return refuse("reveal_not_logged");
  }

  return {
    ok: true,
    data: {
      ownerNameAr: record.ownerNameAr,
      ownerNameEn: record.ownerNameEn,
      ownerMobile: record.ownerMobile,
      ownerIdDocumentType: record.ownerIdDocumentType,
      ownerIdDocumentNumber: record.ownerIdDocumentNumber,
    },
  };
}

/**
 * The reveal is recorded against the scan that prompted it — the reviewer's own
 * most recent resolution of this code. If there is none (a reveal driven
 * straight at the action rather than from the page), a row is written so the
 * act is still visible; a reveal with no scan row at all would be invisible in
 * the one table built to show them.
 */
async function markScanRevealed(
  tx: DbExecutor,
  remoteIdId: string,
  viewerUserId: string,
  fallback: {
    code: string;
    level: ReturnType<typeof viewerLevelFor>;
    ipHash: string | null;
    userAgent: string | null;
  },
): Promise<void> {
  const [latest] = await tx
    .select({ id: remoteIdScan.id })
    .from(remoteIdScan)
    .where(
      and(
        eq(remoteIdScan.remoteIdId, remoteIdId),
        eq(remoteIdScan.viewerUserId, viewerUserId),
      ),
    )
    .orderBy(desc(remoteIdScan.createdAt))
    .limit(1);

  if (latest) {
    await tx
      .update(remoteIdScan)
      .set({ revealedIdentity: true })
      .where(eq(remoteIdScan.id, latest.id));
    return;
  }

  await tx.insert(remoteIdScan).values({
    remoteIdId,
    scannedCode: fallback.code,
    viewerUserId,
    viewerLevel: fallback.level,
    ipHash: fallback.ipHash,
    userAgent: fallback.userAgent,
    revealedIdentity: true,
  });
}

export type ReportInput = {
  code: string;
  description: string;
  locationNote?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
};

/**
 * "Report this drone", from the anonymous scan page.
 *
 * **No session required, and nothing about the owner is read.** The reporter is
 * a bystander who can see an aircraft; they learn nothing by filing, and the
 * reviewer gets the code, the description and wherever the reporter said they
 * were.
 *
 * The code need not resolve. An unregistered one is the more interesting
 * report, not the one to throw away — which is also what makes this the same
 * action F24's "report unregistered drone" will file through.
 */
export async function reportDroneAction(
  input: ReportInput,
): Promise<ActionResult<{ reportId: string }>> {
  const session = await getSession();
  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders);
  const ipHash = ip ? hashIp(ip) : null;

  /**
   * Keyed on the account where there is one, and on the IP hash otherwise. An
   * anonymous action with no limit at all is a queue-flooding tool.
   */
  const limit = session
    ? await enforceLimit("rid.report", "user", session.user.id)
    : ipHash
      ? await enforceLimit("rid.report", "ip", ipHash)
      : { ok: true as const };
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const description = input.description.trim();
  if (
    description.length < MIN_DESCRIPTION_LENGTH ||
    description.length > MAX_TEXT_LENGTH
  ) {
    return refuse("report_description_required");
  }

  const locationNote = input.locationNote?.trim().slice(0, MAX_TEXT_LENGTH) || null;
  const lat = validCoordinate(input.locationLat, 90);
  const lng = validCoordinate(input.locationLng, 180);

  const normalized = normalizeCode(input.code);
  const reportedCode = normalized ?? input.code.slice(0, 32);

  const match = normalized
    ? await db.query.remoteId.findFirst({
        where: eq(remoteId.code, normalized),
        columns: { id: true },
      })
    : null;

  const reportId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(droneReport)
      .values({
        remoteIdId: match?.id ?? null,
        reportedCode,
        description,
        locationNote,
        locationLat: lat,
        locationLng: lng,
        reporterUserId: session?.user.id ?? null,
        ipHash,
        userAgent: requestHeaders.get("user-agent"),
      })
      .returning({ id: droneReport.id });

    if (!row) throw new Error("drone_report insert returned no row");

    await audit(tx, {
      actor: {
        userId: session?.user.id ?? null,
        role: session ? roleOf(session) : null,
        isSystem: false,
      },
      entityType: "remote_id",
      // The code, when nothing resolved — an entity id that points at nothing
      // would be worse than the string that was actually reported.
      entityId: match?.id ?? reportedCode,
      action: "remote_id.reported",
      after: { reportId: row.id, reportedCode, resolved: Boolean(match) },
      ipHash,
      userAgent: requestHeaders.get("user-agent"),
    });

    return row.id;
  });

  // Nothing about the owner comes back. The reporter is told it was filed.
  return { ok: true, data: { reportId } };
}

function validCoordinate(value: unknown, bound: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.abs(value) <= bound ? value : null;
}
