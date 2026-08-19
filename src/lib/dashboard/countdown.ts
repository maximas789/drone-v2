import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * How long until the next flight, as a sentence.
 *
 * **Pure, and deliberately not inside `next-flight.tsx`.** That file is
 * `"use client"`, and every export of a `"use client"` module becomes a *client
 * reference*: the dashboard is a Server Component, so calling one of them
 * during the server render throws at request time with `typecheck`, `lint` and
 * `test` all green. Exactly the mirror of the `"use server"` trap recorded in
 * `validation/declaration.ts`, and found the same way — by opening the page.
 *
 * The countdown has to be computed on **both** sides: the server renders the
 * first value so the markup matches, and the client re-renders it every minute.
 * One implementation, imported by each.
 */

export type CountdownParts = { days: number; hours: number; minutes: number };

/**
 * Deliberately **not** `formatRelativeTime` from `src/lib/format.ts`: that goes
 * through `Intl.RelativeTimeFormat`, which picks a single unit, so a flight in
 * 3 h 50 m reads as "in 3 hours" and a pilot leaves an hour late.
 */
export function countdownParts(ms: number): CountdownParts {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  return {
    days: Math.floor(minutes / (60 * 24)),
    hours: Math.floor((minutes % (60 * 24)) / 60),
    minutes: minutes % 60,
  };
}

/**
 * Parts → a sentence, in the reader's language.
 *
 * **Every number goes through `formatNumber` first.** next-intl formats a bare
 * numeric ICU argument itself using the page locale, which renders `٣` under
 * `ar` — the exact defect rule 6 exists to prevent, arriving by the route the
 * ESLint rule cannot see (open thread 22). Pre-formatting to a string is what
 * stops it, exactly as `formatReasonParams` does for refusals.
 */
export function formatCountdown(
  parts: CountdownParts,
  locale: Locale,
  t: (key: string, values?: Record<string, string>) => string,
): string {
  const n = (value: number) => formatNumber(value, locale);
  if (parts.days > 0) {
    return t("countdownDays", { days: n(parts.days), hours: n(parts.hours) });
  }
  if (parts.hours > 0) {
    return t("countdownHours", {
      hours: n(parts.hours),
      minutes: n(parts.minutes),
    });
  }
  return t("countdownMinutes", { minutes: n(parts.minutes) });
}
