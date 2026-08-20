import { describe, expect, it } from "vitest";
import {
  TRANSITIONS,
  actorKindsFor,
  actorMayDrive,
  isAlreadyApplied,
  isLegalEdge,
  reasonIsSufficient,
  transitionFor,
  type TransitionName,
} from "./transitions";

const names = Object.keys(TRANSITIONS) as TransitionName[];

const SYSTEM = { userId: null, role: null, isSystem: true };
const owner = (id: string) => ({ userId: id, role: "pilot", isSystem: false });
const reviewer = (id = "rev") => ({
  userId: id,
  role: "reviewer",
  isSystem: false,
});
const admin = (id = "adm") => ({ userId: id, role: "admin", isSystem: false });

describe("the table itself", () => {
  it("names every edge after the audit action it writes", () => {
    // The key and the action string are the same word for a reason: an audit
    // trail you can grep for `booking.no_show` should find the edge that wrote
    // it, without a lookup table in somebody's head.
    for (const name of names) {
      expect(transitionFor(name).action).toBe(name);
    }
  });

  it("never lets an edge start where it ends", () => {
    for (const name of names) {
      const def = transitionFor(name);
      expect(def.from).not.toContain(def.to);
    }
  });

  it("gives every edge at least one actor", () => {
    for (const name of names) {
      expect(transitionFor(name).actors.length).toBeGreaterThan(0);
    }
  });

  it("requires a written reason on every edge that takes something away", () => {
    /**
     * Rejection, revocation and an authority's cancellation all end with a
     * pilot being told no. Each one must carry a reason the pilot can read and
     * a regulator can audit — "no" is not an answer to somebody's registration.
     */
    for (const name of [
      "drone.rejected",
      "drone.revoked",
      "drone.reinstated",
      "booking.rejected",
      "booking.cancelled_by_authority",
    ] as const) {
      expect(transitionFor(name).reasonMinLength).toBe(20);
    }
  });

  it("keeps every system edge system-only", () => {
    /**
     * A pilot who could mark their own booking `completed` is a pilot who never
     * no-shows, and a drone that could expire itself is one that never appears
     * in the sweep. These four belong to the clock.
     */
    for (const name of [
      "drone.expired",
      "booking.completed",
      "booking.no_show",
      "booking.cancelled_by_closure",
    ] as const) {
      expect(transitionFor(name).actors).toEqual(["system"]);
    }
  });
});

describe("who may drive what", () => {
  it("lets an admin revoke and refuses a reviewer", () => {
    expect(actorMayDrive("drone.revoked", ["admin"])).toBe(true);
    expect(actorMayDrive("drone.revoked", ["reviewer"])).toBe(false);
    expect(actorMayDrive("drone.revoked", ["owner"])).toBe(false);
  });

  it("refuses a pilot approving their own drone", () => {
    // The owner of a pending drone holds exactly one kind, and it is not one
    // that appears on the approval edge.
    const kinds = actorKindsFor(owner("pilot-1"), "pilot-1");
    expect(kinds).toEqual(["owner"]);
    expect(actorMayDrive("drone.approved", kinds)).toBe(false);
  });

  it("refuses the clock an edge that belongs to a person", () => {
    expect(actorMayDrive("drone.submitted", ["system"])).toBe(false);
    expect(actorMayDrive("booking.cancelled_by_pilot", ["system"])).toBe(false);
  });

  it("refuses a person an edge that belongs to the clock", () => {
    expect(actorMayDrive("booking.no_show", ["admin", "reviewer"])).toBe(false);
    expect(actorMayDrive("drone.expired", ["owner"])).toBe(false);
  });
});

describe("actorKindsFor", () => {
  it("gives the system exactly one kind", () => {
    expect(actorKindsFor(SYSTEM, "pilot-1")).toEqual(["system"]);
  });

  it("gives a reviewer who owns the row both kinds", () => {
    /**
     * Staff are pilots too — this product is for people who build their own
     * aircraft, and a reviewer cancelling **their own** booking must be able to.
     * Collapsing this to a single "highest" kind would lock staff out of the
     * app as users.
     */
    const kinds = actorKindsFor(reviewer("rev-1"), "rev-1");
    expect(kinds).toContain("owner");
    expect(kinds).toContain("reviewer");
    expect(actorMayDrive("booking.cancelled_by_pilot", kinds)).toBe(true);
    expect(actorMayDrive("booking.approved", kinds)).toBe(true);
  });

  it("gives an admin the reviewer kind as well", () => {
    // Everything a reviewer may do, an admin may do. Listing both on every edge
    // would be the kind of duplication one missed entry turns into a bug.
    const kinds = actorKindsFor(admin("adm-1"), "someone-else");
    expect(kinds).toEqual(["admin", "reviewer"]);
    expect(actorMayDrive("drone.approved", kinds)).toBe(true);
    expect(actorMayDrive("drone.revoked", kinds)).toBe(true);
  });

  it("does not make a stranger an owner", () => {
    expect(actorKindsFor(owner("pilot-1"), "pilot-2")).toEqual([]);
    expect(actorKindsFor(owner("pilot-1"), null)).toEqual([]);
  });

  it("does not let a null actor id match a null owner", () => {
    /**
     * The dangerous case: a deleted user leaves `set null` behind on some
     * columns, and an actor with no id must never come out as that row's owner.
     */
    expect(
      actorKindsFor({ userId: null, role: "pilot", isSystem: false }, null),
    ).toEqual([]);
  });
});

describe("legal edges", () => {
  it("accepts the statuses an edge starts from and nothing else", () => {
    expect(isLegalEdge("drone.approved", "pending")).toBe(true);
    expect(isLegalEdge("drone.approved", "draft")).toBe(false);
    expect(isLegalEdge("drone.approved", "revoked")).toBe(false);

    expect(isLegalEdge("booking.cancelled_by_pilot", "pending")).toBe(true);
    expect(isLegalEdge("booking.cancelled_by_pilot", "approved")).toBe(true);
    expect(isLegalEdge("booking.cancelled_by_pilot", "completed")).toBe(false);
  });

  it("reports a row already at the target as already applied", () => {
    // What makes every sweep safe to run twice.
    expect(isAlreadyApplied("drone.expired", "expired")).toBe(true);
    expect(isAlreadyApplied("drone.expired", "approved")).toBe(false);
  });

  it("routes renewal and resubmission back into the same queue", () => {
    expect(transitionFor("drone.resubmitted").to).toBe("pending");
    expect(transitionFor("drone.renewal_submitted").to).toBe("pending");
    expect(isLegalEdge("drone.resubmitted", "rejected")).toBe(true);
    expect(isLegalEdge("drone.renewal_submitted", "expired")).toBe(true);
    // A rejected drone is not an expired one, and the two doors are separate.
    expect(isLegalEdge("drone.renewal_submitted", "rejected")).toBe(false);
  });
});

describe("the written reason", () => {
  it("refuses five characters and accepts twenty", () => {
    expect(reasonIsSufficient("drone.rejected", "no")).toBe(false);
    expect(reasonIsSufficient("drone.rejected", "too dark")).toBe(false);
    expect(
      reasonIsSufficient(
        "drone.rejected",
        "The serial plate photograph is unreadable.",
      ),
    ).toBe(true);
  });

  it("does not count whitespace as a reason", () => {
    expect(reasonIsSufficient("drone.rejected", " ".repeat(40))).toBe(false);
    expect(reasonIsSufficient("drone.rejected", "\n\n\n")).toBe(false);
  });

  it("treats a missing reason as insufficient where one is required", () => {
    expect(reasonIsSufficient("drone.revoked", null)).toBe(false);
    expect(reasonIsSufficient("drone.revoked", undefined)).toBe(false);
  });

  it("asks for nothing where none is required", () => {
    expect(reasonIsSufficient("drone.approved", null)).toBe(true);
    expect(reasonIsSufficient("booking.cancelled_by_pilot", null)).toBe(true);
    expect(reasonIsSufficient("drone.expired", null)).toBe(true);
  });
});

/**
 * **The zone lifecycle** — F23b's third entity. Airspace is drawn by an admin
 * and by nobody else, and the table is where that is stated once.
 */
describe("the zone lifecycle", () => {
  const zoneEdges = names.filter(
    (name) => transitionFor(name).entity === "zone",
  );

  it("has the three edges the lifecycle needs and no more", () => {
    expect(zoneEdges.sort()).toEqual([
      "zone.archived",
      "zone.published",
      "zone.suspended",
    ]);
  });

  it("lets an admin drive every zone edge and a reviewer none of them", () => {
    for (const name of zoneEdges) {
      expect(actorMayDrive(name, actorKindsFor(admin(), null))).toBe(true);
      expect(actorMayDrive(name, actorKindsFor(reviewer(), null))).toBe(false);
    }
  });

  /**
   * A zone has no owner, so `lockRow` hands `null` here. Both sides must be
   * present for `owner` to be awarded — which is what stops the admin who drew
   * a zone from holding a relationship to it that the table never granted.
   */
  it("never awards owner on a zone, whoever asks", () => {
    expect(actorKindsFor(owner("someone"), null)).toEqual([]);
    for (const name of zoneEdges) {
      expect(actorMayDrive(name, actorKindsFor(owner("someone"), null))).toBe(
        false,
      );
    }
  });

  it("publishes from a draft and from a suspension, but never from an archive", () => {
    expect(isLegalEdge("zone.published", "draft")).toBe(true);
    expect(isLegalEdge("zone.published", "suspended")).toBe(true);
    expect(isLegalEdge("zone.published", "archived")).toBe(false);
    expect(isAlreadyApplied("zone.published", "active")).toBe(true);
  });

  it("suspends only what is live, and demands a written reason", () => {
    expect(isLegalEdge("zone.suspended", "active")).toBe(true);
    expect(isLegalEdge("zone.suspended", "draft")).toBe(false);
    expect(reasonIsSufficient("zone.suspended", "closed")).toBe(false);
    expect(
      reasonIsSufficient(
        "zone.suspended",
        "Runway works at the adjacent airfield until further notice.",
      ),
    ).toBe(true);
  });

  it("archives from anywhere still open, and asks for no reason", () => {
    expect(isLegalEdge("zone.archived", "draft")).toBe(true);
    expect(isLegalEdge("zone.archived", "active")).toBe(true);
    expect(isLegalEdge("zone.archived", "suspended")).toBe(true);
    expect(reasonIsSufficient("zone.archived", null)).toBe(true);
  });
});

/**
 * A moved boundary sends an approved flight **back to a reviewer**, not to the
 * bin. The two live in the same table so the difference is readable.
 */
describe("flagging a booking after a boundary change", () => {
  it("returns an approved booking to pending, keeping its seat", () => {
    const def = transitionFor("booking.flagged_for_review");
    expect(def.entity).toBe("booking");
    expect(def.from).toEqual(["approved"]);
    expect(def.to).toBe("pending");
  });

  it("is admin-only — a reviewer does not redraw airspace", () => {
    expect(
      actorMayDrive("booking.flagged_for_review", actorKindsFor(admin(), null)),
    ).toBe(true);
    expect(
      actorMayDrive(
        "booking.flagged_for_review",
        actorKindsFor(reviewer(), null),
      ),
    ).toBe(false);
    expect(
      actorMayDrive("booking.flagged_for_review", actorKindsFor(SYSTEM, null)),
    ).toBe(false);
  });

  it("does nothing to a booking already pending", () => {
    expect(isAlreadyApplied("booking.flagged_for_review", "pending")).toBe(true);
    expect(isLegalEdge("booking.flagged_for_review", "pending")).toBe(false);
  });

  /** The distinction the trail has to record: flagged is not cancelled. */
  it("is not the closure cancellation wearing a different name", () => {
    expect(transitionFor("booking.cancelled_by_closure").to).toBe("cancelled");
    expect(transitionFor("booking.flagged_for_review").to).toBe("pending");
  });
});
