import { describe, expect, it } from "vitest";
import { PILOT_CANCEL_LEAD_MS, pilotMayCancel, registrationExpiryFrom } from "./rules";

describe("registrationExpiryFrom", () => {
  /**
   * Asserted against **written-out dates**, never against the function's own
   * output. The probe compares the stored column with a call to this same
   * function, which would agree with itself however wrong it was; this is the
   * check that says what three years actually means.
   */
  it("lands on the same calendar day, three years on", () => {
    expect(
      registrationExpiryFrom(new Date("2026-08-17T09:20:22.744Z")).toISOString(),
    ).toBe("2029-08-17T09:20:22.744Z");

    expect(
      registrationExpiryFrom(new Date("2026-01-01T00:00:00.000Z")).toISOString(),
    ).toBe("2029-01-01T00:00:00.000Z");
  });

  it("does not drift across the leap years in the window", () => {
    /**
     * The bug this catches: `+ 3 * 365 * 86_400_000`. 2026→2029 contains one
     * leap day (2028), so the naive arithmetic lands on **16** August, and the
     * card a pilot carries would disagree with the certificate by a day.
     */
    const issued = new Date("2026-08-17T00:00:00.000Z");
    const naive = new Date(issued.getTime() + 3 * 365 * 86_400_000);
    expect(naive.toISOString().slice(0, 10)).toBe("2029-08-16");
    expect(registrationExpiryFrom(issued).toISOString().slice(0, 10)).toBe(
      "2029-08-17",
    );
  });

  it("rolls 29 February to 1 March", () => {
    // A drone registered on 29 February 2028 expires in 2031, which has no such
    // date. JavaScript's answer is 1 March, which is also the reading a pilot
    // would expect: the three years are complete and the next day is not.
    expect(
      registrationExpiryFrom(new Date("2028-02-29T06:00:00.000Z"))
        .toISOString()
        .slice(0, 10),
    ).toBe("2031-03-01");
  });

  it("keeps the time of day", () => {
    // The registration expires at the instant it was issued, not at midnight —
    // a drone approved at 14:00 is registered until 14:00 three years later.
    const issued = new Date("2026-05-05T14:30:45.123Z");
    expect(registrationExpiryFrom(issued).toISOString().slice(11)).toBe(
      issued.toISOString().slice(11),
    );
  });

  it("never returns a date before the issue date", () => {
    for (const iso of [
      "2026-12-31T23:59:59.999Z",
      "2027-02-28T00:00:00.000Z",
      "2028-02-29T12:00:00.000Z",
    ]) {
      const issued = new Date(iso);
      expect(registrationExpiryFrom(issued).getTime()).toBeGreaterThan(
        issued.getTime(),
      );
    }
  });
});

describe("pilotMayCancel", () => {
  const slot = new Date("2026-08-23T05:00:00.000Z");
  const before = (ms: number) => new Date(slot.getTime() - ms);

  it("allows a cancellation more than two hours ahead", () => {
    expect(pilotMayCancel(slot, before(48 * 3_600_000))).toBe(true);
    expect(pilotMayCancel(slot, before(3 * 3_600_000))).toBe(true);
  });

  it("refuses one inside the last two hours", () => {
    expect(pilotMayCancel(slot, before(90 * 60_000))).toBe(false);
    expect(pilotMayCancel(slot, before(60_000))).toBe(false);
  });

  it("allows the boundary exactly, and refuses a millisecond later", () => {
    expect(pilotMayCancel(slot, before(PILOT_CANCEL_LEAD_MS))).toBe(true);
    expect(pilotMayCancel(slot, before(PILOT_CANCEL_LEAD_MS - 1))).toBe(false);
  });

  it("refuses once the slot has started", () => {
    expect(pilotMayCancel(slot, slot)).toBe(false);
    expect(pilotMayCancel(slot, new Date(slot.getTime() + 60_000))).toBe(false);
  });
});
