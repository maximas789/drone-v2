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
export const zoneClosurePublishedEvent = eventType("zone/closure.published", {
  schema: staticSchema<{ closureId: string }>(),
});
