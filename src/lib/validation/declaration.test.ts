import { describe, expect, it } from "vitest";
import {
  DECLARATION_FIELD_MAX_LENGTH,
  DECLARATION_KINDS,
  isDeclarationKind,
  validateDeclaration,
} from "./declaration";

describe("isDeclarationKind", () => {
  it("accepts every kind the column holds", () => {
    for (const kind of DECLARATION_KINDS) expect(isDeclarationKind(kind)).toBe(true);
  });

  it("rejects anything else, including the shapes a POST can send", () => {
    for (const value of ["", "faa", "FAA_BROADCAST_MODULE", null, undefined, 7, {}]) {
      expect(isDeclarationKind(value), String(value)).toBe(false);
    }
  });
});

describe("validateDeclaration", () => {
  it("accepts a declaration that names the module by any one field", () => {
    for (const field of ["manufacturer", "moduleSerial", "docReference"] as const) {
      const verdict = validateDeclaration({ kind: "gaca_dri", [field]: "BroadcastCo" });
      expect(verdict.ok, field).toBe(true);
    }
  });

  /**
   * The rule the form exists to enforce: a row carrying only a kind asserts
   * that a module exists without identifying it, which no reviewer can check
   * against hardware and no inspector can match.
   */
  it("refuses a declaration that identifies nothing", () => {
    const verdict = validateDeclaration({ kind: "gaca_dri" });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.codes).toContain("declaration_empty");
  });

  it("treats whitespace as nothing", () => {
    const verdict = validateDeclaration({
      kind: "gaca_dri",
      manufacturer: "   ",
      moduleSerial: "\t",
      docReference: "\n ",
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.codes).toContain("declaration_empty");
  });

  it("trims what it keeps, and stores absence as null", () => {
    const verdict = validateDeclaration({
      kind: "other",
      manufacturer: "  BroadcastCo  ",
      moduleSerial: "  ",
    });
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.fields.manufacturer).toBe("BroadcastCo");
      // Not `""` — a column holding spaces reads as a value nobody can see.
      expect(verdict.fields.moduleSerial).toBeNull();
      expect(verdict.fields.docReference).toBeNull();
    }
  });

  it("refuses an unknown kind", () => {
    const verdict = validateDeclaration({ kind: "not_a_kind", moduleSerial: "X" });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.codes).toContain("declaration_kind_required");
  });

  it("accepts a field at the ceiling and refuses one past it", () => {
    const atLimit = "x".repeat(DECLARATION_FIELD_MAX_LENGTH);
    expect(validateDeclaration({ kind: "other", moduleSerial: atLimit }).ok).toBe(true);

    const overLimit = "x".repeat(DECLARATION_FIELD_MAX_LENGTH + 1);
    const verdict = validateDeclaration({ kind: "other", moduleSerial: overLimit });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.codes).toContain("declaration_too_long");
  });

  it("checks the ceiling on every field, not just the first", () => {
    const overLimit = "x".repeat(DECLARATION_FIELD_MAX_LENGTH + 1);
    for (const field of ["manufacturer", "moduleSerial", "docReference"] as const) {
      const verdict = validateDeclaration({ kind: "other", [field]: overLimit });
      expect(verdict.ok, field).toBe(false);
    }
  });

  it("reports every problem at once, not the first one it meets", () => {
    // A form that fixes one refusal only to meet the next is a form nobody
    // finishes. Both codes come back together.
    const verdict = validateDeclaration({ kind: "not_a_kind" });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.codes).toContain("declaration_kind_required");
      expect(verdict.codes).toContain("declaration_empty");
    }
  });
});
