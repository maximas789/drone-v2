/**
 * Every legal status edge, declared as data.
 *
 * **This file is deliberately incomplete.** F08 needed the four edges the
 * clock drives, and rule 11 ("no status change outside `src/lib/workflow/`")
 * meant they could not be written inline in a job. So the table exists with the
 * *system* edges in it and nothing else.
 *
 * **F14 owns the rest** — every human edge in its two tables (`draft →
 * pending`, `pending → approved`, `approved → revoked`, and so on), together
 * with their guards, their required reasons and their role checks. Add rows
 * here; do not build a second mechanism, and do not widen `actor` on these four
 * to let a human drive them. A pilot who could mark their own booking
 * `completed` is a pilot who never no-shows.
 *
 * Pure by construction: no database, no session, no translation. The table is
 * data, `apply.ts` is what executes it.
 */

export type WorkflowEntity = "drone" | "booking";

/**
 * Who is permitted to drive an edge. Only `"system"` is populated today —
 * F14 adds `"owner"`, `"reviewer"` and `"admin"`.
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
};

export const TRANSITIONS = {
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
