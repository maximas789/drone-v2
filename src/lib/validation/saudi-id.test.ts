import { describe, expect, it } from "vitest";
import {
  detectSaudiIdType,
  normalizeIdNumber,
  saudiIdCheckDigit,
  saudiIdChecksumValid,
  validateIdDocument,
} from "./saudi-id";

/**
 * **No memorised "real" ID numbers appear in this file, deliberately.**
 *
 * The obvious way to test a national-ID checksum is to paste in a number
 * somebody found on the internet and assert it is valid. That has two problems:
 * a wrong recollection produces a test that pins the *bug*, and a right one
 * puts a real person's identity number in a git repository for ever.
 *
 * So the vectors here are built by `saudiIdCheckDigit`, and the *properties* are
 * what get asserted — that the check digit is unique, that a single wrong digit
 * is caught, that an adjacent transposition is caught. A checksum exists to do
 * exactly those three things, and a test of them cannot pass against a broken
 * implementation the way a single hard-coded vector can.
 *
 * One arithmetic case is worked out longhand below so the algorithm itself is
 * pinned by something other than its own implementation.
 */

/** `1` + eight zeros. Doubling the leading 1 gives 2, everything else is 0. */
const CITIZEN_STEM = "100000000";
/** `2` + eight zeros. Doubling the leading 2 gives 4. */
const RESIDENT_STEM = "200000000";

describe("saudiIdChecksumValid", () => {
  it("matches arithmetic worked out by hand", () => {
    // 1 0 0 0 0 0 0 0 0 ?
    // Odd positions (indices 0,2,4,6,8) are doubled: 1→2, and four zeros → 0.
    // Even positions (1,3,5,7) are added as-is: four zeros → 0.
    // Running total is 2, so the check digit must be 8 for a multiple of ten.
    expect(saudiIdChecksumValid("1000000008")).toBe(true);
    expect(saudiIdChecksumValid("1000000000")).toBe(false);

    // 2 0 0 0 0 0 0 0 0 ?  →  2 doubles to 4, so the check digit is 6.
    expect(saudiIdChecksumValid("2000000006")).toBe(true);
  });

  it("accepts exactly one check digit per stem", () => {
    for (const stem of [CITIZEN_STEM, RESIDENT_STEM, "123456789", "298765432"]) {
      const accepted = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((candidate) =>
        saudiIdChecksumValid(`${stem}${candidate}`),
      );
      expect(accepted).toHaveLength(1);
      expect(accepted[0]).toBe(saudiIdCheckDigit(stem));
    }
  });

  it("catches any single mistyped digit", () => {
    const valid = `${CITIZEN_STEM}${saudiIdCheckDigit(CITIZEN_STEM)}`;

    for (let position = 0; position < 10; position += 1) {
      for (let digit = 0; digit <= 9; digit += 1) {
        if (String(digit) === valid[position]) continue;
        const mistyped =
          valid.slice(0, position) + String(digit) + valid.slice(position + 1);
        expect(saudiIdChecksumValid(mistyped)).toBe(false);
      }
    }
  });

  it("catches an adjacent transposition", () => {
    // The failure mode a plain digit-sum would miss entirely: `1435` and `1345`
    // sum the same. A Luhn variant catches it because the two digits swap which
    // side of the doubling they fall on.
    const stem = "123456789";
    const valid = `${stem}${saudiIdCheckDigit(stem)}`;

    let checked = 0;
    for (let i = 0; i < 9; i += 1) {
      if (valid[i] === valid[i + 1]) continue;
      const swapped =
        valid.slice(0, i) + valid[i + 1] + valid[i] + valid.slice(i + 2);
      // A Luhn-style check misses a 0↔9 swap; every other adjacent pair is
      // caught. Asserting the general claim would be asserting something false.
      const pair = new Set([valid[i], valid[i + 1]]);
      if (pair.has("0") && pair.has("9")) continue;
      expect(saudiIdChecksumValid(swapped)).toBe(false);
      checked += 1;
    }
    // Guard against the loop silently skipping everything and passing.
    expect(checked).toBeGreaterThan(0);
  });

  it("rejects anything that is not ten digits", () => {
    for (const value of ["", "1", "100000000", "10000000080", "10000000O8"]) {
      expect(saudiIdChecksumValid(value)).toBe(false);
    }
  });
});

describe("normalizeIdNumber", () => {
  it("folds Arabic-Indic and Persian digits to ASCII", () => {
    // A pilot typing on an Arabic keyboard. Refusing this would be absurd in an
    // Arabic-first app — and it must produce the same hash as the Latin form,
    // because `id_document_hash` is UNIQUE over this output.
    expect(normalizeIdNumber("١٠٠٠٠٠٠٠٠٨")).toBe("1000000008");
    expect(normalizeIdNumber("۱۰۰۰۰۰۰۰۰۸")).toBe("1000000008");
  });

  it("drops the separators and invisibles people leave in a field", () => {
    expect(normalizeIdNumber(" 1000 0000-08 ")).toBe("1000000008");
    // U+200E / U+200F, which a browser can leave around Latin digits typed into
    // an RTL input. Invisible, so an unstripped one would be undebuggable.
    expect(normalizeIdNumber("‎1000000008‏")).toBe("1000000008");
  });

  it("keeps a letter rather than deleting it", () => {
    // Deleting it could turn one person's typo into another person's valid
    // number. It is kept, and then refused as a format problem.
    expect(normalizeIdNumber("10000000O8")).toBe("10000000O8");
  });

  it("normalises to the same string whatever the spelling", () => {
    const spellings = [
      "1000000008",
      " 1000000008 ",
      "1000-000-008",
      "١٠٠٠٠٠٠٠٠٨",
    ];
    const normalized = new Set(spellings.map(normalizeIdNumber));
    expect(normalized).toEqual(new Set(["1000000008"]));
  });
});

describe("detectSaudiIdType", () => {
  it("reads the type off the first digit and refuses to guess otherwise", () => {
    expect(detectSaudiIdType("1000000008")).toBe("saudi_national_id");
    expect(detectSaudiIdType("2000000006")).toBe("iqama");
    // A `3` prefix is not an Iqama with a typo; it is a number Saudi Arabia does
    // not issue, and inventing a type for it would put a false claim on a row.
    expect(detectSaudiIdType("3000000000")).toBeNull();
    expect(detectSaudiIdType("100000000")).toBeNull();
  });
});

describe("validateIdDocument", () => {
  const citizen = `${CITIZEN_STEM}${saudiIdCheckDigit(CITIZEN_STEM)}`;
  const resident = `${RESIDENT_STEM}${saudiIdCheckDigit(RESIDENT_STEM)}`;

  it("accepts a valid national ID and a valid Iqama", () => {
    expect(validateIdDocument("saudi_national_id", citizen)).toEqual({
      ok: true,
      number: citizen,
    });
    expect(validateIdDocument("iqama", resident)).toEqual({
      ok: true,
      number: resident,
    });
  });

  it("rejects a wrong checksum as a checksum problem, not a format one", () => {
    // The distinction matters to the reader: "check the digits against your
    // document" is useful advice; "that is the wrong length" would be a lie.
    const wrong = `${CITIZEN_STEM}${(saudiIdCheckDigit(CITIZEN_STEM) + 1) % 10}`;
    expect(validateIdDocument("saudi_national_id", wrong)).toEqual({
      ok: false,
      problem: "id_checksum",
    });
  });

  it("rejects nine and eleven digits", () => {
    expect(validateIdDocument("iqama", resident.slice(0, 9)).ok).toBe(false);
    expect(validateIdDocument("iqama", `${resident}0`).ok).toBe(false);
    expect(validateIdDocument("iqama", resident.slice(0, 9))).toEqual({
      ok: false,
      problem: "id_format",
    });
  });

  it("refuses a number whose prefix disagrees with the declared type", () => {
    expect(validateIdDocument("iqama", citizen)).toEqual({
      ok: false,
      problem: "id_type_mismatch",
    });
    expect(validateIdDocument("saudi_national_id", resident)).toEqual({
      ok: false,
      problem: "id_type_mismatch",
    });
  });

  it("accepts an Arabic-Indic spelling of a valid number", () => {
    const arabicIndic = [...citizen]
      .map((digit) => String.fromCharCode(0x0660 + Number(digit)))
      .join("");
    expect(validateIdDocument("saudi_national_id", arabicIndic)).toEqual({
      ok: true,
      number: citizen,
    });
  });

  it("checks a GCC id for shape only, and applies no Saudi checksum to it", () => {
    // The app does not know another state's check digit, and inventing one would
    // refuse real documents on a guess.
    expect(validateIdDocument("gcc_id", "12345678").ok).toBe(true);
    expect(validateIdDocument("gcc_id", "784199512345678").ok).toBe(true);
    expect(validateIdDocument("gcc_id", "1234567").ok).toBe(false);
    expect(validateIdDocument("gcc_id", "12345abc").ok).toBe(false);
  });
});
