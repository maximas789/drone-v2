import { describe, expect, it } from "vitest";
import {
  BOOKING_REMINDER_LEAD_HOURS,
  bookingReminderWindow,
  closeoutVerdict,
  CRON_SCHEDULES,
  CRON_TIMEZONE,
  daysUntilRiyadhDay,
  DIGEST_MIN_INTERVAL_MINUTES,
  digestSuppressedSince,
  digestWorthSending,
  EXPIRY_REMINDER_DAYS,
  isRegistrationExpired,
  NO_SHOW_GRACE_MINUTES,
  reminderThresholdFor,
  riyadhCron,
} from "./rules";

/** Riyadh is +03:00, always. `2026-03-15T00:30` Riyadh is 21:30 UTC the day before. */
const riyadh = (isoLocal: string) => new Date(`${isoLocal}+03:00`);

describe("riyadhCron", () => {
  it("prefixes the timezone Inngest expects", () => {
    expect(riyadhCron("0 3 * * *")).toBe("TZ=Asia/Riyadh 0 3 * * *");
  });

  it("names Riyadh, not a fixed offset", () => {
    // A `+03:00` literal would be right today and unreviewable if it ever
    // stopped being right. The IANA zone carries its own history.
    expect(CRON_TIMEZONE).toBe("Asia/Riyadh");
  });

  it("every schedule in the table is five cron fields", () => {
    for (const [id, expression] of Object.entries(CRON_SCHEDULES)) {
      expect(expression.trim().split(/\s+/), id).toHaveLength(5);
    }
  });
});

describe("isRegistrationExpired", () => {
  it("is false for a registration with no expiry at all", () => {
    expect(isRegistrationExpired(null, riyadh("2026-08-16T03:00"))).toBe(false);
  });

  it("is true the instant the expiry passes", () => {
    const expiresAt = riyadh("2026-08-16T00:30");
    expect(isRegistrationExpired(expiresAt, expiresAt)).toBe(true);
  });

  /**
   * The acceptance criterion, and the reason this is not a date comparison.
   * At 03:00 Riyadh on the 15th the UTC date is still the 14th, so any
   * comparison of UTC calendar dates would call a registration expiring at
   * 00:30 Riyadh on the 16th "expired" a full day early.
   */
  it("does not sweep a 00:30 Riyadh expiry on the previous Riyadh day", () => {
    const expiresAt = riyadh("2026-08-16T00:30");
    const previousRun = riyadh("2026-08-15T03:00");
    expect(isRegistrationExpired(expiresAt, previousRun)).toBe(false);
  });

  /**
   * The other half, and the one a Riyadh-day comparison gets wrong: an expiry
   * later **today** has not happened yet. Comparing day keys makes 03:00 today
   * expire a registration that runs until 23:00 tonight.
   */
  it("does not sweep an expiry later the same Riyadh day", () => {
    expect(
      isRegistrationExpired(riyadh("2026-08-16T23:00"), riyadh("2026-08-16T03:00")),
    ).toBe(false);
  });

  it("does sweep it on the next Riyadh day's run", () => {
    const expiresAt = riyadh("2026-08-16T00:30");
    const nextRun = riyadh("2026-08-16T03:00");
    expect(isRegistrationExpired(expiresAt, nextRun)).toBe(true);
  });
});

describe("daysUntilRiyadhDay", () => {
  it("counts civil days, not elapsed 24-hour blocks", () => {
    // 23.5 hours apart, but two different Riyadh days.
    const now = riyadh("2026-08-16T23:00");
    const target = riyadh("2026-08-17T22:30");
    expect(daysUntilRiyadhDay(target, now)).toBe(1);
  });

  it("is 0 for two instants on the same Riyadh day", () => {
    expect(
      daysUntilRiyadhDay(riyadh("2026-08-16T23:59"), riyadh("2026-08-16T00:01")),
    ).toBe(0);
  });

  it("does not shift across the UTC midnight that falls inside a Riyadh day", () => {
    // 02:00 Riyadh is 23:00 UTC the previous day. Both of these are the 16th
    // in Riyadh; in UTC they straddle midnight.
    expect(
      daysUntilRiyadhDay(riyadh("2026-08-16T20:00"), riyadh("2026-08-16T02:00")),
    ).toBe(0);
  });

  it("is negative for a day already past", () => {
    expect(
      daysUntilRiyadhDay(riyadh("2026-08-14T12:00"), riyadh("2026-08-16T12:00")),
    ).toBe(-2);
  });
});

describe("reminderThresholdFor", () => {
  it("hands 60 days out the 60-day warning", () => {
    expect(reminderThresholdFor(60)).toBe(60);
  });

  /** The acceptance criterion: 29 days out is the 30-day reminder, not the 60. */
  it("hands 29 days out the 30-day warning, not the 60", () => {
    expect(reminderThresholdFor(29)).toBe(30);
  });

  it("hands anything at or under 7 days the 7-day warning", () => {
    expect(reminderThresholdFor(7)).toBe(7);
    expect(reminderThresholdFor(1)).toBe(7);
    expect(reminderThresholdFor(0)).toBe(7);
  });

  it("returns null past the widest threshold — nothing is due yet", () => {
    expect(reminderThresholdFor(61)).toBeNull();
    expect(reminderThresholdFor(365)).toBeNull();
  });

  it("returns null once expired — that is the sweep's problem", () => {
    expect(reminderThresholdFor(-1)).toBeNull();
  });

  it("only ever answers with a threshold from the table", () => {
    for (let days = -5; days <= 90; days += 1) {
      const chosen = reminderThresholdFor(days);
      if (chosen !== null) {
        expect(EXPIRY_REMINDER_DAYS, `${days} days out`).toContain(chosen);
      }
    }
  });

  it("never skips a threshold as the days count down", () => {
    // Walking from 60 to 0, the answer may only ever narrow.
    let previous = 60;
    for (let days = 60; days >= 0; days -= 1) {
      const chosen = reminderThresholdFor(days);
      expect(chosen).not.toBeNull();
      expect(chosen!).toBeLessThanOrEqual(previous);
      previous = chosen!;
    }
    expect(previous).toBe(7);
  });
});

describe("closeoutVerdict", () => {
  const slotEnd = riyadh("2026-08-16T18:00");

  it("leaves a running slot alone", () => {
    expect(
      closeoutVerdict({ slotEnd, checkedInAt: null }, riyadh("2026-08-16T17:59")),
    ).toBeNull();
  });

  it("completes a checked-in booking the moment the slot ends", () => {
    expect(
      closeoutVerdict(
        { slotEnd, checkedInAt: riyadh("2026-08-16T17:05") },
        slotEnd,
      ),
    ).toBe("completed");
  });

  it("waits out the grace period before calling a no-show", () => {
    const insideGrace = new Date(
      slotEnd.getTime() + (NO_SHOW_GRACE_MINUTES - 1) * 60_000,
    );
    expect(closeoutVerdict({ slotEnd, checkedInAt: null }, insideGrace)).toBeNull();
  });

  it("calls a no-show exactly at the end of the grace period", () => {
    const graceEnds = new Date(slotEnd.getTime() + NO_SHOW_GRACE_MINUTES * 60_000);
    expect(closeoutVerdict({ slotEnd, checkedInAt: null }, graceEnds)).toBe(
      "no_show",
    );
  });

  /**
   * Check-in wins outright. Someone who flew is `completed` even long after the
   * grace period — the grace period is about *waiting* for a check-in, and there
   * is nothing left to wait for once one exists.
   */
  it("never calls a checked-in booking a no-show, however late the run", () => {
    const muchLater = new Date(slotEnd.getTime() + 30 * 86_400_000);
    expect(
      closeoutVerdict(
        { slotEnd, checkedInAt: riyadh("2026-08-16T17:05") },
        muchLater,
      ),
    ).toBe("completed");
  });
});

describe("bookingReminderWindow", () => {
  const now = riyadh("2026-08-16T12:00");

  it("opens at now, so a booking made inside the window is still caught", () => {
    // The failure this prevents: a slice of `now + 23h … now + 24h` skips any
    // booking created after its own 24-hour mark had passed.
    expect(bookingReminderWindow(now).from.getTime()).toBe(now.getTime());
  });

  it("closes exactly the lead time ahead", () => {
    const { to } = bookingReminderWindow(now);
    expect(to.getTime() - now.getTime()).toBe(
      BOOKING_REMINDER_LEAD_HOURS * 3_600_000,
    );
  });

  it("is a window, not an instant", () => {
    const { from, to } = bookingReminderWindow(now);
    expect(to.getTime()).toBeGreaterThan(from.getTime());
  });
});

describe("digest suppression", () => {
  it("looks back by the stated interval", () => {
    const now = riyadh("2026-08-16T12:30");
    expect(now.getTime() - digestSuppressedSince(now).getTime()).toBe(
      DIGEST_MIN_INTERVAL_MINUTES * 60_000,
    );
  });

  it("is shorter than the hourly schedule, or every second digest would be dropped", () => {
    expect(DIGEST_MIN_INTERVAL_MINUTES).toBeLessThan(60);
  });

  it("sends nothing for an empty queue", () => {
    expect(digestWorthSending({ pendingDrones: 0, pendingBookings: 0 })).toBe(
      false,
    );
  });

  it("sends when either queue has anything in it", () => {
    expect(digestWorthSending({ pendingDrones: 1, pendingBookings: 0 })).toBe(
      true,
    );
    expect(digestWorthSending({ pendingDrones: 0, pendingBookings: 1 })).toBe(
      true,
    );
  });
});
