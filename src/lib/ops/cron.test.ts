import { describe, expect, it } from "vitest";
import { nextCronRun } from "./cron";
import { CRON_SCHEDULES, riyadhCron } from "@/lib/inngest/rules";

/**
 * The panel answers *"did the expiry sweep run last night, and when is the next
 * one?"*. A wrong timestamp there is worse than a blank, because nobody
 * re-checks a time the page stated confidently — so the refusal cases matter as
 * much as the arithmetic.
 */

/** 2026-08-22T19:00:00Z — 22:00 in Riyadh, +3. */
const NOW = new Date("2026-08-22T19:00:00Z");

describe("nextCronRun", () => {
  it("finds the next daily run in Riyadh time, not UTC", () => {
    // 03:00 Riyadh on the 23rd is 00:00 UTC on the 23rd.
    expect(nextCronRun("0 3 * * *", NOW)?.toISOString()).toBe(
      "2026-08-23T00:00:00.000Z",
    );
    expect(nextCronRun("15 3 * * *", NOW)?.toISOString()).toBe(
      "2026-08-23T00:15:00.000Z",
    );
  });

  it("handles the hourly and quarter-hourly forms", () => {
    // 22:00 Riyadh exactly; the next :00 is 23:00 Riyadh = 20:00 UTC.
    expect(nextCronRun("0 * * * *", NOW)?.toISOString()).toBe(
      "2026-08-22T20:00:00.000Z",
    );
    expect(nextCronRun("30 * * * *", NOW)?.toISOString()).toBe(
      "2026-08-22T19:30:00.000Z",
    );
    expect(nextCronRun("*/15 * * * *", NOW)?.toISOString()).toBe(
      "2026-08-22T19:15:00.000Z",
    );
  });

  it("strips the TZ prefix riyadhCron adds", () => {
    expect(nextCronRun(riyadhCron("0 3 * * *"), NOW)?.toISOString()).toBe(
      "2026-08-23T00:00:00.000Z",
    );
  });

  it("never returns a time in the past", () => {
    for (const expression of Object.values(CRON_SCHEDULES)) {
      const next = nextCronRun(expression, NOW);
      expect(next, expression).not.toBeNull();
      expect(next!.getTime(), expression).toBeGreaterThan(NOW.getTime());
    }
  });

  /**
   * **Every schedule the app declares must be understood.** If somebody adds
   * one this parser cannot read, they find out here rather than from a blank
   * cell on the system page.
   */
  it("understands every expression in CRON_SCHEDULES", () => {
    for (const [id, expression] of Object.entries(CRON_SCHEDULES)) {
      expect(nextCronRun(expression, NOW), id).not.toBeNull();
    }
  });

  it("refuses what it does not fully understand, rather than guessing", () => {
    // A weekday restriction — fires weekly, and this does not model that.
    expect(nextCronRun("0 3 * * 1", NOW)).toBeNull();
    // A day-of-month restriction.
    expect(nextCronRun("0 3 1 * *", NOW)).toBeNull();
    // Lists and ranges.
    expect(nextCronRun("0,30 3 * * *", NOW)).toBeNull();
    expect(nextCronRun("0 3-5 * * *", NOW)).toBeNull();
    // Malformed.
    expect(nextCronRun("0 3 * *", NOW)).toBeNull();
    expect(nextCronRun("", NOW)).toBeNull();
  });
});
