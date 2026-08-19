import { describe, expect, it } from "vitest";
import {
  AGE_BUCKETS,
  AGE_FLAG_DAYS,
  ageBucketOf,
  ageInDays,
  isAgeBucket,
  isOverdue,
  matchesAgeBucket,
  matchesSearch,
} from "./queue";

const NOW = new Date("2026-08-19T10:00:00.000Z");

/** `days` before NOW, to the millisecond. */
function ago(days: number, extraMs = 0): Date {
  return new Date(NOW.getTime() - days * 86_400_000 - extraMs);
}

describe("ageInDays", () => {
  it("floors to whole days", () => {
    expect(ageInDays(ago(0, 1000), NOW)).toBe(0);
    expect(ageInDays(ago(0.99), NOW)).toBe(0);
    expect(ageInDays(ago(1), NOW)).toBe(1);
    expect(ageInDays(ago(1.99), NOW)).toBe(1);
    expect(ageInDays(ago(30), NOW)).toBe(30);
  });

  it("never returns a negative age", () => {
    // Two clocks and one database: a row can land a moment in the future.
    expect(ageInDays(new Date(NOW.getTime() + 5_000), NOW)).toBe(0);
  });

  it("treats a missing timestamp as nought rather than throwing", () => {
    expect(ageInDays(null, NOW)).toBe(0);
    expect(ageInDays(undefined, NOW)).toBe(0);
  });
});

describe("isOverdue", () => {
  it("flags strictly beyond the threshold", () => {
    expect(isOverdue(ago(AGE_FLAG_DAYS), NOW)).toBe(false);
    // Exactly seven days is not yet overdue; a moment past it is.
    expect(isOverdue(ago(AGE_FLAG_DAYS, 1), NOW)).toBe(false);
    expect(isOverdue(ago(AGE_FLAG_DAYS + 1), NOW)).toBe(true);
  });
});

describe("ageBucketOf", () => {
  it("puts every age in exactly one bucket", () => {
    expect(ageBucketOf(ago(0), NOW)).toBe("today");
    expect(ageBucketOf(ago(0.9), NOW)).toBe("today");
    expect(ageBucketOf(ago(1), NOW)).toBe("week");
    expect(ageBucketOf(ago(AGE_FLAG_DAYS), NOW)).toBe("week");
    expect(ageBucketOf(ago(AGE_FLAG_DAYS + 1), NOW)).toBe("overdue");
    expect(ageBucketOf(ago(400), NOW)).toBe("overdue");
  });

  it("agrees with isOverdue at every boundary", () => {
    for (let days = 0; days <= AGE_FLAG_DAYS + 3; days += 1) {
      const at = ago(days);
      expect(ageBucketOf(at, NOW) === "overdue").toBe(isOverdue(at, NOW));
    }
  });

  it("never returns the 'all' pseudo-bucket", () => {
    const returned = [0, 1, 7, 8, 99].map((d) => ageBucketOf(ago(d), NOW));
    expect(returned).not.toContain("all");
    for (const bucket of returned) {
      expect(AGE_BUCKETS).toContain(bucket);
    }
  });
});

describe("matchesAgeBucket", () => {
  it("'all' matches everything, including a missing timestamp", () => {
    expect(matchesAgeBucket("all", ago(99), NOW)).toBe(true);
    expect(matchesAgeBucket("all", null, NOW)).toBe(true);
  });

  it("a specific bucket matches only its own rows", () => {
    expect(matchesAgeBucket("today", ago(0), NOW)).toBe(true);
    expect(matchesAgeBucket("today", ago(3), NOW)).toBe(false);
    expect(matchesAgeBucket("overdue", ago(9), NOW)).toBe(true);
    expect(matchesAgeBucket("week", ago(9), NOW)).toBe(false);
  });
});

describe("isAgeBucket", () => {
  it("fails closed on anything not in the list", () => {
    expect(isAgeBucket("overdue")).toBe(true);
    expect(isAgeBucket("all")).toBe(true);
    expect(isAgeBucket("OVERDUE")).toBe(false);
    expect(isAgeBucket("")).toBe(false);
    expect(isAgeBucket(null)).toBe(false);
    expect(isAgeBucket(7)).toBe(false);
  });
});

describe("matchesSearch", () => {
  const row = ["أحمد الشمري", "Ahmed Alshamri", "AJN-7Q4M-31KD", null];

  it("an empty or blank query matches everything", () => {
    expect(matchesSearch("", row)).toBe(true);
    expect(matchesSearch("   ", row)).toBe(true);
    expect(matchesSearch("", [])).toBe(true);
  });

  it("matches a substring, not only a prefix", () => {
    // The tail of a code, which is what somebody reading one over a radio has.
    expect(matchesSearch("31KD", row)).toBe(true);
    expect(matchesSearch("7Q4M", row)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesSearch("ahmed", row)).toBe(true);
    expect(matchesSearch("AJN-7q4m", row)).toBe(true);
  });

  it("matches the Arabic name as well as the English one", () => {
    expect(matchesSearch("الشمري", row)).toBe(true);
  });

  it("trims the query", () => {
    expect(matchesSearch("  Ahmed  ", row)).toBe(true);
  });

  it("does not match what is not there, and skips null fields", () => {
    expect(matchesSearch("zzz", row)).toBe(false);
    expect(matchesSearch("null", [null, undefined])).toBe(false);
  });
});
