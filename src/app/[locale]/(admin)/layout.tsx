import type { Metadata } from "next";
import { requireReviewer } from "@/lib/auth-guards";
import { PRIVATE_ROBOTS } from "@/lib/site/metadata";

/**
 * The staff boundary — reviewers and admins.
 *
 * `requireReviewer` answers with `notFound()`, so a pilot who guesses `/admin`
 * gets a plain 404. Not a 403, which would confirm the route exists, and not a
 * thrown error, which would put the guard's name in a stack trace.
 *
 * Individual admin-only surfaces call `requireAdmin` for themselves; the route
 * group is as far as a reviewer gets in one step.
 */
/**
 * **Never indexed**, set once for the whole route group rather than once per
 * page: metadata merges field by field, so a page underneath that sets only its
 * own `title` still inherits this. Thirteen pages each repeating a `robots` block is
 * thirteen places for one to go missing, and the one that went missing would be
 * indexed with nothing failing.
 *
 * `robots.txt` disallows these paths as well. Neither control is sufficient
 * alone — a disallowed page is never fetched, so its `noindex` is never read,
 * and a URL a search engine already knows can sit in an index behind a
 * `Disallow` indefinitely.
 *
 * **This is not the security boundary.** The guard below is. This stops the app
 * appearing in a search result; it stops nobody from typing the URL.
 */
export const metadata: Metadata = { robots: PRIVATE_ROBOTS };

export default async function AdminLayout({
  children,
}: LayoutProps<"/[locale]">) {
  await requireReviewer();

  return <div className="flex flex-1 flex-col">{children}</div>;
}
