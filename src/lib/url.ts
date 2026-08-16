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
 * The locale-prefixed form. Routing is `localePrefix: "always"`, so a link
 * emailed without the prefix costs the reader a redirect at best and lands
 * them in the wrong language at worst.
 */
export function localeUrl(path: string, locale: Locale = DEFAULT_LOCALE): string {
  if (/^https?:\/\//i.test(path)) return path;
  const rest = path.startsWith("/") ? path : `/${path}`;
  return `${APP_URL}/${locale}${rest === "/" ? "" : rest}`;
}
