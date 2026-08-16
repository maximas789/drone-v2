import "server-only";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { getMyProfile } from "@/lib/data/pilot";
import type { Locale } from "@/lib/locale";
import { isAdmin, isReviewer, type Session } from "@/lib/session";

/**
 * **The security boundary.**
 *
 * `src/proxy.ts` redirects unauthenticated requests away from `(app)` and
 * `(admin)` paths, but it reads only a cookie's presence and is trivially
 * bypassed. These guards are the real check, and they are called in **two**
 * places: each route group's `layout.tsx`, and again inside every server
 * action. A layout guard does not protect an action — server actions are
 * ordinary POSTs to a URL, reachable without ever rendering the layout.
 *
 * The redirecting guards take the locale explicitly. next-intl's server
 * `redirect` requires it, and `next/root-params` — where a layout would
 * otherwise get it — throws inside Server Actions and Route Handlers.
 */

/**
 * next-intl's `redirect` is typed `never`, but it reaches us as a destructured
 * const from `createNavigation`, and TypeScript's never-return analysis only
 * follows a function declaration or an explicitly annotated const. Without this
 * wrapper every guard below would look to the compiler as though it could fall
 * through and return `null`. The `throw` is unreachable and says so.
 */
function redirectTo(href: string, locale: Locale): never {
  redirect({ href, locale });
  throw new Error(`unreachable: redirect to ${href} did not throw`);
}

/**
 * The primitive. Returns `null` rather than redirecting, which is what a server
 * action wants: an action answers with `{ ok: false, reasons: [...] }`, it does
 * not redirect, and refusals in this codebase are never exceptions.
 */
export async function getSession(): Promise<Session | null> {
  return auth.api.getSession({ headers: await headers() });
}

/** A signed-in account. Anything less goes to sign-in. */
export async function requireUser(locale: Locale): Promise<Session> {
  const session = await getSession();
  if (!session) redirectTo("/sign-in", locale);
  return session;
}

/**
 * A signed-in account whose pilot profile exists and is complete.
 *
 * Note it does **not** require `verifiedAt`: an account with a complete but
 * unverified profile may use the app and see where it stands. Only booking
 * requires human verification, and that refusal is F12's `identity_unverified`,
 * raised at the decision rather than at the door.
 */
export async function requirePilotProfile(locale: Locale) {
  const session = await requireUser(locale);
  const profile = await getMyProfile(session);
  if (!profile?.completedAt) redirectTo("/profile/complete", locale);
  return { session, profile };
}

/**
 * `notFound()`, not a thrown error: someone who guesses `/admin` gets a 404,
 * which tells them nothing — not a 403 confirming the route exists, and not a
 * 500 with a stack trace naming the guard.
 */
export async function requireReviewer(): Promise<Session> {
  const session = await getSession();
  if (!session || !isReviewer(session)) {
    notFound();
  }
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    notFound();
  }
  return session;
}
