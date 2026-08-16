import { describe, expect, it } from "vitest";
import {
  LIMITS,
  bucketKey,
  rateLimitKey,
  retryAfterSeconds,
  rulesFor,
  windowBounds,
  type LimitedAction,
} from "@/lib/rate-limit/rules";

/**
 * The pure half — `rules.ts`. The counter that writes the rows needs a
 * database and is exercised by hand against one; what is covered here is
 * everything that can be wrong *without* the database noticing.
 */

describe("windowBounds", () => {
  it("aligns to the epoch, not to first use", () => {
    // 12:00:37 in a 60-second window belongs to the window that began at
    // 12:00:00 — not one that begins now and ends 60 seconds later. Aligning
    // to the epoch is what lets two processes agree without coordinating,
    // which is what makes the counter a single upsert.
    const { start, end } = windowBounds(
      new Date("2026-08-16T12:00:37.500Z"),
      60,
    );
    expect(start.toISOString()).toBe("2026-08-16T12:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-16T12:01:00.000Z");
  });

  it("puts two instants in the same minute in the same window", () => {
    const a = windowBounds(new Date("2026-08-16T12:00:01.000Z"), 60);
    const b = windowBounds(new Date("2026-08-16T12:00:59.999Z"), 60);
    expect(a.start.getTime()).toBe(b.start.getTime());
  });

  it("puts an instant one millisecond later in the next window", () => {
    const a = windowBounds(new Date("2026-08-16T12:00:59.999Z"), 60);
    const b = windowBounds(new Date("2026-08-16T12:01:00.000Z"), 60);
    expect(b.start.getTime()).toBe(a.end.getTime());
  });

  it("aligns a day window to UTC midnight", () => {
    const { start, end } = windowBounds(
      new Date("2026-08-16T21:30:00.000Z"),
      86400,
    );
    expect(start.toISOString()).toBe("2026-08-16T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-17T00:00:00.000Z");
  });

  it("gives a minute and a day window the same start at midnight", () => {
    // This is the collision the storage key's `#window` suffix exists to
    // prevent. If this assertion ever stops holding, that suffix can go — and
    // if the suffix goes while this still holds, the two rules share a bucket
    // and silently corrupt each other's count.
    const at = new Date("2026-08-16T00:00:00.000Z");
    expect(windowBounds(at, 60).start.getTime()).toBe(
      windowBounds(at, 86400).start.getTime(),
    );
  });
});

describe("retryAfterSeconds", () => {
  it("rounds up, so the caller is never sent back a moment early", () => {
    const now = new Date("2026-08-16T12:00:37.500Z");
    const { end } = windowBounds(now, 60);
    // 22.5 seconds remain; telling them 22 sends them back to be refused.
    expect(retryAfterSeconds(now, end)).toBe(23);
  });

  it("never returns 0 — 'try again in 0 seconds' reads as a bug", () => {
    const now = new Date("2026-08-16T12:00:59.999Z");
    const { end } = windowBounds(now, 60);
    expect(retryAfterSeconds(now, end)).toBe(1);
  });

  it("never returns a negative for a window that already closed", () => {
    const now = new Date("2026-08-16T12:05:00.000Z");
    expect(retryAfterSeconds(now, new Date("2026-08-16T12:01:00.000Z"))).toBe(1);
  });
});

describe("rateLimitKey", () => {
  it("is {action}:{scope}:{identifier}", () => {
    expect(rateLimitKey("booking.create", "user", "abc")).toBe(
      "booking.create:user:abc",
    );
    expect(rateLimitKey("rid.resolve", "ip", "9f2c")).toBe(
      "rid.resolve:ip:9f2c",
    );
  });

  it("separates the same identifier under different scopes", () => {
    expect(rateLimitKey("rid.resolve", "user", "x")).not.toBe(
      rateLimitKey("rid.resolve", "ip", "x"),
    );
  });
});

describe("bucketKey", () => {
  /**
   * The subtlest bug this feature can have, and it would only appear at
   * midnight: `booking.create` runs a 60-second rule and a 24-hour rule, both
   * of which start at `00:00:00`. Same key plus same `window_start` is the
   * unique index's conflict target, so without the suffix the two rules share
   * one row — and the daily counter is incremented by every per-minute hit,
   * locking a pilot out after three bookings instead of twenty.
   */
  it("separates two rules that share a window_start", () => {
    const key = rateLimitKey("booking.create", "user", "abc");
    expect(bucketKey(key, 60)).not.toBe(bucketKey(key, 86400));
  });

  it("is stable for the same rule", () => {
    const key = rateLimitKey("booking.create", "user", "abc");
    expect(bucketKey(key, 60)).toBe(bucketKey(key, 60));
  });
});

describe("rulesFor", () => {
  it("returns the shortest window first, whatever the declaration order", () => {
    const windows = rulesFor("booking.create").map((rule) => rule.window);
    expect(windows).toEqual([...windows].sort((a, b) => a - b));
  });

  it("does not hand out the array the table is built from", () => {
    // `rulesFor` sorts, and `Array#sort` sorts in place. Returning the
    // constant itself would mean this function quietly reorders what every
    // other reader of `LIMITS` sees. Identity is the check — reordering and
    // re-reading is not, because a second `rulesFor` call would sort it back
    // and the test would pass on a broken implementation.
    expect(rulesFor("booking.create")).not.toBe(LIMITS["booking.create"]);
  });
});

describe("the limit table", () => {
  const actions = Object.keys(LIMITS) as LimitedAction[];

  it("gives every action at least one rule", () => {
    for (const action of actions) {
      expect(LIMITS[action].length).toBeGreaterThan(0);
    }
  });

  it("has no rule that refuses everything", () => {
    for (const action of actions) {
      for (const rule of LIMITS[action]) {
        expect(rule.max).toBeGreaterThan(0);
        expect(rule.window).toBeGreaterThan(0);
      }
    }
  });

  it("keeps booking on two windows — a burst and a day are different attacks", () => {
    const windows = LIMITS["booking.create"].map((rule) => rule.window);
    expect(windows).toContain(60);
    expect(windows).toContain(86400);
  });

  it("allows more per day than per minute, or the daily rule is unreachable", () => {
    // A daily max at or below the per-minute max can never be the rule that
    // refuses — the shorter window always fires first — so the daily limit
    // would be decoration.
    for (const action of actions) {
      const sorted = [...LIMITS[action]].sort((a, b) => a.window - b.window);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].max).toBeGreaterThan(sorted[i - 1].max);
      }
    }
  });

  it("keeps the map check generous enough not to feel broken", () => {
    // F09 is explicit that this one is a backstop, not the primary control:
    // the client debounces at ~250 ms, so a tight server limit would refuse
    // ordinary panning. One per second is the floor.
    const rule = LIMITS["airspace.check"][0];
    expect(rule.max / rule.window).toBeGreaterThanOrEqual(1);
  });

  it("keeps identity reveal tight — it is an act, not traffic", () => {
    const rule = LIMITS["identity.reveal"][0];
    expect(rule.window).toBe(3600);
    expect(rule.max).toBeLessThanOrEqual(20);
  });
});
