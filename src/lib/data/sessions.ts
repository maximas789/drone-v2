import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { Session } from "@/lib/session";
import { describeUserAgent, type DeviceSummary } from "@/lib/settings/user-agent";

/**
 * The devices signed in to this account.
 *
 * **Read through `auth.api`, not through Drizzle.** The `session` table is
 * Better Auth's (rule 4: its generated tables stay exactly as the CLI wrote
 * them), and it owns what counts as live — expiry, and whatever its own
 * session strategy adds later. Selecting the rows ourselves would work today
 * and quietly start listing expired sessions the first time that changes.
 *
 * The session argument is still first and still unused for scoping, because
 * `listSessions` scopes to the caller's own headers: this function *cannot*
 * return another account's sessions, which is a stronger guarantee than a
 * `where` clause we wrote. It is taken so this reader looks like every other
 * one in this folder, and so a caller cannot forget it is session-scoped.
 */

export type SessionSummary = {
  /** Better Auth's session token — what `revokeSession` takes. */
  token: string;
  device: DeviceSummary;
  /**
   * **Raw, not hashed.** Every table this app owns stores `sha256(pepper + ip)`;
   * Better Auth's `session` does not, and rule 4 says its schema is not ours to
   * change. This page is the one place that address surfaces in the UI — and it
   * surfaces only to the person whose session it is. The privacy policy names
   * this exception twice for the same reason.
   */
  ipAddress: string | null;
  /** Better Auth touches this on use, so it reads as "last active". */
  lastActive: Date;
  expiresAt: Date;
  /**
   * The one being used to read this page. **Decided here, from the token**, not
   * from a heuristic about which row is newest — two sessions can be seconds
   * apart, and revoking the wrong one signs somebody out mid-task.
   */
  isCurrent: boolean;
};

/**
 * **`listSessions` refuses a session older than 24 hours**, and finding that
 * out cost a blank page.
 *
 * Better Auth puts `/list-sessions` behind `freshSessionMiddleware`: if
 * `session.freshAge` is non-zero — it defaults to `3600 * 24` and this app does
 * not override it — an older session gets a 403 `SESSION_NOT_FRESH`, thrown,
 * not returned. Called straight from a Server Component that throw is an
 * unhandled error and the whole page renders as nothing at all.
 *
 * The freshness rule is **right and is left alone**: a stolen laptop should not
 * be able to enumerate and revoke the real owner's other devices days later.
 * What was wrong was the handling. So the refusal becomes a value the page can
 * render — *sign in again to manage your devices* — instead of an exception.
 *
 * Note the asymmetry, which is Better Auth's and not ours: **revoking** is
 * behind `sensitiveSessionMiddleware`, which requires a valid session but not a
 * fresh one. So a stale session cannot *see* the list but could still revoke a
 * token it already knew. That is why `revokeSessionAction` has its own guard
 * rather than trusting that the reader gated it.
 */
export type SessionListResult =
  | { ok: true; sessions: SessionSummary[] }
  | { ok: false; reason: "not_fresh" };

function isNotFresh(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const body = (error as { body?: { code?: unknown } }).body;
  return body?.code === "SESSION_NOT_FRESH";
}

export async function listMySessions(
  _session: Session,
): Promise<SessionListResult> {
  const requestHeaders = await headers();

  let rows: Awaited<ReturnType<typeof auth.api.listSessions>>;
  let current: Awaited<ReturnType<typeof auth.api.getSession>>;
  try {
    [rows, current] = await Promise.all([
      auth.api.listSessions({ headers: requestHeaders }),
      auth.api.getSession({ headers: requestHeaders }),
    ]);
  } catch (error) {
    if (isNotFresh(error)) return { ok: false, reason: "not_fresh" };
    throw error;
  }

  const sessions = rows
    .map((row) => ({
      token: row.token,
      device: describeUserAgent(row.userAgent ?? null),
      ipAddress: row.ipAddress ?? null,
      lastActive: row.updatedAt,
      expiresAt: row.expiresAt,
      isCurrent: row.token === current?.session.token,
    }))
    // Current first, then most recently used. The row somebody is looking for
    // is nearly always their own, and the one they must not revoke is the one
    // they should see first.
    .sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return b.lastActive.getTime() - a.lastActive.getTime();
    });

  return { ok: true, sessions };
}
