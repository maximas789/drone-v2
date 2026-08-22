import "server-only";

import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";
import type { DocSlug } from "./slugs";
import type { Locale } from "@/lib/locale";

const run = promisify(execFile);

/**
 * When a documentation page was last changed, from the repository's own
 * history.
 *
 * **A hand-written date is the one thing this must not be.** The whole value of
 * a "last updated" line on a docs page is that it is not maintained by the
 * person who forgot to maintain the page; a date typed into the file's `meta`
 * would stay at whatever the author last remembered to type, which is worse
 * than no date at all because it looks like evidence.
 *
 * So it is the committer date of the last commit that touched the file, and the
 * two ways that can fail are handled honestly rather than papered over:
 *
 * - **The file is not committed yet** — a page written this session. `git log`
 *   prints nothing, and the file's own mtime is used. Still a real date, and
 *   still the date the text last changed.
 * - **There is no repository at all** — a deployed serverless function, where
 *   `.git` was never uploaded. Both calls fail and the caller renders nothing.
 *   **Not verified: this build has only ever run inside its own git checkout.**
 *
 * A modified-but-uncommitted file reports the mtime for the same reason: it is
 * the newer of the two facts, and it is the one the reader cares about.
 *
 * Cached on the file's mtime rather than for a duration. Forking `git` on every
 * request is not free, and a cache with a timeout would go stale while somebody
 * is editing the very page they are looking at. **Only a real commit date is
 * cached**: committing a file does not touch its mtime, so caching the mtime
 * fallback would pin a page to its pre-commit date until the process restarted.
 */

const cache = new Map<string, { mtimeMs: number; updated: Date }>();

function pathFor(locale: Locale, slug: DocSlug): string {
  // Forward slashes: this string is handed to git, which wants POSIX
  // separators on Windows too.
  return `src/content/docs/${locale}/${slug}.mdx`;
}

export async function docLastUpdated(
  locale: Locale,
  slug: DocSlug,
): Promise<Date | null> {
  const file = pathFor(locale, slug);

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
    // `%cI` is the committer date, strict ISO 8601. `--` separates the
    // pathspec from anything git might otherwise read as a revision.
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
