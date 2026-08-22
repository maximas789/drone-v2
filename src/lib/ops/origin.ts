/**
 * The one piece of arithmetic in the health checks. **Pure** — no
 * `server-only`, no database, no environment.
 *
 * Same split, and for the same reason, as `src/lib/workflow/rules.ts` and
 * `src/lib/inngest/rules.ts`: this decides whether `APP_URL` and
 * `BETTER_AUTH_URL` match the request, which is the comparison behind the most
 * consequential warning on the system page — and a comparison that can only be
 * exercised by standing up a server is a comparison nobody unit-tests.
 */

/**
 * Compares **origins, not strings**: a trailing slash, a path, or a default
 * port written out are not misconfigurations, and reporting them as one would
 * train an operator to ignore the warning that matters.
 *
 * An unparseable value is **not** the same origin as anything. Throwing would
 * take the whole page down over a typo in the one environment variable the page
 * exists to report a typo in.
 */
export function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}
