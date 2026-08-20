import { describe, expect, it } from "vitest";
import { SAUDI_BOUNDS } from "@/lib/geo/bbox";
import { emptyCityDraft, validateCity, type CityDraft } from "./city";

/**
 * The city rules, and the one failure they exist for: **a swapped coordinate
 * pair.**
 *
 * Riyadh is 24.71 N, 46.68 E. Type them the other way round and the city
 * centres at 46.71 N, 24.68 E, which is in the Adriatic — and nothing else in
 * the app would notice, because a centroid has no boundary to contradict it.
 * The bounds check catches exactly that, and the test below is the reversed
 * Riyadh pair rather than an invented one.
 */

function draft(over: Partial<CityDraft> = {}): CityDraft {
  return {
    ...emptyCityDraft(),
    code: "JED",
    nameAr: "جدة",
    nameEn: "Jeddah",
    centroidLat: "21.4858",
    centroidLng: "39.1925",
    ...over,
  };
}

describe("validateCity", () => {
  it("accepts a city and normalises the code to uppercase", () => {
    const result = validateCity(draft({ code: " jed " }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.code).toBe("JED");
    expect(result.value.centroidLat).toBeCloseTo(21.4858, 4);
    expect(result.value.centroidLng).toBeCloseTo(39.1925, 4);
  });

  it("requires a code of exactly three Latin letters", () => {
    for (const code of ["JE", "JEDD", "J3D", "جدة"]) {
      const result = validateCity(draft({ code }));
      expect(result.ok, code).toBe(false);
      if (result.ok) continue;
      expect(result.problems, code).toContain("city_code_invalid");
    }
  });

  it("names an empty code as missing rather than invalid", () => {
    const result = validateCity(draft({ code: "  " }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContain("city_code_required");
    expect(result.problems).not.toContain("city_code_invalid");
  });

  it("requires both languages", () => {
    const result = validateCity(draft({ nameAr: "", nameEn: " " }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContain("city_name_ar_required");
    expect(result.problems).toContain("city_name_en_required");
  });

  it("refuses a reversed Riyadh centroid", () => {
    const result = validateCity(
      draft({ centroidLat: "46.6753", centroidLng: "24.7136" }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContain("city_centroid_outside_saudi_arabia");
  });

  it("accepts the corners of the bounds and refuses just outside them", () => {
    const inside = validateCity(
      draft({
        centroidLat: String(SAUDI_BOUNDS.minLat),
        centroidLng: String(SAUDI_BOUNDS.maxLng),
      }),
    );
    expect(inside.ok).toBe(true);

    const outside = validateCity(
      draft({
        centroidLat: String(SAUDI_BOUNDS.minLat - 0.0001),
        centroidLng: String(SAUDI_BOUNDS.maxLng),
      }),
    );
    expect(outside.ok).toBe(false);
    if (outside.ok) return;
    expect(outside.problems).toContain("city_centroid_outside_saudi_arabia");
  });

  it("treats a blank or unparseable coordinate as missing, not as zero", () => {
    // `Number("")` is 0, which is a finite number outside Saudi Arabia — so a
    // blank field would otherwise be reported as a point in the Atlantic
    // rather than as an empty field.
    for (const over of [
      { centroidLat: "" },
      { centroidLng: "  " },
      { centroidLat: "north" },
    ]) {
      const result = validateCity(draft(over));
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.problems).toContain("city_centroid_required");
      expect(result.problems).not.toContain("city_centroid_outside_saudi_arabia");
    }
  });

  it("refuses a name longer than the column holds", () => {
    const result = validateCity(draft({ nameEn: "x".repeat(121) }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContain("city_name_too_long");
  });
});
