import { describe, expect, it } from "vitest";
import { isOwnSubmission } from "./rules";

/**
 * The rule that makes an approval mean something. Tested here rather than
 * only through a page, because the page is one of *four* surfaces that ask it
 * — drone decisions, booking decisions, identity verification and declared
 * modules — and every one of them refuses in the workflow, not in the markup.
 */
describe("isOwnSubmission", () => {
  it("matches the submitter deciding their own record", () => {
    expect(isOwnSubmission("user_a", "user_a")).toBe(true);
  });

  it("lets anybody else decide it", () => {
    expect(isOwnSubmission("user_a", "user_b")).toBe(false);
  });

  /**
   * The case that would turn an unreadable row into a blocked decision. A
   * record whose owner is unknown is not "yours"; the caller's own `not_found`
   * is what handles a genuinely missing row.
   */
  it("does not treat an unknown owner as a match", () => {
    expect(isOwnSubmission("user_a", null)).toBe(false);
    expect(isOwnSubmission("user_a", undefined)).toBe(false);
    expect(isOwnSubmission("user_a", "")).toBe(false);
  });

  /**
   * The mutation that would stop the clock. A **system** actor — the expiry
   * sweep, the closure fan-out — has no user id, and two nulls comparing equal
   * would make every automated transition refuse itself as self-dealing.
   */
  it("never matches a system actor", () => {
    expect(isOwnSubmission(null, null)).toBe(false);
    expect(isOwnSubmission(null, "user_a")).toBe(false);
    expect(isOwnSubmission(undefined, undefined)).toBe(false);
  });

  /** Ids are opaque strings and are compared as such — no trimming, no casing. */
  it("compares exactly", () => {
    expect(isOwnSubmission("user_a", "USER_A")).toBe(false);
    expect(isOwnSubmission("user_a", " user_a")).toBe(false);
  });
});
