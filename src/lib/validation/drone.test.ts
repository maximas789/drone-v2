import { describe, expect, it } from "vitest";
import {
  mayBeExempt,
  serialRequiredFor,
  validateDroneSpecs,
  validateDroneType,
  weightClassFor,
} from "./drone";

describe("weightClassFor", () => {
  it("puts every boundary on the right side", () => {
    // F18 names these four explicitly, and they are the ones a wrong comparison
    // operator moves. 250 g is the one that matters most: it is the line the
    // regulator's exemption sits on.
    expect(weightClassFor(249)).toBe("micro");
    expect(weightClassFor(250)).toBe("light");
    expect(weightClassFor(3_999)).toBe("light");
    expect(weightClassFor(4_000)).toBe("medium");
    expect(weightClassFor(24_999)).toBe("medium");
    expect(weightClassFor(25_000)).toBe("heavy");
  });

  it("handles the extremes", () => {
    expect(weightClassFor(1)).toBe("micro");
    expect(weightClassFor(300_000)).toBe("heavy");
  });

  it("agrees with mayBeExempt", () => {
    // Two functions, one rule. If they ever disagree the UI says "may be exempt"
    // beside a class that is not exempt.
    for (const grams of [1, 249, 250, 500, 4_000, 30_000]) {
      expect(mayBeExempt(grams)).toBe(weightClassFor(grams) === "micro");
    }
  });
});

describe("serialRequiredFor", () => {
  it("is the inversion of GACA's rule, and only commercial needs one", () => {
    // This is the product. A test that ever has to be changed to make
    // self_built or fpv require a serial is a test that has been broken on
    // purpose.
    expect(serialRequiredFor("commercial")).toBe(true);
    expect(serialRequiredFor("self_built")).toBe(false);
    expect(serialRequiredFor("fpv")).toBe(false);
  });
});

describe("validateDroneType", () => {
  const base = {
    nickname: "أبو رعد",
    buildType: "self_built" as const,
    manufacturer: "",
    model: "",
    propulsion: "",
  };

  it("accepts a self-built airframe with nothing but a nickname", () => {
    const result = validateDroneType(base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.manufacturer).toBeNull();
      expect(result.value.model).toBeNull();
    }
  });

  it("requires a manufacturer only for a commercial airframe", () => {
    const commercial = validateDroneType({ ...base, buildType: "commercial" });
    expect(commercial.ok).toBe(false);
    if (!commercial.ok) {
      expect(commercial.problems).toContain("manufacturer_required");
    }

    // A self-builder writing their own name is the true answer, not a
    // workaround — so it is accepted and stored.
    const named = validateDroneType({ ...base, manufacturer: "محمد العتيبي" });
    expect(named.ok).toBe(true);
    if (named.ok) expect(named.value.manufacturer).toBe("محمد العتيبي");
  });

  it("refuses a missing build type rather than guessing one", () => {
    const result = validateDroneType({ ...base, buildType: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain("build_type_required");
  });

  it("refuses a one-character nickname and trims before measuring", () => {
    expect(validateDroneType({ ...base, nickname: "أ" }).ok).toBe(false);
    expect(validateDroneType({ ...base, nickname: "   " }).ok).toBe(false);
    expect(validateDroneType({ ...base, nickname: "  Rad  " }).ok).toBe(true);
  });
});

describe("validateDroneSpecs", () => {
  const selfBuilt = {
    buildType: "self_built" as const,
    weightGrams: "1200",
    hasCamera: true,
    serialNumber: "",
  };

  it("registers a self-built airframe with no serial number, cleanly", () => {
    // **The core case.** If this ever fails, the product does not work.
    const result = validateDroneSpecs(selfBuilt);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.serialNumber).toBeNull();
      expect(result.value.weightClass).toBe("light");
    }
  });

  it("refuses a commercial airframe with no serial, and accepts one with", () => {
    const without = validateDroneSpecs({
      ...selfBuilt,
      buildType: "commercial",
    });
    expect(without.ok).toBe(false);
    if (!without.ok) expect(without.problems).toContain("serial_required");

    const with_ = validateDroneSpecs({
      ...selfBuilt,
      buildType: "commercial",
      serialNumber: "1581F5FMD23AB00X1234",
    });
    expect(with_.ok).toBe(true);
    if (with_.ok) expect(with_.value.serialNumber).toBe("1581F5FMD23AB00X1234");
  });

  it("refuses a serial sent for an airframe that has no serial field", () => {
    // The field is not rendered for self-built or FPV, so a value here arrived
    // by a direct POST. Storing it would put a manufacturer's serial on an
    // airframe that has none; dropping it silently would tell nobody.
    const result = validateDroneSpecs({ ...selfBuilt, serialNumber: "ABC123" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain("serial_not_applicable");
  });

  it("derives the class rather than trusting anything sent in", () => {
    for (const [grams, expected] of [
      ["249", "micro"],
      ["250", "light"],
      ["3999", "light"],
      ["4000", "medium"],
      ["25000", "heavy"],
    ] as const) {
      const result = validateDroneSpecs({ ...selfBuilt, weightGrams: grams });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.weightClass).toBe(expected);
    }
  });

  it("refuses weights that are not a whole number of grams", () => {
    for (const weightGrams of ["", "0", "-5", "1.5", "1e5", "abc", "٥٠٠"]) {
      expect(validateDroneSpecs({ ...selfBuilt, weightGrams }).ok).toBe(false);
    }
  });

  it("refuses an absurd weight", () => {
    // A typo guard, not a regulation. Without it a slipped keystroke stores a
    // 2,500,000 g airframe in the regulator's record.
    expect(validateDroneSpecs({ ...selfBuilt, weightGrams: "300000" }).ok).toBe(
      true,
    );
    expect(validateDroneSpecs({ ...selfBuilt, weightGrams: "300001" }).ok).toBe(
      false,
    );
  });

  it("reports every problem at once", () => {
    const result = validateDroneSpecs({
      buildType: "commercial",
      weightGrams: "",
      hasCamera: false,
      serialNumber: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(new Set(result.problems)).toEqual(
        new Set(["weight_required", "serial_required"]),
      );
    }
  });
});
