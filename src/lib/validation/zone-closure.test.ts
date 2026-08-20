import { describe, expect, it } from "vitest";
import { riyadhParts } from "@/lib/airspace/time";
import {
  MAX_CLOSURE_DAYS,
  MIN_REASON_LENGTH,
  closureInstant,
  closureOverlaps,
  emptyClosureDraft,
  overlappingClosures,
  validateClosure,
  type ClosureDraft,
} from "./zone-closure";

/**
 * A closure's rules, against the clock and against each other.
 *
 * The reason the arithmetic is tested rather than trusted: publishing a closure
 * **cancels real bookings**. A window typed the wrong way round, or one whose
 * `HH:mm` was read as UTC, does not fail loudly — it silently covers a
 * different three hours than the person who typed it meant, and the first
 * anybody hears of it is a pilot asking why their flight was cancelled.
 */

const REASON_AR = "إغلاق مؤقت لفعالية رسمية في المنطقة";
const REASON_EN = "Temporary closure for an official event in the zone";

function draft(over: Partial<ClosureDraft> = {}): ClosureDraft {
  return {
    ...emptyClosureDraft(),
    startYmd: "2026-09-10",
    startHhMm: "18:00",
    endYmd: "2026-09-11",
    endHhMm: "06:00",
    reasonAr: REASON_AR,
    reasonEn: REASON_EN,
    ...over,
  };
}

const NOW = new Date("2026-09-01T00:00:00Z");

describe("closureInstant", () => {
  it("reads HH:mm as Riyadh local, not UTC", () => {
    const at = closureInstant("2026-09-10", "18:00");
    expect(at?.toISOString()).toBe("2026-09-10T15:00:00.000Z");
  });

  it("round-trips through the same civil fields it was given", () => {
    const at = closureInstant("2026-12-31", "23:30");
    const parts = riyadhParts(at!);
    expect(parts.ymd).toBe("2026-12-31");
    expect(parts.minutesOfDay).toBe(23 * 60 + 30);
  });

  it("refuses a malformed date or time", () => {
    expect(closureInstant("2026-9-10", "18:00")).toBeNull();
    expect(closureInstant("2026-09-10", "25:00")).toBeNull();
    expect(closureInstant("2026-09-10", "")).toBeNull();
  });
});

describe("validateClosure", () => {
  it("accepts a window that crosses midnight and a day boundary", () => {
    const result = validateClosure(draft(), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.startsAt.toISOString()).toBe("2026-09-10T15:00:00.000Z");
    expect(result.value.endsAt.toISOString()).toBe("2026-09-11T03:00:00.000Z");
    expect(result.value.authorityRef).toBeNull();
  });

  it("names a missing start and a missing end separately", () => {
    const result = validateClosure(
      draft({ startHhMm: "", endYmd: "" }),
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContain("closure_start_required");
    expect(result.problems).toContain("closure_end_required");
  });

  it("refuses a window that ends before it starts", () => {
    const result = validateClosure(
      draft({ endYmd: "2026-09-10", endHhMm: "06:00" }),
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContain("closure_not_ordered");
  });

  it("refuses a zero-length window — half-open closes nothing", () => {
    const result = validateClosure(
      draft({ endYmd: "2026-09-10", endHhMm: "18:00" }),
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContain("closure_not_ordered");
  });

  it("refuses a window that has already ended", () => {
    const result = validateClosure(
      draft({
        startYmd: "2026-08-01",
        endYmd: "2026-08-02",
      }),
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContain("closure_already_over");
  });

  it("allows a window that has started but not ended", () => {
    const result = validateClosure(
      draft({
        startYmd: "2026-08-30",
        startHhMm: "00:00",
        endYmd: "2026-09-05",
        endHhMm: "00:00",
      }),
      NOW,
    );
    expect(result.ok).toBe(true);
  });

  it("refuses a closure longer than the temporary limit, and accepts one at it", () => {
    const start = new Date(Date.UTC(2026, 8, 10));
    const atLimit = new Date(start.getTime() + MAX_CLOSURE_DAYS * 86_400_000);
    const overLimit = new Date(atLimit.getTime() + 86_400_000);
    const ymd = (at: Date) => riyadhParts(at).ymd;

    const ok = validateClosure(
      draft({
        startYmd: "2026-09-10",
        startHhMm: "00:00",
        endYmd: ymd(new Date(atLimit.getTime() - 3 * 3_600_000)),
        endHhMm: "00:00",
      }),
      NOW,
    );
    expect(ok.ok).toBe(true);

    const tooLong = validateClosure(
      draft({
        startYmd: "2026-09-10",
        startHhMm: "00:00",
        endYmd: ymd(new Date(overLimit.getTime() - 3 * 3_600_000)),
        endHhMm: "00:00",
      }),
      NOW,
    );
    expect(tooLong.ok).toBe(false);
    if (tooLong.ok) return;
    expect(tooLong.problems).toContain("closure_too_long");
  });

  it("requires a reason in both languages, each a sentence long", () => {
    const result = validateClosure(
      draft({ reasonAr: "", reasonEn: "closed" }),
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContain("closure_reason_ar_required");
    expect(result.problems).toContain("closure_reason_en_required");
  });

  it("does not count whitespace towards the reason floor", () => {
    const padded = " ".repeat(MIN_REASON_LENGTH + 5);
    const result = validateClosure(
      draft({ reasonAr: padded, reasonEn: padded }),
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContain("closure_reason_ar_required");
    expect(result.problems).toContain("closure_reason_en_required");
  });

  it("trims the stored text and turns a blank reference into null", () => {
    const result = validateClosure(
      draft({
        reasonAr: `  ${REASON_AR}  `,
        reasonEn: `  ${REASON_EN}  `,
        authorityRef: "   ",
      }),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reasonAr).toBe(REASON_AR);
    expect(result.value.reasonEn).toBe(REASON_EN);
    expect(result.value.authorityRef).toBeNull();
  });

  it("refuses an over-long reason and an over-long reference", () => {
    const result = validateClosure(
      draft({
        reasonAr: "ا".repeat(2_001),
        reasonEn: "x".repeat(2_001),
        authorityRef: "y".repeat(121),
      }),
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContain("closure_reason_too_long");
    expect(result.problems).toContain("closure_authority_ref_too_long");
  });
});

describe("closureOverlaps", () => {
  const window = (from: string, to: string) => ({
    startsAt: new Date(from),
    endsAt: new Date(to),
  });

  it("is half-open: touching windows do not overlap", () => {
    const a = window("2026-09-10T12:00:00Z", "2026-09-10T15:00:00Z");
    const b = window("2026-09-10T15:00:00Z", "2026-09-10T18:00:00Z");
    expect(closureOverlaps(a, b)).toBe(false);
    expect(closureOverlaps(b, a)).toBe(false);
  });

  it("catches a one-millisecond intersection from either side", () => {
    const a = window("2026-09-10T12:00:00Z", "2026-09-10T15:00:00.001Z");
    const b = window("2026-09-10T15:00:00Z", "2026-09-10T18:00:00Z");
    expect(closureOverlaps(a, b)).toBe(true);
    expect(closureOverlaps(b, a)).toBe(true);
  });

  it("catches containment in both directions", () => {
    const outer = window("2026-09-10T00:00:00Z", "2026-09-12T00:00:00Z");
    const inner = window("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z");
    expect(closureOverlaps(outer, inner)).toBe(true);
    expect(closureOverlaps(inner, outer)).toBe(true);
  });

  it("returns only the windows that actually overlap", () => {
    const subject = window("2026-09-10T12:00:00Z", "2026-09-10T15:00:00Z");
    const others = [
      { id: "before", ...window("2026-09-09T00:00:00Z", "2026-09-10T12:00:00Z") },
      { id: "inside", ...window("2026-09-10T13:00:00Z", "2026-09-10T14:00:00Z") },
      { id: "after", ...window("2026-09-10T15:00:00Z", "2026-09-11T00:00:00Z") },
    ];
    expect(overlappingClosures(subject, others).map((row) => row.id)).toEqual([
      "inside",
    ]);
  });
});
