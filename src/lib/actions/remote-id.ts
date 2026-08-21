"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull } from "drizzle-orm";
import { refuse, refuseWith, type ActionResult } from "@/lib/actions/result";
import { audit, type Actor } from "@/lib/audit";
import { getSession } from "@/lib/auth-guards";
import { db, type DbExecutor } from "@/lib/db";
import {
  drone,
  droneReport,
  remoteId,
  remoteIdDeclaration,
  remoteIdScan,
} from "@/lib/db/schema";
import { getRemoteIdRecordByCode } from "@/lib/data/remote-id";
import { clientIpFrom, hashIp } from "@/lib/ip-hash";
import { enforceLimit } from "@/lib/rate-limit";
import { storeQrForRemoteId } from "@/lib/qr/store";
import { normalizeCode } from "@/lib/remote-id/codec";
import { viewerLevelFor } from "@/lib/remote-id/resolve";
import { isReviewer, roleOf } from "@/lib/session";
import { validateDeclaration } from "@/lib/validation/declaration";
import { acceptsDeclarations } from "@/lib/validation/drone";

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
 * reviewer guard → rateLimit(20/hr) → a written reason, at least 10 chars
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
  /**
   * **A refusal, not `requireReviewer()`** — changed in F24, which drove this
   * action from `/admin/lookup` and found the shape wrong. The guard did its
   * job: a pilot POSTing it directly got a 404 and no identity. But it got
   * there by *throwing* `notFound()`, and rule 10 says a refusal is never an
   * exception — a thrown 404 inside a `startTransition` reaches the caller as
   * an error boundary rather than as a message it can read.
   *
   * `not_found`, never `forbidden`: telling somebody the route exists is
   * telling them something. The session is still read here rather than trusted
   * from the layout, which never runs for a POST.
   */
  const session = await getSession();
  if (!session) return refuse("not_authenticated");
  if (!isReviewer(session)) return refuse("not_found");

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

/**
 * Re-render the QR for one aircraft — the card's "generating…" retry.
 *
 * ```
 * requireUser() → rateLimit(10/hr) → owner (or admin) → approved, with a code
 *   → storeQrForRemoteId()  ← the SAME path the approval job runs
 *   → revalidatePath()
 * ```
 *
 * **Inline, not an Inngest event.** F19 specifies the *approval* render as a
 * job, and it stays one: nobody is watching, so a transient storage failure has
 * to retry itself. This is the other case — a person looking at a card with no
 * QR on it, pressing a button. Queueing that would answer them with a spinner
 * and no outcome, and it would answer them with *nothing at all* whenever
 * Inngest is the thing that is down, which is precisely when a QR goes missing.
 * Pressing it here either produces the image or produces a refusal they can
 * read. It is not a second renderer: `storeQrForRemoteId` is one function with
 * two callers.
 *
 * **Owner or admin**, and a reviewer is deliberately not enough: this writes to
 * the pilot's registration and their airframe is what carries the result.
 */
export async function regenerateQrAction(
  droneId: string,
): Promise<ActionResult<{ pathname: string }>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");

  const limit = await enforceLimit("remote_id.qr_render", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const row = await db.query.drone.findFirst({
    where: eq(drone.id, droneId),
    columns: { id: true, ownerUserId: true, status: true },
  });

  /**
   * "Not yours" and "does not exist" answer identically, as everywhere else a
   * drone id appears in a URL — distinguishing them lets anyone holding an id
   * learn whether it is real.
   */
  if (!row) return refuse("not_found");
  if (row.ownerUserId !== session.user.id && roleOf(session) !== "admin") {
    return refuse("not_found");
  }

  // The QR resolves to a public record. A drone that is not approved has no
  // record to resolve to, so there is nothing legitimate to render.
  if (row.status !== "approved") return refuse("not_approved");

  const rid = await db.query.remoteId.findFirst({
    where: eq(remoteId.droneId, droneId),
    columns: { id: true, code: true },
  });
  if (!rid) return refuse("not_found");

  let pathname: string;
  try {
    pathname = await storeQrForRemoteId({ remoteIdId: rid.id, code: rid.code });
  } catch (caught) {
    /**
     * Storage refused, or the encoder did. **A refusal, not a crash** — the
     * pilot pressed a button and is owed an answer, and the answer is "not
     * this time", which they can act on by pressing it again.
     */
    console.error("[remote-id] QR render failed for", rid.code, caught);
    return refuse("qr_render_failed");
  }

  revalidatePath(`/[locale]/drones/${droneId}/remote-id`, "page");

  return { ok: true, data: { pathname } };
}

export type DeclareModuleInput = {
  droneId: string;
  kind: string;
  manufacturer?: string | null;
  moduleSerial?: string | null;
  docReference?: string | null;
};

/**
 * Declare a Remote ID module against an approved registration.
 *
 * ```
 * requireUser() → rateLimit(10/hr) → parse → owner, approved, has a Remote ID
 *   → supersede the current declaration + insert the new one + audit,
 *     in ONE transaction
 *   → revalidatePath()
 * ```
 *
 * **It supersedes rather than edits.** `remote_id_declaration` is a history
 * table on purpose — the regulator's question is "what was broadcasting on 3
 * March", which needs rows with validity windows, not a row the next correction
 * overwrites. So declaring again marks the old row `supersededAt` and writes a
 * new one; nothing is ever deleted and nothing is ever rewritten.
 *
 * **The new row is unverified, and that is the whole point of the state.** A
 * pilot's claim about what their aircraft broadcasts is a claim until a human
 * checks the document behind it. `verifiedAt` is null here and only F22 may set
 * it — this action never writes it, whatever the input says, because the input
 * cannot say it.
 *
 * **No notification.** The only person who would be told is the person who just
 * pressed the button; the reviewer-facing side is F22's queue, which does not
 * exist, and a notification row addressed to nobody is not a queue. The audit
 * event is written either way — a declaration is a regulator-facing claim, and
 * the trail is where it belongs.
 */
export async function declareModuleAction(
  input: DeclareModuleInput,
): Promise<ActionResult<{ declarationId: string }>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");

  const limit = await enforceLimit("declaration.create", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const verdict = validateDeclaration(input);
  if (!verdict.ok) return refuse(...verdict.codes);
  const { kind, manufacturer, moduleSerial, docReference } = verdict.fields;

  const droneRow = await db.query.drone.findFirst({
    where: eq(drone.id, input.droneId),
    columns: { id: true, ownerUserId: true, status: true },
  });
  if (!droneRow || droneRow.ownerUserId !== session.user.id) return refuse("not_found");
  if (!acceptsDeclarations(droneRow.status)) return refuse("not_approved");

  const rid = await db.query.remoteId.findFirst({
    where: eq(remoteId.droneId, input.droneId),
    columns: { id: true },
  });
  if (!rid) return refuse("not_found");

  try {
    const declarationId = await db.transaction(async (tx) => {
      /**
       * Supersede first, then insert. The partial unique index is on
       * `(kind, module_serial) where superseded_at is null`, so re-declaring
       * the *same* module would collide with the row it is replacing if the
       * order were reversed.
       */
      await tx
        .update(remoteIdDeclaration)
        .set({ supersededAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(remoteIdDeclaration.remoteIdId, rid.id),
            isNull(remoteIdDeclaration.supersededAt),
          ),
        );

      const [row] = await tx
        .insert(remoteIdDeclaration)
        .values({
          remoteIdId: rid.id,
          kind,
          manufacturer,
          moduleSerial,
          docReference,
        })
        .returning({ id: remoteIdDeclaration.id });

      if (!row) throw new Error("remote_id_declaration insert returned no row");

      await audit(tx, {
        actor: {
          userId: session.user.id,
          role: roleOf(session),
          isSystem: false,
        },
        entityType: "remote_id",
        entityId: rid.id,
        action: "remote_id.module_declared",
        after: {
          declarationId: row.id,
          kind,
          manufacturer,
          moduleSerial,
          docReference,
        },
      });

      return row.id;
    });

    revalidatePath(`/[locale]/drones/${input.droneId}/remote-id`, "page");
    return { ok: true, data: { declarationId } };
  } catch (caught) {
    /**
     * The partial unique index refusing a module serial that another live
     * declaration already claims. **A refusal, not a 500**: one physical module
     * broadcasts one identity, so two aircraft claiming it is a real thing to
     * say no to, and the pilot needs to read it rather than see a crash.
     */
    if (isModuleSerialTaken(caught)) return refuse("module_serial_claimed");
    throw caught;
  }
}

/**
 * The partial unique index on `(kind, module_serial) where superseded_at is
 * null`, refusing a serial another live declaration already holds.
 *
 * **Two things had to be right here, and the first one was not.** Drizzle wraps
 * driver errors in a `DrizzleQueryError`, so the postgres.js error — the one
 * carrying `code` and `constraint_name` — is on `.cause`, not on the error
 * itself. Checking the top level found nothing, the `catch` re-threw, and the
 * action answered a legitimate refusal with a server error. Found by declaring
 * the same module serial on a second aircraft.
 *
 * And it matches **this constraint by name**, not merely `23505`. Any future
 * unique index on this table would otherwise be reported to a pilot as "that
 * serial is already declared", which would be a confident lie about a different
 * problem.
 */
const ACTIVE_MODULE_CONSTRAINT = "remote_id_decl_active_module_uniq";

function isModuleSerialTaken(caught: unknown): boolean {
  for (let error: unknown = caught; error != null; error = (error as { cause?: unknown }).cause) {
    if (typeof error !== "object") break;
    const candidate = error as { code?: unknown; constraint_name?: unknown };
    if (
      candidate.code === "23505" &&
      candidate.constraint_name === ACTIVE_MODULE_CONSTRAINT
    ) {
      return true;
    }
  }
  return false;
}
