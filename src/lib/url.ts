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

/**
 * Whether a real value was supplied, as opposed to the localhost fallback.
 *
 * **Module-local, not exported.** F29's health check answers the same question
 * from `process.env.APP_URL` directly and is the surface that reports it; a
 * second exported name with no caller would be a dead export, which F15
 * already decided is a lie about what the app does.
 */
const APP_URL_CONFIGURED = Boolean(process.env.APP_URL);

export const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  "",
);

/**
 * **Loud, once, at module load — not silent.**
 *
 * F30 made this the origin of every `<loc>` in the sitemap, every canonical
 * link and the `Sitemap:` line in `robots.txt`, on top of the QR codes it
 * already fed. An unset `APP_URL` therefore no longer costs one broken sticker;
 * it publishes a sitemap full of `http://localhost:3000` to a search engine.
 *
 * It **warns rather than throws** deliberately. `pnpm build` runs migrations
 * and compiles the whole app, and a developer who has not written a `.env` yet
 * should get a working local build and a sentence telling them what is wrong —
 * not a failure in a step that has nothing to do with the URL. The failure is
 * loud in build output, the health check on `/settings/system` reports it as
 * `down`, and F29 verified that check by deliberately breaking this value.
 */
if (!APP_URL_CONFIGURED) {
  console.warn(
    `[ajniha] APP_URL is not set — falling back to ${APP_URL}. ` +
      "Every sitemap URL, canonical link, email link and QR code will encode " +
      "that address. Set APP_URL to the origin this app is served from.",
  );
}

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
