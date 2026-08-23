import "server-only";

import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * When a file's content last changed, from the repository's own history.
 *
 * **This is F26's `docLastUpdated`, lifted out of `src/lib/docs/updated.ts` so
 * the sitemap and the docs page share one implementation.** Two copies of "when
 * did this change" is how a sitemap ends up claiming a date the page itself
 * does not show. `updated.ts` now delegates here and keeps its own signature.
 *
 * **A hand-written date is the one thing this must not be.** The whole value of
 * a "last updated" line — and of `<lastmod>` in a sitemap — is that it is not
 * maintained by the person who forgot to maintain the page. A typed date stays
 * at whatever the author last remembered, which is worse than no date because
 * it looks like evidence. A sitemap where everything changed today tells a
 * crawler nothing, which is the same failure wearing the machine-readable hat.
 *
 * The two ways it can fail are handled rather than papered over:
 *
 * - **Not committed yet** — a file written this session. `git log` prints
 *   nothing and the file's own mtime is used. Still a real date.
 * - **No repository at all** — a deployed serverless function where `.git` was
 *   never uploaded. Both calls fail and the caller renders nothing. **Not
 *   verified: this build has only ever run inside its own git checkout.** In
 *   practice the sitemap is generated at build time, where the checkout does
 *   exist, so the deployed artefact carries dates computed here.
 *
 * A modified-but-uncommitted file reports the mtime for the same reason: it is
 * the newer of the two facts and the one a reader cares about.
 *
 * Cached on the file's mtime rather than for a duration — forking `git` per
 * request is not free, and a timed cache goes stale while somebody is editing
 * the very page they are looking at. **Only a real commit date is cached**:
 * committing does not touch an mtime, so caching the fallback would pin a file
 * to its pre-commit date until the process restarted.
 */

const cache = new Map<string, { mtimeMs: number; updated: Date }>();

/**
 * `file` is repository-relative with **forward slashes** — the string is handed
 * to git, which wants POSIX separators on Windows too.
 */
export async function fileLastModified(file: string): Promise<Date | null> {
  let mtimeMs: number;
  try {
    mtimeMs = (await stat(file)).mtimeMs;
  } catch {
    return null;
  }

  const hit = cache.get(file);
  if (hit && hit.mtimeMs === mtimeMs) return hit.updated;

  let updated = new Date(mtimeMs);
  let fromGit = false;
  try {
    // `%cI` is the committer date, strict ISO 8601. `--` separates the pathspec
    // from anything git might otherwise read as a revision.
    const { stdout } = await run(
      "git",
      ["log", "-1", "--format=%cI", "--", file],
      { windowsHide: true },
    );
    const committed = stdout.trim();
    if (committed) {
      const parsed = new Date(committed);
      if (!Number.isNaN(parsed.getTime())) {
        updated = parsed;
        fromGit = true;
      }
    }
  } catch {
    // No git, or not a checkout. The mtime already read stands.
  }

  if (fromGit) cache.set(file, { mtimeMs, updated });
  return updated;
}

/**
 * The newest date across several files, for a page assembled from more than
 * one source. `null` only when **every** file is unreadable — one missing file
 * must not erase a date the others can supply.
 */
export async function newestLastModified(
  files: readonly string[],
): Promise<Date | null> {
  const dates = (await Promise.all(files.map(fileLastModified))).filter(
    (date): date is Date => date !== null,
  );
  if (dates.length === 0) return null;
  return dates.reduce((newest, date) => (date > newest ? date : newest));
}
