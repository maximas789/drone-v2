import { describe, expect, it } from "vitest";
import {
  IMMINENT_HOURS,
  SOON_HOURS,
  URGENCY_BUCKETS,
  hoursUntil,
  isUrgencyBucket,
  isUrgent,
  matchesUrgency,
  msUntil,
  urgencyBucketOf,
} from "./urgency";

const NOW = new Date("2026-08-19T10:00:00.000Z");
const HOUR_MS = 3_600_000;

/** `hours` after NOW. Negative goes backwards. */
function inHours(hours: number): Date {
  return new Date(NOW.getTime() + hours * HOUR_MS);
}

describe("msUntil / hoursUntil", () => {
  it("is signed — negative once the slot has started", () => {
    expect(msUntil(inHours(2), NOW)).toBe(2 * HOUR_MS);
    expect(msUntil(inHours(-2), NOW)).toBe(-2 * HOUR_MS);
    expect(msUntil(NOW, NOW)).toBe(0);
  });

  it("floors towards negative infinity, so a started slot never reads as 0", () => {
    expect(hoursUntil(inHours(1.9), NOW)).toBe(1);
    expect(hoursUntil(inHours(-0.5), NOW)).toBe(-1);
  });
});

describe("urgencyBucketOf", () => {
  it("puts every instant in exactly one bucket", () => {
    expect(urgencyBucketOf(inHours(-1), NOW)).toBe("past");
    // The boundary itself is past: a slot starting *now* is not something a
    // reviewer can still decide in time.
    expect(urgencyBucketOf(NOW, NOW)).toBe("past");
    expect(urgencyBucketOf(inHours(0.5), NOW)).toBe("imminent");
    expect(urgencyBucketOf(inHours(IMMINENT_HOURS - 0.01), NOW)).toBe("imminent");
    expect(urgencyBucketOf(inHours(IMMINENT_HOURS), NOW)).toBe("soon");
    expect(urgencyBucketOf(inHours(SOON_HOURS - 0.01), NOW)).toBe("soon");
    expect(urgencyBucketOf(inHours(SOON_HOURS), NOW)).toBe("later");
    expect(urgencyBucketOf(inHours(24 * 30), NOW)).toBe("later");
  });

  it("never returns the `all` pseudo-bucket", () => {
    for (const hours of [-100, 0, 1, 25, 100, 10_000]) {
      expect(urgencyBucketOf(inHours(hours), NOW)).not.toBe("all");
    }
  });
});

describe("isUrgent", () => {
  it("flags a slot inside a day, and one already missed", () => {
    expect(isUrgent(inHours(3), NOW)).toBe(true);
    expect(isUrgent(inHours(-3), NOW)).toBe(true);
  });

  it("leaves the rest alone", () => {
    expect(isUrgent(inHours(IMMINENT_HOURS + 1), NOW)).toBe(false);
    expect(isUrgent(inHours(24 * 14), NOW)).toBe(false);
  });
});

describe("matchesUrgency", () => {
  it("`all` matches everything", () => {
    for (const hours of [-5, 1, 40, 500]) {
      expect(matchesUrgency("all", inHours(hours), NOW)).toBe(true);
    }
  });

  it("every other bucket matches only its own", () => {
    const slot = inHours(2);
    for (const bucket of URGENCY_BUCKETS) {
      expect(matchesUrgency(bucket, slot, NOW)).toBe(
        bucket === "all" || bucket === "imminent",
      );
    }
  });
});

describe("isUrgencyBucket", () => {
  it("narrows a URL value against the closed list", () => {
    expect(isUrgencyBucket("imminent")).toBe(true);
    expect(isUrgencyBucket("all")).toBe(true);
    expect(isUrgencyBucket("<script>")).toBe(false);
    expect(isUrgencyBucket(undefined)).toBe(false);
    expect(isUrgencyBucket(7)).toBe(false);
  });
});
