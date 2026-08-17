import { describe, expect, it } from "vitest";
import {
  isSaudiMobile,
  normalizeSaudiMobile,
  validateSaudiMobile,
} from "./mobile";

describe("normalizeSaudiMobile", () => {
  it("accepts the three spellings a Saudi pilot actually types", () => {
    for (const typed of ["0501234567", "00966501234567", "+966501234567"]) {
      expect(normalizeSaudiMobile(typed)).toBe("+966501234567");
    }
  });

  it("survives the separators and the Arabic keyboard", () => {
    expect(normalizeSaudiMobile("050 123 4567")).toBe("+966501234567");
    expect(normalizeSaudiMobile("(050) 123-4567")).toBe("+966501234567");
    expect(normalizeSaudiMobile("٠٥٠١٢٣٤٥٦٧")).toBe("+966501234567");
  });

  it("does not rewrite a foreign number into a Saudi one", () => {
    // The honest outcome is that it comes back unchanged and then fails the
    // format check. Prefixing it with +966 would invent a number nobody has.
    expect(normalizeSaudiMobile("+14155551234")).toBe("+14155551234");
    expect(isSaudiMobile("+14155551234")).toBe(false);
  });

  it("returns null for nothing", () => {
    expect(normalizeSaudiMobile("")).toBeNull();
    expect(normalizeSaudiMobile("   ")).toBeNull();
  });
});

describe("validateSaudiMobile", () => {
  it("accepts +966501234567", () => {
    expect(validateSaudiMobile("+966501234567")).toEqual({
      ok: true,
      e164: "+966501234567",
    });
  });

  it("accepts the national form and stores it in E.164", () => {
    // F17's criterion names `0501234567` as rejected. It is **normalised** here
    // instead, and the stored value is still `+9665…` — the column's format is
    // what the criterion protects, and refusing the way almost every Saudi pilot
    // writes their own number would fail them for being right.
    expect(validateSaudiMobile("0501234567")).toEqual({
      ok: true,
      e164: "+966501234567",
    });
  });

  it("rejects a non-Saudi number", () => {
    expect(validateSaudiMobile("+14155551234")).toEqual({
      ok: false,
      problem: "mobile_format",
    });
  });

  it("rejects a landline and a wrong length", () => {
    // `+9661…` is a Riyadh landline: reachable, but not a mobile, and this app
    // asks for a mobile because it is reaching an operator who is outdoors.
    expect(validateSaudiMobile("+966112345678").ok).toBe(false);
    expect(validateSaudiMobile("+96650123456").ok).toBe(false);
    expect(validateSaudiMobile("+9665012345678").ok).toBe(false);
  });

  it("has no notion of a verified number anywhere in its output", () => {
    // A guard against the shape of this module drifting: there is no SMS
    // provider in this app and no `mobileVerifiedAt` column, and a `verified`
    // field appearing here would be the first step towards implying one.
    const verdict = validateSaudiMobile("+966501234567");
    expect(Object.keys(verdict).sort()).toEqual(["e164", "ok"]);
  });
});
