import "server-only";

import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { zone } from "@/lib/db/schema";
import { emailConfigured } from "@/lib/email/config";
import { functions } from "@/lib/inngest/functions";
import { sameOrigin } from "@/lib/ops/origin";
import { blobConfigured } from "@/lib/storage";

/**
 * What the app depends on, whether it has it, and **what changes if it does
 * not**.
 *
 * **Never a bare red dot.** Every degraded state carries the consequence in the
 * operator's own terms — *emails print to the terminal only*, *uploads will not
 * persist on a serverless host* — because a red dot with no sentence sends
 * somebody to a hosting dashboard to find out what broke, which is the trip
 * this page exists to save.
 *
 * **Secrets are `present` or `absent`, and nothing else.** No value, no prefix,
 * no last four. A "helpful" masked prefix is still a leak, and it is a leak on
 * the one page an administrator is most likely to screenshot when asking for
 * help.
 *
 * Every check answers from something real — a query, a file on disk, a socket,
 * an array in the code. Nothing here reports a status it inferred from another
 * status, because a health page that guesses is worse than no health page.
 */

export type HealthState = "ok" | "degraded" | "down";

export type HealthCheck = {
  /** Message key under `ops.check`. */
  id: string;
  state: HealthState;
  /**
   * Free-form facts the message interpolates — a latency, a count, a URL.
   * **Never a secret**, and `health.test.ts` asserts as much.
   */
  detail?: Record<string, string | number>;
  /** Message key for the consequence line, when degraded or down. */
  consequence?: string;
};

/** Milliseconds before a network probe is called unreachable. */
const PROBE_TIMEOUT_MS = 1500;

async function reachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: "no-store",
    });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

/**
 * The database, and how long it took to say so.
 *
 * `select 1` rather than a table read: this must answer "is the connection
 * alive" and not "does this table exist", which is the migrations check's job
 * and would otherwise report both as one failure.
 */
async function checkDatabase(): Promise<HealthCheck> {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return {
      id: "database",
      state: "ok",
      detail: { latencyMs: Date.now() - started },
    };
  } catch (error) {
    return {
      id: "database",
      state: "down",
      detail: { error: error instanceof Error ? error.message : String(error) },
      consequence: "databaseDown",
    };
  }
}

/**
 * Migrations in the journal that the database has not applied — **named**, not
 * counted. "1 pending migration" sends somebody to look it up; the name is what
 * they were going to look up.
 *
 * Matched on the journal's `when` against `drizzle.__drizzle_migrations.
 * created_at`, which Drizzle writes from exactly that value. The table's other
 * column is a hash of the file's contents, so matching on it would mean
 * re-implementing Drizzle's hashing here and being wrong the day it changes.
 */
async function checkMigrations(): Promise<HealthCheck> {
  try {
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    ) as { entries: { tag: string; when: number }[] };

    const applied = await db.execute<{ created_at: string }>(
      sql`select created_at from drizzle.__drizzle_migrations`,
    );
    const appliedAt = new Set(
      [...applied].map((row) => String(row.created_at)),
    );

    const pending = journal.entries
      .filter((entry) => !appliedAt.has(String(entry.when)))
      .map((entry) => entry.tag);

    if (pending.length === 0) {
      return {
        id: "migrations",
        state: "ok",
        detail: { applied: journal.entries.length },
      };
    }
    return {
      id: "migrations",
      state: "down",
      detail: { pending: pending.join(", ") },
      consequence: "migrationsPending",
    };
  } catch (error) {
    /**
     * A deployed function has no `drizzle/` directory — the migrations live in
     * the repository, not the bundle. **Unknown is reported as unknown**, and
     * deliberately not as "ok": a green tick here on a host that cannot see the
     * journal would be the single most misleading thing on the page.
     */
    return {
      id: "migrations",
      state: "degraded",
      detail: { error: error instanceof Error ? error.message : String(error) },
      consequence: "migrationsUnknown",
    };
  }
}

function checkEmail(): HealthCheck {
  return emailConfigured
    ? { id: "email", state: "ok" }
    : { id: "email", state: "degraded", consequence: "emailUnconfigured" };
}

function checkBlob(): HealthCheck {
  return blobConfigured
    ? { id: "blob", state: "ok" }
    : { id: "blob", state: "degraded", consequence: "blobUnconfigured" };
}

/**
 * How many functions this app registers, and whether anything can run them.
 *
 * The count comes from the array the route actually serves — a fact, not a
 * probe.
 *
 * **This check used to answer from something it had not measured.** It probed
 * `localhost:8288` unconditionally, so a correctly-deployed production install
 * reported *degraded* and told the operator to start a dev CLI; and because the
 * probe accepted any status below 500, anything at all listening on that port
 * turned it green. Both directions were observed on this machine: with the dev
 * server up and the app in cloud mode — answering its own `/api/inngest` with a
 * 500 and registering nothing — this row would have read **ok · 11 functions**
 * over an integration that could not run a single job.
 *
 * So it now branches on the mode the client actually uses, and in cloud mode it
 * asks about the key rather than about a port that is not involved.
 */
async function checkInngest(): Promise<HealthCheck> {
  const detail = { functions: functions.length };

  /**
   * The same derivation as `src/lib/inngest/client.ts`. Repeated rather than
   * imported because importing the client here would construct it as a side
   * effect of rendering a health page.
   */
  const dev =
    process.env.INNGEST_DEV === undefined || process.env.INNGEST_DEV === ""
      ? process.env.NODE_ENV !== "production"
      : process.env.INNGEST_DEV !== "0";

  if (!dev) {
    /**
     * Cloud mode. There is no local port to probe, and the SDK refuses to
     * serve `/api/inngest` at all without a signing key — which is the failure
     * an operator needs to hear about, and the one the old check could not see.
     */
    const signed = Boolean(process.env.INNGEST_SIGNING_KEY);
    const keyed = Boolean(process.env.INNGEST_EVENT_KEY);
    return {
      id: "inngest",
      state: signed && keyed ? "ok" : "degraded",
      detail,
      consequence: signed && keyed ? undefined : "inngestKeysMissing",
    };
  }

  const base = process.env.INNGEST_BASE_URL ?? "http://localhost:8288/";
  const up = await reachable(base);
  return {
    id: "inngest",
    state: up ? "ok" : "degraded",
    detail,
    consequence: up ? undefined : "inngestUnreachable",
  };
}

/**
 * **The check that earns the page.**
 *
 * Every QR sticker embeds `APP_URL` at render time. If it still says
 * `localhost` when the first drone is approved in production, every printed
 * sticker is dead — and nothing else in this app would ever say so. So the
 * value is named in full, which is the one place on this page a configured
 * value is printed: it is a URL, not a secret, and the whole failure is that
 * somebody cannot see what it says.
 */
function checkAppUrl(origin: string | null): HealthCheck {
  const value = process.env.APP_URL ?? "";
  if (!value) {
    return { id: "appUrl", state: "down", consequence: "appUrlMissing" };
  }
  if (origin && !sameOrigin(value, origin)) {
    return {
      id: "appUrl",
      state: "down",
      detail: { value, origin },
      consequence: "appUrlMismatch",
    };
  }
  return { id: "appUrl", state: "ok", detail: { value } };
}

function checkAuthUrl(origin: string | null): HealthCheck {
  const value = process.env.BETTER_AUTH_URL ?? "";
  if (!value) {
    return { id: "authUrl", state: "down", consequence: "authUrlMissing" };
  }
  if (origin && !sameOrigin(value, origin)) {
    return {
      id: "authUrl",
      state: "down",
      detail: { value, origin },
      consequence: "authUrlMismatch",
    };
  }
  return { id: "authUrl", state: "ok", detail: { value } };
}

/**
 * Present or absent. **The value is never read into a variable here**, let
 * alone returned — the check is `Boolean(...)` on the environment and nothing
 * more, so there is no code path on this page that could print it.
 */
function checkPepper(): HealthCheck {
  return process.env.ID_HASH_PEPPER
    ? { id: "pepper", state: "ok" }
    : { id: "pepper", state: "down", consequence: "pepperMissing" };
}

async function checkSeed(): Promise<HealthCheck> {
  try {
    const zones = await db.$count(zone);
    return zones > 0
      ? { id: "seed", state: "ok", detail: { zones } }
      : { id: "seed", state: "degraded", consequence: "seedEmpty" };
  } catch {
    // The database check already reports the real problem; saying it twice
    // would make one outage look like two.
    return { id: "seed", state: "degraded", consequence: "seedUnknown" };
  }
}

/**
 * Every check, in the order they are shown. `origin` is the request's own
 * origin, which only a request can know — so it is passed in rather than read
 * from the environment the checks are validating.
 */
export async function runHealthChecks(
  origin: string | null,
): Promise<HealthCheck[]> {
  const [database, migrations, inngest, seed] = await Promise.all([
    checkDatabase(),
    checkMigrations(),
    checkInngest(),
    checkSeed(),
  ]);

  return [
    database,
    migrations,
    checkAppUrl(origin),
    checkAuthUrl(origin),
    checkPepper(),
    checkEmail(),
    checkBlob(),
    inngest,
    seed,
  ];
}
