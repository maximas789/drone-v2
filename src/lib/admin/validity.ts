import { RIYADH_OFFSET_MINUTES } from "@/lib/format";

/**
 * The two directions of a declaration's validity window.
 *
 * A plain module, imported by both the server action that **stores** the window
 * and the client component that **renders** it. Thread 59's rule: anything a
 * server page and a client component both call goes in a plain module, because
 * a `"use client"` module's exports are client references a Server Component
 * cannot call.
 *
 * **`validUntil` is stored as an exclusive bound**, because that is how
 * `broadcastCapableAt` reads it (`validUntil > instant`). A certificate valid
 * "until 31 December" covers the whole of that day, so the stored instant is
 * midnight at the *start of 1 January* — and the two functions below are the
 * one place that conversion is written down, in both directions.
 *
 * Getting this wrong is not visible in a type or a test of the write path: the
 * row was stored correctly and the *page* printed "until 1 January 2030" for a
 * reviewer who had typed 31 December 2029. Found by reading the screen after
 * verifying a module.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A `YYYY-MM-DD` from the three-select control, as an instant.
 *
 * Riyadh civil midnight — fixed +180, because Saudi Arabia has never observed
 * DST, so there is no offset to look up and nothing to get wrong twice a year.
 * `endOfDay` returns the **exclusive** bound: midnight at the start of the next
 * day, which is what a `validUntil` is.
 */
export function riyadhMidnight(ymd: string, endOfDay = false): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const at = Date.parse(`${ymd}T00:00:00+03:00`);
  if (Number.isNaN(at)) return null;
  return new Date(endOfDay ? at + DAY_MS : at);
}

/**
 * The other direction: the **last day the window actually covers**, for
 * display.
 *
 * One millisecond back from the exclusive bound lands inside the final day
 * whatever that day's length, so this needs no calendar arithmetic and cannot
 * drift from `riyadhMidnight`. The result is formatted by `formatDate`, which
 * renders it in the Riyadh zone.
 */
export function inclusiveEndOf(validUntil: Date): Date {
  return new Date(validUntil.getTime() - 1);
}

/** Exported for the test, which asserts the round trip against the real offset. */
export { RIYADH_OFFSET_MINUTES };

/**
 * Where a registration's expiry falls **relative to the slot being reviewed**.
 *
 * A registration is not a fact about today; on this screen it is a fact about
 * the flight. One that lapses the morning after the request was made still
 * looks perfectly valid in a list of aircraft, and a reviewer approving from
 * that list would authorise an unregistered flight.
 *
 * The boundaries are the engine's, not a second opinion:
 * `eligibilityReasons` refuses `drone_registration_expired` when the expiry is
 * at or before **`slotEnd`** — "a slot that starts an hour before expiry and
 * runs past it is a flight that finishes unregistered". So `expires_during` and
 * `expired` are both already refusals; the split exists because the *sentence*
 * a reviewer needs is different ("it lapses mid-flight" is not "it lapsed").
 * If these ever disagree with `evaluate.ts`, `evaluate.ts` is right — it is the
 * authority, and this only explains what it decided.
 */
export type RegistrationAtSlot =
  | "unknown"
  | "valid"
  | "expires_during"
  | "expired";

export function registrationAtSlot(
  expiresAt: Date | null | undefined,
  slotStart: Date,
  slotEnd: Date,
): RegistrationAtSlot {
  if (!expiresAt) return "unknown";
  const at = expiresAt.getTime();
  if (at <= slotStart.getTime()) return "expired";
  if (at <= slotEnd.getTime()) return "expires_during";
  return "valid";
}
