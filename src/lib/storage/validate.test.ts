import { describe, expect, it } from "vitest";
import {
  acceptsUploads,
  declarationPrefix,
  dronePrefix,
  isPhotoKind,
  isUploadKind,
  KIND_RULES,
  sniffType,
  storageKeyFor,
  UPLOAD_KINDS,
  validateUpload,
} from "./validate";

const bytes = (...values: number[]) => new Uint8Array(values);

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00);
const WEBP = bytes(
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
);
const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n");
const SVG = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
);

describe("sniffType", () => {
  it("identifies the four types the app accepts", () => {
    expect(sniffType(JPEG)).toBe("image/jpeg");
    expect(sniffType(PNG)).toBe("image/png");
    expect(sniffType(WEBP)).toBe("image/webp");
    expect(sniffType(PDF)).toBe("application/pdf");
  });

  /**
   * The whole reason this module exists. An SVG is an XML document that runs
   * script in the browser; served back from our own origin it is stored XSS.
   */
  it("does not identify an SVG, however it is labelled", () => {
    expect(sniffType(SVG)).toBeNull();
  });

  it("does not identify empty or truncated input", () => {
    expect(sniffType(bytes())).toBeNull();
    expect(sniffType(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffType(bytes(0x89, 0x50, 0x4e))).toBeNull();
  });

  it("does not take RIFF alone for a WebP", () => {
    // A WAV file is RIFF too. Only the four bytes at offset 8 decide.
    const wav = bytes(
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    );
    expect(sniffType(wav)).toBeNull();
  });

  it("reads the bytes, not the leading whitespace of a text file", () => {
    expect(sniffType(new TextEncoder().encode("  %PDF-1.7"))).toBeNull();
  });
});

describe("validateUpload", () => {
  it("accepts a JPEG as a photo and reports its extension", () => {
    const verdict = validateUpload("overall", JPEG);
    expect(verdict).toEqual({ ok: true, type: "image/jpeg", extension: "jpg" });
  });

  it("rejects an SVG renamed .png — the acceptance criterion", () => {
    const verdict = validateUpload("overall", SVG);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.refusal.code).toBe("upload_type_rejected");
  });

  it("rejects a PDF as a photo", () => {
    const verdict = validateUpload("overall", PDF);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.refusal.code).toBe("upload_type_rejected");
  });

  it("rejects an image as a declaration — PDF only", () => {
    const verdict = validateUpload("declaration_doc", PNG);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.refusal.code).toBe("upload_type_rejected");
  });

  it("accepts a PDF as a declaration", () => {
    expect(validateUpload("declaration_doc", PDF)).toMatchObject({
      ok: true,
      extension: "pdf",
    });
  });

  it("rejects an empty file before it asks what type it is", () => {
    const verdict = validateUpload("overall", bytes());
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.refusal.code).toBe("upload_empty");
  });

  it("rejects 20 MB and says so as a size, not as a type", () => {
    const huge = new Uint8Array(20 * 1024 * 1024);
    huge.set(JPEG);
    const verdict = validateUpload("overall", huge);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      // A perfectly good JPEG. Telling its owner it is "not a supported type"
      // sends them off fixing the wrong thing.
      expect(verdict.refusal.code).toBe("upload_too_large");
      if (verdict.refusal.code === "upload_too_large") {
        expect(verdict.refusal.maxBytes).toBe(8 * 1024 * 1024);
      }
    }
  });

  /**
   * The doubly-wrong file is the only one the check order actually decides:
   * 20 MB of PDF sent as a photograph is both too big and the wrong type.
   * Size wins, because converting it to a JPEG would still leave it 20 MB.
   */
  it("answers a too-large wrong-type file on the size, not the type", () => {
    const huge = new Uint8Array(20 * 1024 * 1024);
    huge.set(PDF);
    const verdict = validateUpload("overall", huge);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.refusal.code).toBe("upload_too_large");
  });

  it("accepts a file exactly at the ceiling", () => {
    const exact = new Uint8Array(8 * 1024 * 1024);
    exact.set(JPEG);
    expect(validateUpload("overall", exact).ok).toBe(true);
  });

  it("gives declarations the larger ceiling", () => {
    expect(KIND_RULES.declaration_doc.maxBytes).toBeGreaterThan(
      KIND_RULES.overall.maxBytes,
    );
  });

  it("never accepts a type outside the kind's own list", () => {
    for (const kind of UPLOAD_KINDS) {
      for (const sample of [JPEG, PNG, WEBP, PDF]) {
        const verdict = validateUpload(kind, sample);
        if (verdict.ok) {
          expect(KIND_RULES[kind].accepts, kind).toContain(verdict.type);
        }
      }
    }
  });
});

describe("kinds", () => {
  it("rejects a kind that is not in the table", () => {
    expect(isUploadKind("qr")).toBe(false);
    expect(isUploadKind("passport")).toBe(false);
    expect(isUploadKind(undefined)).toBe(false);
  });

  it("separates the four photo kinds from the declaration", () => {
    expect(isPhotoKind("overall")).toBe(true);
    expect(isPhotoKind("serial_plate")).toBe(true);
    expect(isPhotoKind("declaration_doc")).toBe(false);
  });
});

describe("storage keys", () => {
  it("is built from a uuid and the sniffed extension, never the filename", () => {
    const key = storageKeyFor(
      dronePrefix("11111111-2222-3333-4444-555555555555"),
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "jpg",
    );
    expect(key).toEqual({
      prefix: "drones/11111111-2222-3333-4444-555555555555",
      filename: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg",
    });
    // Nothing an uploader typed appears anywhere in the key.
    expect(JSON.stringify(key)).not.toMatch(/\.\./);
  });

  it("keeps declarations in their own prefix", () => {
    expect(declarationPrefix("abc")).toBe("declarations/abc");
  });
});

describe("acceptsUploads", () => {
  it("allows a draft and a rejected drone", () => {
    expect(acceptsUploads("draft")).toBe(true);
    expect(acceptsUploads("rejected")).toBe(true);
  });

  /**
   * A photo appearing under a reviewer mid-decision means they approved
   * something they did not see.
   */
  it("refuses everything a reviewer has already looked at", () => {
    for (const status of ["pending", "approved", "expired", "revoked"]) {
      expect(acceptsUploads(status), status).toBe(false);
    }
  });
});
