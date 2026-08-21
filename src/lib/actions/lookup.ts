"use server";

import { headers } from "next/headers";
import { refuse, refuseWith, type ActionResult } from "@/lib/actions/result";
import { audit, type Actor } from "@/lib/audit";
import { getSession } from "@/lib/auth-guards";
import type { TrailEvent } from "@/components/admin/audit-trail";
import { listAuditForDrone } from "@/lib/data/review";
import { db } from "@/lib/db";
import { clientIpFrom, hashIp } from "@/lib/ip-hash";
import {
  detectLookup,
  partialSymbols,
  MAX_LOOKUP_LENGTH,
  type LookupKind,
  type LookupQuery,
} from "@/lib/lookup/detect";
import { findCandidates, type LookupCandidate } from "@/lib/lookup/search";
import { enforceLimit } from "@/lib/rate-limit";
import type { RedactedRemoteId } from "@/lib/remote-id/redact";
import { normalizeCode } from "@/lib/remote-id/codec";
import { resolveRemoteId } from "@/lib/remote-id/resolve";
import { isReviewer, roleOf, type Session } from "@/lib/session";

/**
 * The compliance spot-check. One box, and the server works out what it was
 * given.
 *
 * ```
 * reviewer guard → rateLimit(60/min) → detect → search
 *   → audit_event 'remote_id.lookup'   ← written even when nothing matched
 *   → one result | several candidates | none
 * ```
 *
 * **The reveal and the report are not here.** `revealIdentityAction` and
 * `reportDroneAction` already exist in `src/lib/actions/remote-id.ts`, written
 * by F11 against a code — which is exactly the shape this page needs. A second
 * reveal path would be a second place the "log before you return" discipline
 * has to be right, and the whole point of that discipline is that it lives in
 * one function. F24's spec lists them under `lookup.ts`; they are reused
 * instead, and the build log records why.
 */

/** How the term was read, and what came back. */
export type LookupOutcome = {
  kind: LookupKind;
  /**
   * The full masked record — **only when exactly one registration matched.**
   * Several candidates get a disambiguation list with no owner identity on it.
   */
  view: RedactedRemoteId | null;
  candidates: LookupCandidate[];
  /**
   * The aircraft's audit trail, alongside the record — **empty unless exactly
   * one registration resolved.** A field officer's question is often "has
   * anything happened to this registration", and sending them to a second
   * screen for it means the answer arrives after they have walked away.
   */
  trail: TrailEvent[];
  /**
   * What the officer typed, echoed back so the "no registration found" line and
   * the report action can name it. Normalised where it normalised.
   */
  echo: string;
};

/**
 * A reviewer may override the classifier — **the escape hatch that lets it be
 * decisive.**
 *
 * The Crockford alphabet is 32 symbols of ordinary Latin, so text and codes
 * genuinely collide. `MZKT` is four symbols and also four letters of a name.
 * Worse, **`Alshehri` is eight** — `A L S H E H R I`, every one of them in the
 * alphabet once `L` and `I` map to `1` — so a family name typed into this box
 * normalises to a valid Remote ID and is read as a code. That is not a bug in
 * `normalizeCode`: code-first is the correct order on a page whose common case
 * is a sticker, and the alternative (demanding the term carry a digit) would
 * refuse about one real code in twenty typed without its prefix.
 *
 * So the classifier stays decisive, the screen **says how it read the term**,
 * and this is the control that re-runs it the other way.
 *
 * **A national ID and a mobile number are on neither list.** Re-running one as
 * free text would put an identity document into an `ilike` across the register
 * — the single query this feature must not be able to run — so neither can be
 * overridden and neither can be the target of an override.
 */
const OVERRIDABLE: readonly LookupKind[] = [
  "code",
  "partial",
  "module_serial",
  "name",
];

export async function lookupAction(
  term: string,
  forceKind?: LookupKind,
): Promise<ActionResult<LookupOutcome>> {
  /**
   * **A refusal, not `requireReviewer()`.** The guard reads the session again
   * here rather than trusting the layout — an action is an ordinary POST and
   * the layout never runs for it — but it answers with `{ ok: false }` rather
   * than `notFound()`, because rule 10 says a refusal is never an exception and
   * a thrown 404 inside a transition reaches the caller as an error boundary
   * instead of a message. `not_found`, never `forbidden`: telling somebody the
   * route exists is telling them something.
   */
  const session = await getSession();
  if (!session) return refuse("not_authenticated");
  if (!isReviewer(session)) return refuse("not_found");

  const limit = await enforceLimit("admin.lookup", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const raw = typeof term === "string" ? term.slice(0, MAX_LOOKUP_LENGTH) : "";
  const detected = detectLookup(raw);

  if (detected.kind === "empty") {
    // Not a search. Nothing is queried and nothing is logged — an audit row
    // saying a reviewer pressed Enter on an empty box is noise in the one
    // table that has to stay readable.
    return {
      ok: true,
      data: { kind: "empty", view: null, candidates: [], trail: [], echo: "" },
    };
  }

  const query = override(raw, detected, forceKind);
  const candidates = await findCandidates(session, query);

  await logLookup(session, query.kind, candidates.length);

  /**
   * Exactly one match resolves the whole record — **through
   * `resolveRemoteId`, the same function the public scan page calls.** Not a
   * bespoke select: F11's masking table is enforced by one function taking one
   * computed viewer level, and a second query here would be the first step of
   * the drift that whole file exists to prevent.
   *
   * It also means a reviewer's lookup is written to `remote_id_scan` like any
   * other resolution, which is what `revealIdentityAction` attaches a
   * subsequent reveal to.
   */
  if (candidates.length === 1) {
    const [only] = candidates;
    const outcome = await resolveRemoteId({
      rawCode: only.code,
      session,
      headers: await headers(),
    });

    if (outcome.ok) {
      /**
       * The **same** trail query the drone review screen runs — keyed on the
       * drone id *and* the Remote ID id, because the two carry different halves
       * of the history. Reading only the drone would omit the issue, the
       * suspensions and every identity reveal, which are precisely the rows a
       * field officer is asking about.
       */
      return {
        ok: true,
        data: {
          kind: query.kind,
          view: outcome.view,
          candidates,
          trail: await listAuditForDrone(session, only.droneId, only.remoteIdId),
          echo: echoOf(query),
        },
      };
    }

    /**
     * The row was found a moment ago and will not resolve now. The honest
     * answer is the candidate list — the officer still gets the code and can
     * try again — rather than a "not found" that contradicts the search that
     * just succeeded.
     */
    if (outcome.reason === "rate_limited") {
      return refuseWith("rate_limited", {
        retryAfterSeconds: outcome.retryAfterSeconds,
      });
    }
  }

  return {
    ok: true,
    data: {
      kind: query.kind,
      view: null,
      candidates,
      trail: [],
      echo: echoOf(query),
    },
  };
}

/**
 * Open one candidate off the disambiguation list.
 *
 * A second action rather than a link, for the same reason the search is a POST:
 * a code in a URL is a code in the browser history and the server's access log,
 * and the point of a disambiguation list is that the officer has not yet
 * decided which aircraft they are asking about.
 *
 * It logs its own `remote_id.lookup` event with kind `code`. Opening a
 * candidate *is* a lookup, and one that left no trace would be the hole in
 * "an admin can see who searched for what".
 */
export async function openCandidateAction(
  code: string,
): Promise<ActionResult<LookupOutcome>> {
  return lookupAction(typeof code === "string" ? code : "", "code");
}

/**
 * **The raw term is re-read, not the detected one.** A term detected as a code
 * has already been normalised to `AJN-1LSH-EHR1`; re-running *that* as a name
 * would search the register for a string nobody is called. The override goes
 * back to what the reviewer actually typed.
 *
 * The *source* kind must be overridable as well as the target: without that, a
 * national ID re-run as a name would reach the text search and hand back a
 * slice of the register for a query that should never have run.
 */
function override(
  raw: string,
  detected: LookupQuery,
  forceKind?: LookupKind,
): LookupQuery {
  if (!forceKind || forceKind === detected.kind) return detected;
  if (!OVERRIDABLE.includes(forceKind)) return detected;
  if (!OVERRIDABLE.includes(detected.kind)) return detected;

  const text = raw.trim();
  if (text === "") return detected;

  switch (forceKind) {
    case "name":
      return { kind: "name", text };
    case "module_serial":
      return { kind: "module_serial", serial: text };
    case "partial": {
      const symbols = partialSymbols(text);
      return symbols ? { kind: "partial", symbols } : detected;
    }
    case "code": {
      const code = normalizeCode(text);
      return code ? { kind: "code", code } : detected;
    }
    default:
      return detected;
  }
}

/**
 * The normalised term, for the screen and for the report action. **Never
 * logged**, and **empty for a national ID or a mobile number.**
 *
 * The echo is what pre-fills `reportDroneAction`'s `code`, which is a stored
 * column. A national ID echoed back and then filed as a "reported code" would
 * put an identity document in `drone_report` — personal data written into a
 * table built for the opposite purpose, by a route nobody would think to check.
 * The reviewer typed the number and can see it in their own box; it does not
 * need to make a round trip to be shown back to them.
 */
function echoOf(query: LookupQuery): string {
  switch (query.kind) {
    case "empty":
    case "national_id":
    case "mobile":
      return "";
    case "code":
      return query.code;
    case "partial":
      return query.symbols;
    case "module_serial":
      return query.serial;
    case "name":
      return query.text;
  }
}

/**
 * **Every search is logged, including one that found nothing** — and the row
 * carries the query *kind*, never the query.
 *
 * A national ID or a mobile number written into `audit_event` would be
 * unhashed personal data in the regulator's trail, sitting there for searches
 * that matched nobody. That is exactly backwards: the point of logging a
 * lookup is to hold the *reviewer* accountable, not to accumulate a second
 * register of the people they looked for.
 *
 * `entityType: "user"` with the reviewer's own id, because that is what the
 * row is about — this reviewer performed a search. Filing it under a
 * `remote_id` would be impossible for the searches that resolved to nothing,
 * which are precisely the ones worth seeing.
 */
async function logLookup(
  session: Session,
  kind: LookupKind,
  resultCount: number,
): Promise<void> {
  const actor: Actor = {
    userId: session.user.id,
    role: roleOf(session),
    isSystem: false,
  };
  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders);

  await db.transaction(async (tx) => {
    await audit(tx, {
      actor,
      entityType: "user",
      entityId: session.user.id,
      action: "remote_id.lookup",
      after: { queryType: kind, resultCount },
      ipHash: ip ? hashIp(ip) : null,
      userAgent: requestHeaders.get("user-agent"),
    });
  });
}
