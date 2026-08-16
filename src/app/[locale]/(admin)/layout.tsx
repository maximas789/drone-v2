import { requireReviewer } from "@/lib/auth-guards";

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
export default async function AdminLayout({
  children,
}: LayoutProps<"/[locale]">) {
  await requireReviewer();

  return <div className="flex flex-1 flex-col">{children}</div>;
}
