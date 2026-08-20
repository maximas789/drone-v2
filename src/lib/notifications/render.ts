import type { Locale } from "@/lib/locale";

/**
 * Turning a stored notification into a sentence. **Pure** — no database, no
 * request, no `next-intl`; it prepares the arguments and the caller does the
 * `t()`.
 *
 * A notification row stores a `type` key and structured `params`, **never
 * rendered text**. A pilot who switches from Arabic to English must see their
 * *old* notifications in English, which storing a sentence makes impossible.
 * This module is where the stored shape meets the catalogue.
 */

/**
 * Every `type` the app writes. Kept as a list rather than left implicit because
 * a type with no catalogue key renders as the raw string
 * `notifications.droneApproved` to the person it was written for —
 * `render.test.ts` asserts this list against both catalogues **and** against
 * every `type:` literal in the source, so neither half can drift alone.
 */
export const NOTIFICATION_TYPES = [
  "droneApproved",
  "droneRejected",
  "droneRevoked",
  "droneReinstated",
  "identityApproved",
  "identityRejected",
  "bookingConfirmed",
  "bookingCancelled",
  "bookingRejected",
  "bookingReminder",
  "zoneClosed",
  /** F23b. The zone itself was withdrawn, not merely closed for a window. */
  "zoneSuspended",
  /**
   * F23b. A published boundary moved, so an approved flight went back to a
   * reviewer. Deliberately not `bookingCancelled` — the pilot still holds the
   * seat, and telling them their flight was cancelled when it was not would be
   * the worse of the two errors.
   */
  "bookingUnderReview",
  "registrationExpiring",
  "registrationExpired",
  "identityRevealed",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

/**
 * **The seam F08 left for this feature.**
 *
 * `notify()` requires both variants of any bilingual value — a row carries
 * `zoneAr` *and* `zoneEn` — so that rendering needs no join back to the zone
 * table, and so that the same row reads correctly in whichever language the
 * viewer picks later. The catalogue, meanwhile, takes a single `{zone}`:
 * `i18n:check` compares placeholders across locales, so a catalogue where `ar`
 * said `{zoneAr}` and `en` said `{zoneEn}` would fail by design.
 *
 * Collapsing the pair happens **here**, and here is the only place it can:
 * it is the first point that knows which language the reader chose.
 *
 * A pair is collapsed only when **both** halves are present, so a param that
 * merely happens to end in `En` is left alone.
 */
export function collapseParams(
  params: Record<string, unknown> | null | undefined,
  locale: Locale,
): Record<string, string> {
  const source = params ?? {};
  const collapsed: Record<string, string> = {};

  for (const [key, value] of Object.entries(source)) {
    const base = bilingualBase(key);
    if (base && `${base}Ar` in source && `${base}En` in source) {
      // Written once, from whichever half matches the reader.
      collapsed[base] = String(source[`${base}${locale === "ar" ? "Ar" : "En"}`] ?? "");
      continue;
    }
    collapsed[key] = value === null || value === undefined ? "" : String(value);
  }

  return collapsed;
}

/**
 * `href` is stored **locale-less** — `/drones/abc`, never `/ar/drones/abc` —
 * because the row outlives the language it was written in, exactly as `params`
 * does. There is no helper here to prefix it: `Link` from `@/i18n/navigation`
 * already does that with the reader's *current* locale, and a second
 * implementation would be one more place to get it wrong.
 */

function bilingualBase(key: string): string | null {
  if (key.endsWith("Ar")) return key.slice(0, -2);
  if (key.endsWith("En")) return key.slice(0, -2);
  return null;
}
