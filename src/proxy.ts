import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * Next 16 renamed the `middleware` convention to `proxy` (the `middleware`
 * filename and the named `middleware` export are both deprecated). Same
 * request hook, nodejs runtime, no edge.
 *
 * This is **routing only**. It is not, and must never become, the security
 * boundary — it is an optimistic redirect that a direct POST bypasses.
 * F05 composes the auth check in here for the redirect UX, but the actual
 * guard runs in the layout and again inside every server action.
 */
export const proxy = createMiddleware(routing);

export const config = {
  // Everything except Next internals, the API surface, and anything with a
  // file extension (favicon, robots.txt, the QR sticker PNGs).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
