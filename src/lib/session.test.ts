import { describe, expect, it } from "vitest";
import {
  isAdmin,
  isReviewer,
  isRole,
  ROLES,
  roleOf,
  type Session,
} from "@/lib/session";

/**
 * `roleOf` is the narrowing every guard in the app depends on, and Better Auth
 * hands us `role` as a nullable `string` rather than a union — so the only
 * thing standing between a junk value and an access decision is this function
 * failing closed. These tests exist because F05 proved that by hand once, with
 * probe accounts that were then deleted.
 */

/** Only `id` and `role` are read; the rest of the session is irrelevant here. */
const sessionWith = (role: unknown): Session =>
  ({ user: { id: "user-1", role } }) as unknown as Session;

describe("ROLES", () => {
  it("is exactly the three roles the app defines", () => {
    expect(ROLES).toEqual(["pilot", "reviewer", "admin"]);
  });
});

describe("isRole", () => {
  it.each(ROLES)("accepts %s", (role) => {
    expect(isRole(role)).toBe(true);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
    ["unknown role", "superuser"],
    ["wrong case", "Admin"],
    ["padded", " admin"],
    ["a number", 1],
    ["an object", { role: "admin" }],
    ["an array of a valid role", ["admin"]],
  ])("rejects %s", (_label, value) => {
    expect(isRole(value)).toBe(false);
  });
});

describe("roleOf", () => {
  it.each(ROLES)("returns %s unchanged", (role) => {
    expect(roleOf(sessionWith(role))).toBe(role);
  });

  // The whole point: anything unrecognised falls to the *least* privileged
  // role. A typo, a hand-edited row or a future enum value must never widen
  // access, and the fallback must never be `reviewer` or `admin`.
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
    ["unknown role", "superuser"],
    ["wrong case", "ADMIN"],
  ])("falls closed to pilot for %s", (_label, value) => {
    expect(roleOf(sessionWith(value))).toBe("pilot");
  });
});

describe("isReviewer", () => {
  it("is true for reviewers and admins — both staff the queues", () => {
    expect(isReviewer(sessionWith("reviewer"))).toBe(true);
    expect(isReviewer(sessionWith("admin"))).toBe(true);
  });

  it.each([["pilot"], ["superuser"], [null]])(
    "is false for %s",
    (value) => {
      expect(isReviewer(sessionWith(value))).toBe(false);
    },
  );
});

describe("isAdmin", () => {
  it("is true only for admins", () => {
    expect(isAdmin(sessionWith("admin"))).toBe(true);
  });

  // A reviewer staffing the queues is not an administrator. This is the line
  // between approving a drone and managing zones, roles and the audit browser.
  it.each([["reviewer"], ["pilot"], ["superuser"], [null]])(
    "is false for %s",
    (value) => {
      expect(isAdmin(sessionWith(value))).toBe(false);
    },
  );
});
