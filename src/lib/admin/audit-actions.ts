/**
 * Every `audit_event.action` a **drone or Remote ID trail** can contain.
 *
 * A plain module, not a component: F22's review screen renders it and F25's
 * audit browser will too, and a `"use client"` module's exports are client
 * references that a Server Component cannot call (thread 59). Nothing here
 * imports React, `next-intl` or the database.
 *
 * **The list exists so a missing translation is a failing test rather than a
 * raw dotted code on a regulator-facing screen.** `i18n:check` compares the two
 * catalogues to each other, so a key absent from *both* is absent consistently
 * and passes — the exact hole that put `bookings.statusPending` on a page in
 * F21b. `audit-actions.test.ts` closes it the same way `status-labels.test.ts`
 * did for the status badges: it asserts every member below has a label in `ar`
 * and in `en`, and that no stray label survives for an action nothing writes.
 *
 * Two lists, one lookup. A **drone** trail and a **booking** trail are the two
 * surfaces that render events, and they draw from disjoint sets of actions —
 * but `hasTrailLabel` answers for both, because the component that renders a
 * trail should not have to know which screen it is on to decide whether a row
 * is sayable.
 */
export const DRONE_TRAIL_ACTIONS = [
  "drone.submitted",
  "drone.resubmitted",
  "drone.renewal_submitted",
  "drone.approved",
  "drone.rejected",
  "drone.revoked",
  "drone.reinstated",
  "drone.expired",
  "drone.photo_added",
  "drone.photo_removed",
  "remote_id.issued",
  "remote_id.suspended",
  "remote_id.reactivated",
  "remote_id.collision",
  "remote_id.identity_revealed",
  "remote_id.reported",
  "remote_id.module_declared",
  "remote_id.declaration_filed",
  "remote_id.declaration_verified",
  "remote_id.declaration_rejected",
  "remote_id.declaration_superseded",
  "remote_id.broadcast_capability_changed",
  "declaration.document_uploaded",
] as const;

export type DroneTrailAction = (typeof DRONE_TRAIL_ACTIONS)[number];

/**
 * Every `audit_event.action` a **booking trail** can contain — F22b's screen.
 *
 * All eight transitions in `workflow/transitions.ts` that write against a
 * `booking` entity, including the three no person performs:
 * `cancelled_by_closure` is an Inngest fan-out, `no_show` and `completed` are
 * the sweep. They appear on the trail with the **System** badge, and leaving
 * them unlabelled would print a dotted code onto the record of a flight nobody
 * turned up for.
 */
export const BOOKING_TRAIL_ACTIONS = [
  /**
   * Not transitions, and found by the coverage test rather than by reading:
   * `booking.requested` is written by `booking/create.ts` when the seat is
   * claimed, and `booking.checked_in` by `workflow/booking.ts` — a check-in
   * does not change the status, so it has no edge in `transitions.ts`. Both are
   * the first and last rows a booking trail shows.
   */
  "booking.requested",
  "booking.checked_in",
  "booking.auto_approved",
  "booking.approved",
  "booking.rejected",
  "booking.cancelled_by_pilot",
  "booking.cancelled_by_authority",
  "booking.cancelled_by_closure",
  "booking.completed",
  "booking.no_show",
] as const;

export type BookingTrailAction = (typeof BOOKING_TRAIL_ACTIONS)[number];

export type TrailAction = DroneTrailAction | BookingTrailAction;

const KNOWN = new Set<string>([
  ...DRONE_TRAIL_ACTIONS,
  ...BOOKING_TRAIL_ACTIONS,
]);

/**
 * The catalogue key for an action — **dots replaced with underscores.**
 *
 * `next-intl` treats `.` in a key path as a **namespace separator**, so
 * `t("auditActions.drone.approved")` looks for a *nested* `drone` object and
 * finds nothing when the catalogue holds a flat `"drone.approved"`. It then
 * renders the whole path as literal text: the trail printed
 * `review.auditActions.drone.resubmitted` beside a real event, on the
 * regulator's approval log.
 *
 * **Every static check was green** — `typecheck`, `lint`, `i18n:check` and the
 * first version of `audit-actions.test.ts`, which asserted the JSON *had* a key
 * called `drone.resubmitted`. It did. What no check saw is that next-intl could
 * not reach it. Found by opening the page; thread 11 again.
 *
 * The transformation lives here rather than inline at the call site so the
 * component and the test apply the identical one, and so the test can assert
 * the property that actually broke: no key under `auditActions` may contain a
 * dot.
 */
export function trailLabelKey(action: string): string {
  return action.replaceAll(".", "_");
}

/**
 * Whether a label exists for this action.
 *
 * The trail renders **whatever is in the table**, including a row written by a
 * future feature this list has not caught up with — so the caller falls back to
 * the raw code rather than throwing. An untranslated code on the screen is
 * ugly; a 500 on the regulator's approval trail is a great deal worse, and the
 * append-only table is precisely the place that must never fail to render.
 */
export function hasTrailLabel(action: string): action is TrailAction {
  return KNOWN.has(action);
}
