import { eventType, staticSchema } from "inngest";

/**
 * Every event the app sends, declared once.
 *
 * An `EventType` is both the trigger a function registers against and the
 * factory a sender calls, so a payload that does not match the function reading
 * it is a **type error** rather than a run that silently finds `undefined`
 * where it wanted an id.
 *
 * `staticSchema` gives the types without pulling a validator into the path —
 * every sender is our own server code, and a zod parse here would be checking
 * that we passed ourselves the argument we just typed.
 *
 * **Payloads carry ids, never rows.** The job re-reads current state; a
 * serialised row is a snapshot that was already stale when the event was queued,
 * and acting on it is how a cancelled booking gets cancelled twice.
 */

/** Sent by F14 when a reviewer approves a drone. Renders the QR, then emails. */
export const droneApprovedEvent = eventType("drone/approved", {
  schema: staticSchema<{ droneId: string }>(),
});

/** Sent by F14 when a reviewer revokes one. Suspends the Remote ID, cancels ahead. */
export const droneRevokedEvent = eventType("drone/revoked", {
  schema: staticSchema<{ droneId: string; reason: string | null }>(),
});

/** Sent by F23 when a closure is published. Fans out over overlapping bookings. */
/**
 * Sent by the reviewer's rejection, after the transaction commits.
 *
 * **The email goes through a job rather than straight from the action**
 * (thread 24): a decision must not fail, or be held open, because a mail
 * provider is slow. The pilot already has the in-app notification; this is the
 * half that reaches them when the app is closed.
 */
export const droneRejectedEvent = eventType("drone/rejected", {
  schema: staticSchema<{ droneId: string }>(),
});

/**
 * Sent when a **reviewer** approves a booking. An auto-approved one is
 * confirmed on screen inside the action, so it deliberately sends nothing.
 */
export const bookingApprovedEvent = eventType("booking/approved", {
  schema: staticSchema<{ bookingId: string }>(),
});

/**
 * Sent by the reviewer's booking refusal, after the transaction commits. The
 * twin of `drone/rejected`, and for the same reason: the decision must not be
 * held open by a mail provider.
 */
export const bookingRejectedEvent = eventType("booking/rejected", {
  schema: staticSchema<{ bookingId: string }>(),
});

export const zoneClosurePublishedEvent = eventType("zone/closure.published", {
  schema: staticSchema<{ closureId: string }>(),
});

/**
 * Sent by F23b when a zone is suspended. Cancels every future booking in it.
 *
 * **This one carries text, not only an id** — the same exception
 * `droneRevokedEvent` makes, and for the same reason: the reason is the
 * authority's own words, quoted verbatim to each pilot, and no column on `zone`
 * holds it (`audit_event.reason` is the record). Both languages travel, because
 * each pilot is told in theirs.
 */
export const zoneSuspendedEvent = eventType("zone/suspended", {
  schema: staticSchema<{
    zoneId: string;
    reasonAr: string;
    reasonEn: string;
  }>(),
});
