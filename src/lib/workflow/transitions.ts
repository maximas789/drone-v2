/**
 * Every legal status edge, declared as data.
 *
 * F08 wrote the four edges the clock drives. **F14 completed the table** with
 * every human edge from both lifecycles, and added the role branch in
 * `apply.ts` that reads `actors` here.
 *
 * Pure by construction: no database, no session, no translation. The table is
 * data; `apply.ts` is what executes it. A guard that needs to *read* something —
 * whether a profile is complete, whether a slot is more than two hours away —
 * lives in `drone.ts` or `booking.ts`, because a table that could run a query
 * would stop being readable as a list of what is allowed.
 */

export type WorkflowEntity = "drone" | "booking" | "zone";

/**
 * Who may drive an edge.
 *
 * `owner` is **not a role** — it is the relationship between the actor and the
 * row, resolved in `apply.ts` from `drone.ownerUserId` / `booking.pilotUserId`.
 * An actor can hold several kinds at once: a reviewer cancelling their own
 * booking is both `reviewer` and `owner`, and the edge only needs one of them
 * to match.
 */
export type ActorKind = "system" | "owner" | "reviewer" | "admin";

export type TransitionDef = {
  entity: WorkflowEntity;
  /** Every status the edge may start from. An edge from anywhere else refuses. */
  from: readonly string[];
  to: string;
  /** The `audit_event.action` string. Stable, dotted, never translated. */
  action: string;
  actors: readonly ActorKind[];
  /**
   * Minimum length of a written reason, when one is required.
   *
   * **20 characters for a rejection**, so that "no" is not a valid answer to
   * somebody's registration. It is declared here rather than checked at each
   * call site because a rejection reason that slipped through unvalidated is a
   * blank line in the regulator's trail.
   */
  reasonMinLength?: number;
};

export const TRANSITIONS = {
  // --- Drone: the human edges ---------------------------------------------

  /** Submitted for review. Guarded in `drone.ts` — photos, profile, serial. */
  "drone.submitted": {
    entity: "drone",
    from: ["draft"],
    to: "pending",
    action: "drone.submitted",
    actors: ["owner"],
  },

  /**
   * The decision that turns a form into an aircraft. `drone.ts` sets the
   * registration dates and issues the Remote ID in the same transaction.
   */
  "drone.approved": {
    entity: "drone",
    from: ["pending"],
    to: "approved",
    action: "drone.approved",
    actors: ["reviewer", "admin"],
  },

  "drone.rejected": {
    entity: "drone",
    from: ["pending"],
    to: "rejected",
    action: "drone.rejected",
    actors: ["reviewer", "admin"],
    reasonMinLength: 20,
  },

  /** Edited and sent back. `rejectionCount` goes up; the old reason stays in the trail. */
  "drone.resubmitted": {
    entity: "drone",
    from: ["rejected"],
    to: "pending",
    action: "drone.resubmitted",
    actors: ["owner"],
  },

  /**
   * Renewal after expiry. **The Remote ID code is not reissued** — the row is
   * reactivated, so a sticker already on the airframe keeps resolving.
   */
  "drone.renewal_submitted": {
    entity: "drone",
    from: ["expired"],
    to: "pending",
    action: "drone.renewal_submitted",
    actors: ["owner"],
  },

  /**
   * **Admin only.** Revocation suspends the Remote ID and takes away every
   * future slot; a reviewer who can approve should not also be able to
   * unilaterally ground an aircraft.
   */
  "drone.revoked": {
    entity: "drone",
    from: ["approved"],
    to: "revoked",
    action: "drone.revoked",
    actors: ["admin"],
    reasonMinLength: 20,
  },

  "drone.reinstated": {
    entity: "drone",
    from: ["revoked"],
    to: "approved",
    action: "drone.reinstated",
    actors: ["admin"],
    reasonMinLength: 20,
  },

  /**
   * The nightly sweep. `registrationExpiresAt <= now` is checked by the job
   * against the live row, not passed in — see `src/lib/inngest/rules.ts`.
   */
  "drone.expired": {
    entity: "drone",
    from: ["approved"],
    to: "expired",
    action: "drone.expired",
    actors: ["system"],
  },

  // --- Booking: the human edges -------------------------------------------

  /**
   * A zone with `autoApprove` and a pilot with no recent no-shows. Driven by
   * the owner immediately after the row is created, in the same transaction, so
   * that an auto-approval is a decision in the trail rather than a status that
   * appeared from nowhere.
   */
  "booking.auto_approved": {
    entity: "booking",
    from: ["pending"],
    to: "approved",
    action: "booking.auto_approved",
    actors: ["owner"],
  },

  /** `booking.ts` **re-runs `evaluateAirspace`** before this is allowed through. */
  "booking.approved": {
    entity: "booking",
    from: ["pending"],
    to: "approved",
    action: "booking.approved",
    actors: ["reviewer", "admin"],
  },

  "booking.rejected": {
    entity: "booking",
    from: ["pending"],
    to: "rejected",
    action: "booking.rejected",
    actors: ["reviewer", "admin"],
    reasonMinLength: 20,
  },

  /** Guarded in `booking.ts`: not inside the last two hours before the slot. */
  "booking.cancelled_by_pilot": {
    entity: "booking",
    from: ["pending", "approved"],
    to: "cancelled",
    action: "booking.cancelled_by_pilot",
    actors: ["owner"],
  },

  /** Any time, with a reason. The pilot is told, and told why. */
  "booking.cancelled_by_authority": {
    entity: "booking",
    from: ["pending", "approved"],
    to: "cancelled",
    action: "booking.cancelled_by_authority",
    actors: ["reviewer", "admin"],
    reasonMinLength: 20,
  },

  /** Checked in, and the slot has ended. */
  "booking.completed": {
    entity: "booking",
    from: ["approved"],
    to: "completed",
    action: "booking.completed",
    actors: ["system"],
  },

  /** Never checked in, and the slot ended more than the grace period ago. */
  "booking.no_show": {
    entity: "booking",
    from: ["approved"],
    to: "no_show",
    action: "booking.no_show",
    actors: ["system"],
  },

  /**
   * A published closure, or a revoked drone, has overtaken the slot. Both
   * arrive as fan-out from an Inngest event, one step per booking.
   *
   * `pending` is included because an unreviewed request over a closed window is
   * just as dead as an approved one — leaving it in the queue would put a
   * reviewer in front of a decision that cannot legally go either way.
   */
  "booking.cancelled_by_closure": {
    entity: "booking",
    from: ["pending", "approved"],
    to: "cancelled",
    action: "booking.cancelled_by_closure",
    actors: ["system"],
  },

  /**
   * **A published boundary moved under this flight.** Sent back to `pending`
   * rather than cancelled: a booking has no launch point (threads 37 and 55),
   * so nothing can say whether *this* flight was in the part that was cut
   * away — and a boundary tweak must not quietly void somebody's authorised
   * flight. `pending` is where a human decides, and the seat is held either
   * way because `booking_seat_uniq` covers both statuses.
   *
   * From `approved` only. A booking already `pending` is in the queue already,
   * and re-flagging it would append a second event saying nothing new.
   */
  "booking.flagged_for_review": {
    entity: "booking",
    from: ["approved"],
    to: "pending",
    action: "booking.flagged_for_review",
    actors: ["admin"],
  },

  // --- Zone: the publish lifecycle ----------------------------------------

  /**
   * **A drawing becomes airspace.** From here pilots see the zone, slots derive
   * from it, and the engine authorises against it. `workflow/zone.ts` checks
   * `publishReadiness` first — geometry, both names, a capacity, an
   * operating-hour window for a permitted zone, and no overlap with a published
   * no-fly zone.
   *
   * `suspended` is a legal origin so that lifting a suspension is the same edge
   * as the original publication rather than a second one meaning the same
   * thing.
   */
  "zone.published": {
    entity: "zone",
    from: ["draft", "suspended"],
    to: "active",
    action: "zone.published",
    actors: ["admin"],
  },

  /**
   * Airspace withdrawn, with a written reason that reaches every pilot holding
   * a slot in it. Reversible — that is what separates it from archiving.
   */
  "zone.suspended": {
    entity: "zone",
    from: ["active"],
    to: "suspended",
    action: "zone.suspended",
    actors: ["admin"],
    reasonMinLength: 20,
  },

  /**
   * The end of a zone. **Only with no future bookings** — checked in
   * `workflow/zone.ts` against the live rows, because archiving is not a
   * cancellation and must never silently become one.
   */
  "zone.archived": {
    entity: "zone",
    from: ["draft", "active", "suspended"],
    to: "archived",
    action: "zone.archived",
    actors: ["admin"],
  },
} as const satisfies Record<string, TransitionDef>;

export type TransitionName = keyof typeof TRANSITIONS;

export function transitionFor(name: TransitionName): TransitionDef {
  return TRANSITIONS[name];
}

/** `true` when `from` is a status this edge may legally start from. */
export function isLegalEdge(name: TransitionName, from: string): boolean {
  return (TRANSITIONS[name].from as readonly string[]).includes(from);
}

/**
 * `true` when the row is **already** where the edge would put it.
 *
 * This is what makes every sweep safe to run twice: the second run finds the
 * target status, writes nothing, and reports `already_applied` rather than
 * appending a duplicate audit event and sending a second email.
 */
export function isAlreadyApplied(name: TransitionName, from: string): boolean {
  return TRANSITIONS[name].to === from;
}

/**
 * Every kind an actor holds at once, given the row's owner.
 *
 * **Pure, and here rather than in `apply.ts`, for the reason F09 found the hard
 * way with the rate-limit rules**: logic behind `server-only` is logic no unit
 * test can import. This decides who may do what, which makes it exactly the
 * half that must be testable without a database.
 *
 * A reviewer cancelling **their own** booking is both `reviewer` and `owner`,
 * and an edge only needs one of them to match — collapsing this to a single
 * "highest" kind would stop staff using the app as pilots, which is precisely
 * the population this product is for.
 *
 * A system actor is only ever `system`: a cron has no account, and an edge
 * marked `owner` must never be drivable by the clock.
 */
export function actorKindsFor(
  actor: { userId: string | null; role: string | null; isSystem: boolean },
  ownerUserId: string | null,
): ActorKind[] {
  if (actor.isSystem) return ["system"];

  const kinds: ActorKind[] = [];
  // Both sides must be present. A null actor id matching a null owner would
  // make a deleted account the owner of every row it left behind.
  if (actor.userId && ownerUserId && actor.userId === ownerUserId) {
    kinds.push("owner");
  }
  if (actor.role === "reviewer") kinds.push("reviewer");
  // Everything a reviewer may do, an admin may do. Listing both on every edge
  // would be duplication that one missed entry turns into a privilege gap.
  if (actor.role === "admin") kinds.push("admin", "reviewer");
  return kinds;
}

/** `true` when at least one of the actor's kinds may drive this edge. */
export function actorMayDrive(
  name: TransitionName,
  kinds: readonly ActorKind[],
): boolean {
  const allowed = TRANSITIONS[name].actors as readonly ActorKind[];
  return kinds.some((kind) => allowed.includes(kind));
}

/**
 * The written reason, validated against the edge's own requirement.
 *
 * Trimmed first: twenty spaces is not a reason, and neither is a newline.
 */
export function reasonIsSufficient(
  name: TransitionName,
  reason: string | null | undefined,
): boolean {
  // Through `transitionFor`, not `TRANSITIONS[name]`: `as const satisfies`
  // narrows each entry to its own literal shape, and the edges that need no
  // reason genuinely have no such property to read.
  const required = transitionFor(name).reasonMinLength;
  if (required === undefined) return true;
  return (reason ?? "").trim().length >= required;
}
