import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CODE_PREFIX,
  CODE_SYMBOLS,
  CROCKFORD_ALPHABET,
  formatCode,
  generateCode,
  isValidCode,
  normalizeCode,
} from "./codec";

/**
 * The batch the alphabet and collision criteria are asserted against. A
 * hundred thousand is not a round number chosen for looks: at that count the
 * per-insert collision probability is ~9 × 10⁻⁸, so a duplicate here would mean
 * the generator is broken rather than unlucky.
 */
const BATCH = 100_000;

function batch(): string[] {
  return Array.from({ length: BATCH }, () => generateCode());
}

describe("generateCode", () => {
  const codes = batch();

  it("returns the canonical AJN-XXXX-XXXX form", () => {
    expect(codes[0]).toMatch(/^AJN-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(codes.every(isValidCode)).toBe(true);
  });

  it("never emits I, L, O or U across 100 000 codes", () => {
    // Whole-string, prefix included: "AJN" carries none of the four either.
    const offenders = codes.filter((code) => /[ILOU]/.test(code));
    expect(offenders).toEqual([]);
  });

  it("uses only the Crockford alphabet", () => {
    const allowed = new Set([...CROCKFORD_ALPHABET, ...CODE_PREFIX, "-"]);
    const strange = codes.find((code) =>
      [...code].some((character) => !allowed.has(character)),
    );
    expect(strange).toBeUndefined();
  });

  it("produces no duplicates across 100 000 codes", () => {
    expect(new Set(codes).size).toBe(BATCH);
  });

  it("uses every symbol in the alphabet", () => {
    // A generator that dropped the high symbols — an off-by-one in the bit
    // shift, say — would still pass every test above.
    const seen = new Set(
      codes.flatMap((code) => [...code.replace(/^AJN-/, "").replace("-", "")]),
    );
    expect(seen.size).toBe(CROCKFORD_ALPHABET.length);
  });

  it("takes no arguments, so a code cannot be derived from a row id", () => {
    // The structural half of "never derived from the UUID": there is no input
    // to derive from. Passing one changes nothing.
    expect(generateCode.length).toBe(0);

    const uuid = randomUUID();
    const derived = (generateCode as (seed: string) => string)(uuid);
    const compact = uuid.replace(/-/g, "").toUpperCase();
    expect(compact).not.toContain(derived.replace(/^AJN-/, "").replace("-", ""));
  });
});

describe("normalizeCode", () => {
  it("accepts spaced, unspaced, lowercase and dashed input alike", () => {
    const canonical = "AJN-4F2K-91XZ";
    for (const written of [
      "ajn 4f2k 91xz",
      "AJN4F2K91XZ",
      "ajn-4f2k-91xz",
      "  AJN-4F2K-91XZ  ",
      "4F2K91XZ",
      "ajn.4f2k.91xz",
    ]) {
      expect(normalizeCode(written)).toBe(canonical);
    }
  });

  it("maps the ambiguous letters a sticker gets misread as", () => {
    // O→0, I→1, L→1, U→V. Each of the four, in one code.
    expect(normalizeCode("AJN-O1LI-U234")).toBe("AJN-0111-V234");
  });

  it("rejects the wrong length", () => {
    expect(normalizeCode("AJN-4F2K-91X")).toBeNull();
    expect(normalizeCode("AJN-4F2K-91XZ9")).toBeNull();
    expect(normalizeCode("")).toBeNull();
    expect(normalizeCode("AJN")).toBeNull();
  });

  it("rejects characters outside the alphabet after mapping", () => {
    // Every letter left out of Crockford maps to something valid, so the only
    // way to fail the alphabet is a symbol that survives stripping — none do.
    // What must fail is a body of the right length that isn't base32 at all.
    expect(normalizeCode("AJN-4F2K-91X!")).toBeNull(); // '!' stripped → 7 left
    expect(normalizeCode("مرحبا بالعالم")).toBeNull();
  });

  it("rejects an 11-character body that is not prefixed AJN", () => {
    expect(normalizeCode("XYZ4F2K91XZ")).toBeNull();
  });

  it("round-trips every generated code", () => {
    for (let i = 0; i < 1_000; i += 1) {
      const code = generateCode();
      expect(normalizeCode(code)).toBe(code);
      expect(normalizeCode(code.toLowerCase().replace(/-/g, ""))).toBe(code);
    }
  });
});

describe("isValidCode", () => {
  it("accepts only the canonical form", () => {
    expect(isValidCode("AJN-4F2K-91XZ")).toBe(true);
    expect(isValidCode("ajn-4f2k-91xz")).toBe(false);
    expect(isValidCode("AJN4F2K91XZ")).toBe(false);
    expect(isValidCode("AJN-4F2K-91XI")).toBe(false);
    expect(isValidCode("AJN-4F2K-91XU")).toBe(false);
  });
});

describe("formatCode", () => {
  it("inserts the dashes at 4 and 8", () => {
    expect(formatCode("4F2K91XZ")).toBe("AJN-4F2K-91XZ");
    expect(formatCode("4F2K91XZ")).toHaveLength(
      CODE_PREFIX.length + 2 + CODE_SYMBOLS,
    );
  });
});
