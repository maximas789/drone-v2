/**
 * The workflow's arithmetic. **Pure** — no `server-only`, no `db`, no session.
 *
 * Same split, and for the same reason, as `src/lib/rate-limit/rules.ts` and
 * `src/lib/airspace/evaluate.ts`: these two numbers decide when a registration
 * lapses and whether a pilot may still cancel, and arithmetic that a connection
 * string can veto is arithmetic nobody can unit-test.
 *
 * `index.ts` re-exports everything here, so callers still write
 * `@/lib/workflow` and never need to know about the split.
 */

/** GACA's validity period, and the interval this app issues against. */
export const REGISTRATION_YEARS = 3;

/**
 * A pilot may not cancel inside this window before the slot starts.
 *
 * Two hours is what makes the freed seat worth anything: a cancellation ten
 * minutes beforehand is a no-show with better manners, and nobody else could
 * have taken it. An **authority** has no such limit — cancelling twenty minutes
 * before a flight is exactly the case that power exists for.
 */
export const PILOT_CANCEL_LEAD_MS = 2 * 60 * 60 * 1000;

/**
 * Three years from issue, **to the same calendar day**.
 *
 * `setUTCFullYear`, not `+ n × 86_400_000`: three years is not a fixed number
 * of days, and adding milliseconds drifts by a day across every leap year in
 * the window — on a document a pilot carries as proof, that is a date that
 * disagrees with the certificate.
 *
 * 29 February rolls to 1 March, which is what JavaScript does and what a reader
 * of the card would expect: the registration lasts the full three years and
 * expires on the first day that is not inside them.
 */
export function registrationExpiryFrom(issued: Date): Date {
  const expires = new Date(issued.getTime());
  expires.setUTCFullYear(expires.getUTCFullYear() + REGISTRATION_YEARS);
  return expires;
}

/** `true` when the pilot is still early enough to cancel their own booking. */
export function pilotMayCancel(slotStart: Date, now: Date): boolean {
  return slotStart.getTime() - now.getTime() >= PILOT_CANCEL_LEAD_MS;
}

/**
 * **Four eyes.** Whether the person deciding is the person who submitted.
 *
 * A regulator's approval is worth what the separation between submitter and
 * approver is worth, and this app's staff hold `owner` alongside `reviewer` on
 * purpose — staff use the product as pilots, which is how they find out what it
 * is like. The cost of that decision is that nothing structural keeps a
 * reviewer away from their own paperwork, so the rule has to be written down.
 *
 * Pure, and here rather than in an action, because **both** halves need it: the
 * screen greys the controls and says why, and the workflow refuses
 * independently — a disabled button is a courtesy, not a check, and the actions
 * are ordinary POSTs.
 *
 * A missing id on **either** side is not a match. A record whose owner could
 * not be read is one this predicate knows nothing about, and answering "yes,
 * that is yours" would block a legitimate decision on a guess; the caller's own
 * `not_found` covers a genuinely absent row. And a **system** actor has no user
 * id at all — the expiry sweep and the closure fan-out decide about everybody's
 * records by design, and a null matching a null would stop the clock working.
 */
export function isOwnSubmission(
  actorUserId: string | null | undefined,
  subjectUserId: string | null | undefined,
): boolean {
  return Boolean(actorUserId) && actorUserId === subjectUserId;
}
