import { describe, expect, it } from "vitest";
import {
  FLIGHT_PURPOSES,
  MAX_COPILOTS,
  isFlightPurpose,
  normaliseMobile,
  validateCopilots,
} from "./booking";

describe("flight purposes", () => {
  it("are codes, not sentences", () => {
    for (const purpose of FLIGHT_PURPOSES) {
      expect(purpose).toMatch(/^[a-z_]+$/);
    }
  });

  it("rejects anything not in the list", () => {
    expect(isFlightPurpose("recreational")).toBe(true);
    // `booking.purpose` is a plain text column, so this is the only gate.
    expect(isFlightPurpose("smuggling")).toBe(false);
    expect(isFlightPurpose("")).toBe(false);
    expect(isFlightPurpose(null)).toBe(false);
  });
});

describe("normaliseMobile", () => {
  it.each([
    ["0512345678", "+966512345678"],
    ["+966512345678", "+966512345678"],
    ["00966512345678", "+966512345678"],
    ["966512345678", "+966512345678"],
    ["+966 51 234 5678", "+966512345678"],
    ["+966-51-234-5678", "+966512345678"],
  ])("normalises %s", (raw, expected) => {
    expect(normaliseMobile(raw)).toBe(expected);
  });

  it.each([
    ["0412345678"], // not a mobile prefix
    ["051234567"], // one digit short
    ["05123456789"], // one digit long
    ["+15551234567"], // not Saudi
    ["not a number"],
    [""],
  ])("refuses %s", (raw) => {
    expect(normaliseMobile(raw)).toBe(null);
  });
});

describe("validateCopilots", () => {
  it("drops wholly empty rows rather than refusing them", () => {
    /**
     * The form renders three slots and most flights have no crew. Treating the
     * blank rows as errors would make the commonest case the failing one.
     */
    const result = validateCopilots([
      { fullNameAr: "", fullNameEn: "", mobileE164: "" },
      { fullNameAr: "  ", fullNameEn: "", mobileE164: null },
    ]);
    expect(result).toEqual({ ok: true, copilots: [] });
  });

  it("requires both names, because both columns are NOT NULL", () => {
    const result = validateCopilots([{ fullNameEn: "Sara Al-Otaibi" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain("copilot_name_required");
  });

  it("accepts a complete co-pilot and normalises the mobile", () => {
    const result = validateCopilots([
      { fullNameAr: "سارة العتيبي", fullNameEn: "Sara Al-Otaibi", mobileE164: "0512345678" },
    ]);
    expect(result).toEqual({
      ok: true,
      copilots: [
        {
          fullNameAr: "سارة العتيبي",
          fullNameEn: "Sara Al-Otaibi",
          mobileE164: "+966512345678",
        },
      ],
    });
  });

  it("leaves the mobile null when it was never given", () => {
    const result = validateCopilots([
      { fullNameAr: "سارة", fullNameEn: "Sara" },
    ]);
    expect(result.ok && result.copilots[0].mobileE164).toBe(null);
  });

  it("refuses a malformed mobile rather than storing an uncallable number", () => {
    const result = validateCopilots([
      { fullNameAr: "سارة", fullNameEn: "Sara", mobileE164: "0412345678" },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain("copilot_mobile_format");
  });

  it("refuses a fourth co-pilot", () => {
    const one = { fullNameAr: "سارة", fullNameEn: "Sara" };
    expect(validateCopilots(Array(MAX_COPILOTS).fill(one)).ok).toBe(true);

    const tooMany = validateCopilots(Array(MAX_COPILOTS + 1).fill(one));
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) expect(tooMany.problems).toContain("too_many_copilots");
  });

  it("reports each distinct problem once, not once per row", () => {
    const result = validateCopilots([
      { fullNameEn: "A" },
      { fullNameEn: "B" },
      { fullNameEn: "C" },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toEqual(["copilot_name_required"]);
  });
});
