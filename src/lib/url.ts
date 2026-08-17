import { DEFAULT_LOCALE, type Locale } from "@/lib/locale";

/**
 * Absolute URLs, from one place.
 *
 * **Why this exists:** an email has no origin to be relative to, and neither
 * does a QR code. Both bake `APP_URL` in at render time, so if it still says
 * `localhost` in production every printed sticker is dead and every emailed
 * link goes nowhere. F29's system page checks this value; this module is what
 * it checks.
 */
export const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  "",
);

/** `/dashboard` → `https://…/dashboard`. Absolute input is passed through. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Whether a `?next=` may be redirected to. **Pure**, so the guard that builds
 * the parameter and the page that consumes it share one definition of
 * "internal" — two of them is how one ends up wrong.
 *
 * **An open redirect is the hazard.** `?next=https://evil.example` on a URL the
 * app itself hands out is a phishing primitive: the victim checks the domain,
 * sees ours, and lands somewhere else. Only a path is accepted, and `//host`
 * and `/\host` are rejected because a browser reads both as protocol-relative
 * and would leave the site entirely.
 *
 * A locale prefix is rejected too: next-intl's `Link` and `redirect` add one, so
 * `/ar/drones/new` would become `/ar/ar/drones/new` and 404. Callers name the
 * unprefixed route, as every other stored `href` in this codebase does — F15
 * deleted `localeHref` and wrote a test for exactly this.
 */
export function isInternalPath(candidate: string): boolean {
  return (
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.startsWith("/\\") &&
    !/^\/(ar|en)(\/|$)/.test(candidate)
  );
}

/**
 * The locale-prefixed form. Routing is `localePrefix: "always"`, so a link
 * emailed without the prefix costs the reader a redirect at best and lands
 * them in the wrong language at worst.
 */
export function localeUrl(path: string, locale: Locale = DEFAULT_LOCALE): string {
  if (/^https?:\/\//i.test(path)) return path;
  const rest = path.startsWith("/") ? path : `/${path}`;
  return `${APP_URL}/${locale}${rest === "/" ? "" : rest}`;
}
