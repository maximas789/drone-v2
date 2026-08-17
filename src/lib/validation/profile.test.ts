import { describe, expect, it } from "vitest";
import {
  birthDateCutoff,
  isProfileComplete,
  validateArabicName,
  validateContact,
  validateDateOfBirth,
  validateIdentity,
  validateLatinName,
} from "./profile";
import { saudiIdCheckDigit } from "./saudi-id";

const CITIZEN = `100000000${saudiIdCheckDigit("100000000")}`;

/** A fixed "now" so nothing here depends on the day the suite runs. */
const NOW = new Date("2026-08-17T09:00:00Z");

describe("names", () => {
  it("requires Arabic script in the Arabic field", () => {
    expect(validateArabicName("محمد بن عبدالله")).toBeNull();
    // The common mistake on a Latin keyboard, and the one worth catching: the
    // form is Arabic-first, so this field is the one people reach first.
    expect(validateArabicName("Mohammed Abdullah")).toBe("name_ar_script");
  });

  it("requires Latin script in the English field", () => {
    expect(validateLatinName("Mohammed Abdullah")).toBeNull();
    expect(validateLatinName("Abd al-Rahman")).toBeNull();
    expect(validateLatinName("O’Neill")).toBeNull();
    expect(validateLatinName("محمد بن عبدالله")).toBe("name_en_script");
  });

  it("rejects one character and 101 characters", () => {
    expect(validateArabicName("م")).toBe("name_ar_required");
    expect(validateLatinName("M")).toBe("name_en_required");
    expect(validateLatinName("a".repeat(101))).toBe("name_en_required");
    expect(validateLatinName("a".repeat(100))).toBeNull();
  });

  it("trims before measuring", () => {
    expect(validateLatinName("  Ali  ")).toBeNull();
    expect(validateLatinName("   ")).toBe("name_en_required");
  });
});

describe("date of birth", () => {
  it("computes the cutoff in Riyadh's civil day", () => {
    // 2026-08-17 in Riyadh, minus eighteen years.
    expect(birthDateCutoff(NOW, 18)).toBe("2008-08-17");
    // 22:00 UTC is already the next day in Riyadh (+3), and a birthday has to
    // turn where the pilot is standing.
    expect(birthDateCutoff(new Date("2026-08-17T22:00:00Z"), 18)).toBe(
      "2008-08-18",
    );
  });

  it("accepts somebody who turned 18 today and refuses tomorrow's birthday", () => {
    expect(validateDateOfBirth("2008-08-17", NOW)).toBeNull();
    expect(validateDateOfBirth("2008-08-18", NOW)).toBe("dob_underage");
  });

  it("refuses a date that does not exist", () => {
    // `new Date("2007-02-31")` rolls over to 3 March rather than failing, so a
    // naive parse would store a day nobody typed.
    expect(validateDateOfBirth("2007-02-31", NOW)).toBe("dob_invalid");
    expect(validateDateOfBirth("2007-13-01", NOW)).toBe("dob_invalid");
  });

  it("refuses the future, the absurd past, and an empty field", () => {
    expect(validateDateOfBirth("2030-01-01", NOW)).toBe("dob_invalid");
    expect(validateDateOfBirth("1890-01-01", NOW)).toBe("dob_invalid");
    expect(validateDateOfBirth("", NOW)).toBe("dob_required");
    expect(validateDateOfBirth("17/08/2008", NOW)).toBe("dob_invalid");
  });
});

describe("validateIdentity", () => {
  const good = {
    fullNameAr: "محمد بن عبدالله",
    fullNameEn: "Mohammed Abdullah",
    idDocumentType: "saudi_national_id" as const,
    idDocumentNumber: CITIZEN,
    dateOfBirth: "1995-04-12",
  };

  it("accepts a complete identity and returns the normalised number", () => {
    const result = validateIdentity({ ...good, idDocumentNumber: ` ${CITIZEN} ` }, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.idDocumentNumber).toBe(CITIZEN);
  });

  it("reports every problem at once, not just the first", () => {
    // A form that reveals one error per submit makes somebody guess four times.
    const result = validateIdentity(
      {
        fullNameAr: "Mohammed",
        fullNameEn: "محمد",
        idDocumentType: "iqama",
        idDocumentNumber: CITIZEN,
        dateOfBirth: "2020-01-01",
      },
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(new Set(result.problems)).toEqual(
        new Set([
          "name_ar_script",
          "name_en_script",
          "id_type_mismatch",
          "dob_underage",
        ]),
      );
    }
  });
});

describe("validateContact", () => {
  it("normalises the mobile and keeps the optional fields optional", () => {
    const result = validateContact({
      mobileE164: "0501234567",
      addressCityId: "11111111-1111-1111-1111-111111111111",
      addressLine: "",
      emergencyContact: "",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mobileE164).toBe("+966501234567");
      expect(result.value.addressLine).toBeNull();
      expect(result.value.emergencyContact).toBeNull();
    }
  });

  it("validates an emergency contact only when one is given", () => {
    const base = {
      mobileE164: "+966501234567",
      addressCityId: "11111111-1111-1111-1111-111111111111",
      addressLine: null,
    };
    expect(validateContact({ ...base, emergencyContact: null }).ok).toBe(true);
    expect(validateContact({ ...base, emergencyContact: "0509876543" }).ok).toBe(
      true,
    );
    // Given but unreachable is worse than absent: it looks like a number that
    // works.
    const bad = validateContact({ ...base, emergencyContact: "+14155551234" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.problems).toContain("emergency_contact_format");
  });

  it("requires a city", () => {
    const result = validateContact({
      mobileE164: "+966501234567",
      addressCityId: "  ",
      addressLine: null,
      emergencyContact: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain("city_required");
  });
});

describe("isProfileComplete", () => {
  const complete = {
    fullNameAr: "محمد",
    fullNameEn: "Mohammed",
    idDocumentType: "saudi_national_id",
    idDocumentNumber: CITIZEN,
    dateOfBirth: "1995-04-12",
    mobileE164: "+966501234567",
    addressCityId: "11111111-1111-1111-1111-111111111111",
  };

  it("is true only when every required field is present", () => {
    expect(isProfileComplete(complete)).toBe(true);
  });

  it("is false if any one required field is missing", () => {
    // Every field, one at a time. A single `for` rather than seven cases so a
    // field added to the row cannot be quietly left out of the check.
    for (const key of Object.keys(complete) as Array<keyof typeof complete>) {
      expect(isProfileComplete({ ...complete, [key]: null })).toBe(false);
    }
  });

  it("treats whitespace as absent", () => {
    expect(isProfileComplete({ ...complete, fullNameAr: "   " })).toBe(false);
  });

  it("says nothing about verification", () => {
    // `completedAt` and `verifiedAt` are different facts: a complete profile may
    // use the app and see where it stands, and only booking needs a human to
    // have checked the document. Collapsing the two would lock a pilot out of
    // the app while they wait for a reviewer.
    expect(isProfileComplete(complete)).toBe(true);
  });
});
