import { describe, expect, it } from "vitest";
import { bucketKey, bucketKeys, bucketStart, densify } from "./buckets";
import { bucketFor, rangeStart, toRangeKey } from "./range";

/**
 * Bucketing is where an analytics screen lies most quietly. A week boundary an
 * hour out, or a missing bucket silently dropped, produces a chart that renders
 * cleanly, passes every static check, and reports the wrong thing — so each
 * case here is one that would have been invisible on screen.
 */

describe("bucketKey", () => {
  it("files an instant under the Riyadh civil day, not the UTC one", () => {
    // 22:30 UTC on the 20th is 01:30 on the 21st in Riyadh. A chart that used
    // the UTC date would put every late-evening booking on the wrong day.
    expect(bucketKey(new Date("2026-08-20T22:30:00Z"), "day")).toBe(
      "2026-08-21",
    );
    expect(bucketKey(new Date("2026-08-21T00:30:00Z"), "day")).toBe(
      "2026-08-21",
    );
  });

  it("starts the week on Sunday, not Monday", () => {
    // 2026-08-21 is a Friday; its week opens on Sunday the 16th. Postgres's
    // own date_trunc('week', ...) would answer Monday the 17th.
    expect(bucketKey(new Date("2026-08-21T09:00:00Z"), "week")).toBe(
      "2026-08-16",
    );
    // A Sunday is the first day of its own week, not the last of the previous.
    expect(bucketKey(new Date("2026-08-16T09:00:00Z"), "week")).toBe(
      "2026-08-16",
    );
    // A Saturday is the last day of that same week.
    expect(bucketKey(new Date("2026-08-22T09:00:00Z"), "week")).toBe(
      "2026-08-16",
    );
  });

  it("files a month by its Riyadh first, not its UTC first", () => {
    // 21:30 UTC on 31 July is 00:30 on 1 August in Riyadh.
    expect(bucketKey(new Date("2026-07-31T21:30:00Z"), "month")).toBe(
      "2026-08-01",
    );
  });

  it("round-trips a key through bucketStart", () => {
    for (const key of ["2026-08-21", "2026-01-01", "2023-06-30"]) {
      expect(bucketKey(bucketStart(key), "day")).toBe(key);
    }
  });
});

describe("bucketKeys", () => {
  it("returns every day in the range, gaps included", () => {
    const keys = bucketKeys(
      new Date("2026-08-18T09:00:00Z"),
      new Date("2026-08-21T09:00:00Z"),
      "day",
    );
    expect(keys).toEqual([
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
    ]);
  });

  it("crosses a month boundary without repeating or skipping a day", () => {
    const keys = bucketKeys(
      new Date("2026-01-30T09:00:00Z"),
      new Date("2026-02-02T09:00:00Z"),
      "day",
    );
    expect(keys).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
      "2026-02-02",
    ]);
  });

  it("crosses a leap-year February", () => {
    const keys = bucketKeys(
      new Date("2028-02-27T09:00:00Z"),
      new Date("2028-03-01T09:00:00Z"),
      "day",
    );
    expect(keys).toEqual(["2028-02-27", "2028-02-28", "2028-02-29", "2028-03-01"]);
  });

  it("steps weeks on Sundays", () => {
    const keys = bucketKeys(
      new Date("2026-08-01T09:00:00Z"),
      new Date("2026-08-21T09:00:00Z"),
      "week",
    );
    expect(keys).toEqual([
      "2026-07-26",
      "2026-08-02",
      "2026-08-09",
      "2026-08-16",
    ]);
  });

  it("steps months by calendar, not by 30 days", () => {
    const keys = bucketKeys(
      new Date("2025-12-15T09:00:00Z"),
      new Date("2026-03-02T09:00:00Z"),
      "month",
    );
    expect(keys).toEqual([
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
  });

  it("returns exactly one bucket when both ends fall in it", () => {
    const keys = bucketKeys(
      new Date("2026-08-21T05:00:00Z"),
      new Date("2026-08-21T19:00:00Z"),
      "day",
    );
    expect(keys).toEqual(["2026-08-21"]);
  });

  it("terminates rather than looping when the range is inverted", () => {
    // A defensive case, not a reachable one: `to` before `from` cannot happen
    // from the range control. The guard is there so a future caller cannot
    // hang a page render.
    const keys = bucketKeys(
      new Date("2026-08-21T09:00:00Z"),
      new Date("2026-08-01T09:00:00Z"),
      "day",
    );
    expect(keys.length).toBeLessThanOrEqual(400);
  });
});

describe("densify", () => {
  it("fills the buckets the database did not return", () => {
    const rows = densify(
      ["2026-08-18", "2026-08-19", "2026-08-20"],
      [{ key: "2026-08-19", value: 5 }],
      () => 0,
    );
    expect(rows.map((r) => r.value)).toEqual([0, 5, 0]);
  });

  it("keeps the key order it was given, not the rows' order", () => {
    const rows = densify(
      ["2026-08-18", "2026-08-19"],
      [
        { key: "2026-08-19", value: 2 },
        { key: "2026-08-18", value: 1 },
      ],
      () => 0,
    );
    expect(rows.map((r) => r.key)).toEqual(["2026-08-18", "2026-08-19"]);
  });

  it("gives each empty bucket its own object, not one shared instance", () => {
    // A shared object would let one bucket's mutation appear in every other
    // empty bucket on the chart.
    const rows = densify<{ n: number }>(["a", "b"], [], () => ({ n: 0 }));
    expect(rows[0]?.value).not.toBe(rows[1]?.value);
  });
});

describe("range", () => {
  it("falls back to 30 days for anything that is not one of the four keys", () => {
    expect(toRangeKey(undefined)).toBe("30");
    expect(toRangeKey("nonsense")).toBe("30");
    expect(toRangeKey("7")).toBe("7");
    expect(toRangeKey("all")).toBe("all");
  });

  it("takes the first value when ?range= arrives twice", () => {
    // An array reaching a gte() is a runtime error on an admin screen.
    expect(toRangeKey(["90", "7"])).toBe("90");
    expect(toRangeKey([])).toBe("30");
  });

  it("opens the range at the start of a Riyadh civil day", () => {
    const start = rangeStart("7", new Date("2026-08-21T09:00:00Z"));
    // Seven days inclusive of today: 15 August, 00:00 Riyadh = 21:00 UTC on
    // the 14th.
    expect(start?.toISOString()).toBe("2026-08-14T21:00:00.000Z");
  });

  it("gives the same boundary whatever time of day the page is opened", () => {
    const morning = rangeStart("30", new Date("2026-08-21T04:00:00Z"));
    const evening = rangeStart("30", new Date("2026-08-21T20:00:00Z"));
    expect(morning?.toISOString()).toBe(evening?.toISOString());
  });

  it("has no boundary at all for 'all'", () => {
    // Not a very old date: a predicate the planner still has to satisfy, and
    // one that would silently exclude a null timestamp.
    expect(rangeStart("all")).toBeNull();
  });

  it("coarsens the grain as the range widens", () => {
    expect(bucketFor("7")).toBe("day");
    expect(bucketFor("30")).toBe("day");
    expect(bucketFor("90")).toBe("week");
    expect(bucketFor("all")).toBe("month");
  });
});
