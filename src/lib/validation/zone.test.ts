import { describe, expect, it } from "vitest";
import { emptyZoneDraft, validateZone, type ZoneDraft } from "./zone";

const base = (overrides: Partial<ZoneDraft> = {}): ZoneDraft => ({
  ...emptyZoneDraft(),
  code: "RUH-P-09",
  cityId: "11111111-1111-1111-1111-111111111111",
  nameAr: "منطقة الاختبار",
  nameEn: "Test zone",
  ...overrides,
});

const problems = (draft: ZoneDraft) => {
  const result = validateZone(draft);
  return result.ok ? [] : result.problems;
};

describe("validateZone", () => {
  it("accepts a complete draft and normalises it", () => {
    const result = validateZone(
      base({ code: " ruh-p-09 ", nameAr: "  منطقة  ", authorityRef: " GACA/1 " }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.code).toBe("RUH-P-09");
    expect(result.value.nameAr).toBe("منطقة");
    expect(result.value.authorityRef).toBe("GACA/1");
  });

  /**
   * **The rule the spec states outright.** A zone named only in English is
   * broken for the app's primary audience — the map, the confirmation and the
   * cancellation email would all show a name half the users cannot read.
   */
  it("refuses a zone named in only one language", () => {
    expect(problems(base({ nameAr: "" }))).toContain("name_ar_required");
    expect(problems(base({ nameEn: "" }))).toContain("name_en_required");
    expect(problems(base({ nameAr: "  " }))).toContain("name_ar_required");
  });

  it("refuses a code that is not radio-readable", () => {
    expect(problems(base({ code: "" }))).toContain("code_required");
    expect(problems(base({ code: "منطقة" }))).toContain("code_invalid");
    expect(problems(base({ code: "ruh p 09" }))).toContain("code_invalid");
    expect(problems(base({ code: "R" }))).toContain("code_invalid");
  });

  it("accepts the seeded codes' shape", () => {
    for (const code of ["RUH-P-01", "RUH-NF-KKIA", "RUH-R-CITY"]) {
      expect(problems(base({ code }))).toEqual([]);
    }
  });

  describe("altitudes", () => {
    it("allows a null ceiling — a zone with no ceiling of its own", () => {
      expect(problems(base({ ceilingAglM: null }))).toEqual([]);
    });

    /**
     * Nought is not "no ceiling": it is a zone nobody may fly in, and `no_fly`
     * is the honest way to say that.
     */
    it("refuses a ceiling of nought", () => {
      expect(problems(base({ ceilingAglM: 0 }))).toContain("ceiling_invalid");
    });

    it("refuses a ceiling above what a drone rule can mean", () => {
      expect(problems(base({ ceilingAglM: 5000 }))).toContain("ceiling_invalid");
      expect(problems(base({ ceilingAglM: 120.5 }))).toContain("ceiling_invalid");
    });

    it("refuses a floor at or above the ceiling", () => {
      expect(problems(base({ floorAglM: 120, ceilingAglM: 120 }))).toContain(
        "floor_above_ceiling",
      );
      expect(problems(base({ floorAglM: 150, ceilingAglM: 120 }))).toContain(
        "floor_above_ceiling",
      );
      expect(problems(base({ floorAglM: 60, ceilingAglM: 120 }))).toEqual([]);
    });
  });

  describe("booking rules", () => {
    it("refuses a capacity outside 1..50", () => {
      expect(problems(base({ capacity: 0 }))).toContain("capacity_invalid");
      expect(problems(base({ capacity: 51 }))).toContain("capacity_invalid");
      expect(problems(base({ capacity: 2.5 }))).toContain("capacity_invalid");
    });

    it("refuses a slot grid finer than a quarter of an hour", () => {
      expect(problems(base({ slotDurationMinutes: 5 }))).toContain(
        "slot_duration_invalid",
      );
      expect(problems(base({ slotDurationMinutes: 15 }))).toEqual([]);
    });

    it("allows a zero lead time — a zone bookable on the spot", () => {
      expect(problems(base({ minLeadMinutes: 0 }))).toEqual([]);
    });

    it("refuses an advance window of nought days or over a year", () => {
      expect(problems(base({ maxAdvanceDays: 0 }))).toContain("advance_invalid");
      expect(problems(base({ maxAdvanceDays: 366 }))).toContain(
        "advance_invalid",
      );
    });
  });

  describe("who may fly", () => {
    /**
     * The product's whole premise passing through a form: unticking
     * `self_built` and `fpv` is how a zone quietly becomes commercial-only, so
     * the field is explicit rather than defaulted.
     */
    it("accepts the self-built and FPV classes", () => {
      expect(
        problems(base({ permittedBuildTypes: ["self_built", "fpv"] })),
      ).toEqual([]);
    });

    it("refuses an empty list rather than reading it as 'everyone'", () => {
      expect(problems(base({ permittedBuildTypes: [] }))).toContain(
        "build_types_empty",
      );
    });

    it("refuses a build type that does not exist", () => {
      expect(
        problems(base({ permittedBuildTypes: ["commercial", "glider"] })),
      ).toContain("build_types_invalid");
    });

    it("allows a null weight ceiling but not an invented class", () => {
      expect(problems(base({ maxWeightClass: null }))).toEqual([]);
      expect(problems(base({ maxWeightClass: "heavy" }))).toEqual([]);
      expect(problems(base({ maxWeightClass: "enormous" }))).toContain(
        "weight_class_invalid",
      );
    });
  });

  it("refuses a kind that is not one of the three", () => {
    expect(problems(base({ kind: "airport" }))).toContain("kind_invalid");
  });

  it("refuses a zone with no city", () => {
    expect(problems(base({ cityId: "" }))).toContain("city_required");
  });
});
