import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **The append-only claim, as a test rather than as a promise.**
 *
 * `/admin/audit` says in one line that nothing in the platform edits or deletes
 * a row of the log. That is a claim about the *whole application*, and no
 * reader of the page can check it — so this file checks it, by grepping every
 * source file under `src/` for an update or a delete against `auditEvent`.
 *
 * F25's criterion is worded as a grep for exactly this reason: *"no UI control
 * anywhere edits or deletes an audit event, and no such server action exists
 * (verified by grep)"*. A test that called a function to see whether it existed
 * would only prove the function it happened to think of was absent. Reading the
 * source proves nothing anywhere reaches for the table that way, including a
 * route handler somebody adds next year.
 *
 * **`src/` only, and that boundary is the point.** `scripts/probe-*.mts` do
 * delete audit rows — they create fixture drones and bookings against a
 * development database and clean up after themselves, and a probe that left its
 * own noise in the log would make the next probe's assertions meaningless.
 * Those scripts are not the application: they are never imported by it, never
 * bundled, and never reachable from a request. What must hold is that nothing
 * a *user* can reach rewrites the log, and `src/` is that surface.
 */

/** Every `.ts`/`.tsx` under `src/`, tests excluded — the same walk as `id-exposure.test.ts`. */
function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...walk(path));
    } else if (
      (path.endsWith(".ts") || path.endsWith(".tsx")) &&
      !path.endsWith(".test.ts") &&
      !path.endsWith(".test.tsx")
    ) {
      files.push(path);
    }
  }
  return files;
}

const sources = walk("src").map((path) => ({
  path,
  text: readFileSync(path, "utf8"),
}));

/**
 * `db.update(auditEvent)`, `tx.update(auditEvent)`, `.delete(auditEvent)` and
 * the Drizzle relational forms. Whitespace and a line break between the dot and
 * the call are allowed for, because Prettier puts one there whenever the chain
 * is long — which it always is.
 */
const MUTATION = /\.\s*(update|delete)\s*\(\s*auditEvent\b/;
/** The relational-query spellings, e.g. `db.query.auditEvent.delete(`. */
const RELATIONAL = /auditEvent\s*\.\s*(update|delete)\s*\(/;
/** A raw SQL escape hatch aimed at the table. */
const RAW_SQL = /(update|delete\s+from)\s+"?audit_event"?/i;

describe("audit_event is append-only", () => {
  it("finds no update or delete against auditEvent anywhere in src/", () => {
    const offenders = sources
      .filter(
        ({ text }) =>
          MUTATION.test(text) || RELATIONAL.test(text) || RAW_SQL.test(text),
      )
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  /**
   * The other half of the criterion: **no UI affordance**, which in this
   * codebase means no server action. A `"use server"` module may export only
   * async functions, so an action that mutated the log would have to be one of
   * these — and if none of them so much as names the table in a mutating call,
   * no button can be wired to one.
   */
  it("exports no function whose name promises to change the log", () => {
    /**
     * A **declaration**, not a mention. The first version of this matched the
     * bare name anywhere in the file and failed on `src/lib/data/audit.ts`,
     * whose header comment promises "there is no `updateAuditEvent` and no
     * `deleteAuditEvent` here, and there must never be" — a test that refuses
     * the sentence stating the guarantee is a test arguing with itself.
     */
    const named =
      /\b(?:function|const|let|var)\s+(?:update|delete|remove|edit|purge|redact)AuditEvent\b/i;
    expect(
      sources.filter(({ text }) => named.test(text)).map(({ path }) => path),
    ).toEqual([]);
  });

  /**
   * The scan must actually be looking at something. An empty file list would
   * make both assertions above pass by reading nothing, which is the failure
   * mode every grep-shaped test has and the reason each one in this build ends
   * with a lower bound.
   */
  it("scanned the application source", () => {
    expect(sources.length).toBeGreaterThan(100);
    expect(sources.some(({ text }) => text.includes("auditEvent"))).toBe(true);
  });
});
