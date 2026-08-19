import { describe, expect, it } from "vitest";
import { formatDate, riyadhDayKey } from "@/lib/format";
import {
  inclusiveEndOf,
  registrationAtSlot,
  riyadhMidnight,
} from "./validity";

/**
 * The round trip that broke on screen: a reviewer typed 31 December 2029 into
 * "valid until", the row stored the correct **exclusive** bound, and the page
 * then printed "until 1 January 2030". Both halves were individually right.
 */
describe("riyadhMidnight", () => {
  it("reads a YYYY-MM-DD as Riyadh civil midnight, +3 fixed", () => {
    // 2026-01-01 00:00 in Riyadh is 2025-12-31 21:00 UTC.
    expect(riyadhMidnight("2026-01-01")?.toISOString()).toBe(
      "2025-12-31T21:00:00.000Z",
    );
  });

  it("returns the exclusive bound for an end date", () => {
    // "Valid until 31 December 2029" covers the whole of that day, so the
    // bound is midnight at the start of the 1st.
    expect(riyadhMidnight("2029-12-31", true)?.toISOString()).toBe(
      "2029-12-31T21:00:00.000Z",
    );
  });

  it("refuses anything that is not a plain calendar day", () => {
    expect(riyadhMidnight("")).toBeNull();
    expect(riyadhMidnight("2026-1-1")).toBeNull();
    expect(riyadhMidnight("31/12/2029")).toBeNull();
    expect(riyadhMidnight("2026-13-45")).toBeNull();
    expect(riyadhMidnight("2026-01-01T00:00:00Z")).toBeNull();
  });
});

describe("inclusiveEndOf", () => {
  it("lands on the last day the window actually covers", () => {
    const stored = riyadhMidnight("2029-12-31", true);
    expect(stored).not.toBeNull();
    // The thing the reviewer typed is the thing they read back.
    expect(formatDate(inclusiveEndOf(stored!), "en")).toBe("31 December 2029");
    expect(formatDate(stored!, "en")).toBe("1 January 2030");
  });

  it("round-trips every day of a month, including a leap day", () => {
    for (const ymd of [
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
      "2026-12-31",
      "2027-01-01",
    ]) {
      const stored = riyadhMidnight(ymd, true);
      expect(stored).not.toBeNull();
      // `riyadhDayKey` is the codebase's own "which Riyadh civil day is this",
      // and going through it rather than a bare `Intl` is what the ESLint rule
      // is for — the assertion is about the *app's* notion of a day.
      expect(riyadhDayKey(inclusiveEndOf(stored!))).toBe(ymd);
    }
  });
});

describe("registrationAtSlot", () => {
  const slotStart = new Date("2026-08-20T06:00:00.000Z");
  const slotEnd = new Date("2026-08-20T08:00:00.000Z");

  it("is `valid` only when the expiry outlives the whole slot", () => {
    expect(
      registrationAtSlot(new Date("2026-08-20T08:00:00.001Z"), slotStart, slotEnd),
    ).toBe("valid");
    expect(registrationAtSlot(new Date("2029-01-01T00:00:00Z"), slotStart, slotEnd)).toBe(
      "valid",
    );
  });

  /**
   * The case the screen exists for, and the one the engine refuses: a flight
   * that takes off registered and lands unregistered.
   */
  it("is `expires_during` for an expiry inside the slot, boundary included", () => {
    expect(
      registrationAtSlot(new Date("2026-08-20T07:00:00Z"), slotStart, slotEnd),
    ).toBe("expires_during");
    // `<= slotEnd` is the engine's own comparison, restated here.
    expect(registrationAtSlot(slotEnd, slotStart, slotEnd)).toBe("expires_during");
  });

  it("is `expired` at or before the slot begins", () => {
    expect(registrationAtSlot(slotStart, slotStart, slotEnd)).toBe("expired");
    expect(
      registrationAtSlot(new Date("2026-01-01T00:00:00Z"), slotStart, slotEnd),
    ).toBe("expired");
  });

  it("says `unknown` rather than guessing when nothing is recorded", () => {
    expect(registrationAtSlot(null, slotStart, slotEnd)).toBe("unknown");
    expect(registrationAtSlot(undefined, slotStart, slotEnd)).toBe("unknown");
  });
});
