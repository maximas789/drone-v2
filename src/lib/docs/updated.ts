import "server-only";

import type { DocSlug } from "./slugs";
import { fileLastModified } from "@/lib/site/last-modified";
import type { Locale } from "@/lib/locale";

/**
 * When a documentation page was last changed, from the repository's own
 * history.
 *
 * **The implementation moved to `src/lib/site/last-modified.ts` in F30**, which
 * needed the same answer for the sitemap's `<lastmod>`. What is left here is
 * the path, which is the only part that was ever docs-specific. Two copies of
 * "when did this change" is how a sitemap comes to claim a date the page itself
 * does not show; the reasoning behind the git-then-mtime fallback, and what it
 * cannot do in a deployed function, lives with the implementation.
 */
export async function docLastUpdated(
  locale: Locale,
  slug: DocSlug,
): Promise<Date | null> {
  return fileLastModified(docSourcePath(locale, slug));
}

/**
 * Repository-relative, forward slashes — the string reaches git, which wants
 * POSIX separators on Windows too. Exported because the sitemap dates the same
 * six pages from the same files.
 */
export function docSourcePath(locale: Locale, slug: DocSlug): string {
  return `src/content/docs/${locale}/${slug}.mdx`;
}
