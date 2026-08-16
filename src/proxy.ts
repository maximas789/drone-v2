import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * Next 16 renamed the `middleware` convention to `proxy` (the `middleware`
 * filename and the named `middleware` export are both deprecated). Same
 * request hook, nodejs runtime, no edge.
 *
 * **This is not the security boundary and must never become one.** It checks
 * only that a session *cookie is present* — it never reads the role, never
 * hits the database, and never validates the token. Anyone can send a request
 * with a fabricated cookie and reach the page behind it; what stops them is
 * `requireUser` / `requireReviewer` / `requireAdmin` in the route group's
 * layout, and the same guard again inside every server action.
 *
 * All this buys is not rendering a signed-out dashboard before redirecting.
 */
const handleI18n = createMiddleware(routing);

/**
 * First path segment after the locale that lives behind a sign-in.
 *
 * Kept in step with the `(app)` and `(admin)` route groups by hand — a page
 * added there without a segment here is still *protected* (the layout guard is
 * what protects it), it just flashes on its way to the guard's redirect.
 */
const PROTECTED_SEGMENTS = new Set(["dashboard", "admin"]);

function isProtected(pathname: string): boolean {
  const [, maybeLocale, segment] = pathname.split("/");
  if (!(routing.locales as readonly string[]).includes(maybeLocale)) {
    return false;
  }
  return PROTECTED_SEGMENTS.has(segment);
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isProtected(pathname) && !getSessionCookie(request)) {
    const locale = pathname.split("/")[1];
    const url = new URL(`/${locale}/sign-in`, request.url);
    // So the sign-in form can send them back where they were headed. Stored
    // **without** the locale prefix, because the form navigates with
    // next-intl's router, which adds the prefix itself. The sign-in page
    // re-validates it — a `next` that isn't a local path is an open redirect.
    url.searchParams.set("next", pathname.slice(locale.length + 1) + search);
    return NextResponse.redirect(url);
  }

  return handleI18n(request);
}

export const config = {
  // Everything except Next internals, the API surface (Better Auth's handler
  // lives at /api/auth/*), and anything with a file extension (favicon,
  // robots.txt, the QR sticker PNGs).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
