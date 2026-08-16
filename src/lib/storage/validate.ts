/**
 * What may be uploaded, and what a file **actually is**.
 *
 * Pure: no database, no `server-only`, no request. Same split as
 * `airspace/evaluate.ts` and `rate-limit/rules.ts` — a rule a connection string
 * can veto is a rule nobody can unit-test, and every branch here is a rejection
 * that has to keep working.
 */

/** Every kind of file the app stores. `qr` is written by F08, never uploaded. */
export const UPLOAD_KINDS = [
  "overall",
  "serial_plate",
  "remote_id_module",
  "payload",
  "declaration_doc",
] as const;

export type UploadKind = (typeof UPLOAD_KINDS)[number];

/** The four that are rows in `drone_photo`. `declaration_doc` is not. */
export const PHOTO_KINDS = [
  "overall",
  "serial_plate",
  "remote_id_module",
  "payload",
] as const;

export type PhotoKind = (typeof PHOTO_KINDS)[number];

export function isUploadKind(value: unknown): value is UploadKind {
  return (
    typeof value === "string" && (UPLOAD_KINDS as readonly string[]).includes(value)
  );
}

export function isPhotoKind(value: UploadKind): value is PhotoKind {
  return (PHOTO_KINDS as readonly string[]).includes(value);
}

/**
 * The types we can identify from their leading bytes, and nothing else.
 *
 * **SVG is deliberately absent and must stay absent.** It is an XML document
 * that executes script in the browser, so an SVG accepted as a "photo" and
 * served back from our own origin is stored XSS. It also has no magic number to
 * sniff, which is the second reason it could never be on this list.
 */
export type SniffedType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

const IMAGE_TYPES: readonly SniffedType[] = ["image/jpeg", "image/png", "image/webp"];

export type KindRule = {
  accepts: readonly SniffedType[];
  maxBytes: number;
};

const MB = 1024 * 1024;

export const KIND_RULES: Record<UploadKind, KindRule> = {
  overall: { accepts: IMAGE_TYPES, maxBytes: 8 * MB },
  serial_plate: { accepts: IMAGE_TYPES, maxBytes: 8 * MB },
  remote_id_module: { accepts: IMAGE_TYPES, maxBytes: 8 * MB },
  payload: { accepts: IMAGE_TYPES, maxBytes: 8 * MB },
  /**
   * **PDF only.** A Declaration of Compliance is a document, and accepting a
   * photograph of one would put a reviewer in front of something they cannot
   * check the text of.
   */
  declaration_doc: { accepts: ["application/pdf"], maxBytes: 10 * MB },
};

export const EXTENSIONS: Record<SniffedType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * What the bytes say the file is — **not** what the filename or the
 * `Content-Type` header claims. Both of those are attacker-controlled: a `.svg`
 * renamed `.png` and sent as `image/png` is exactly the case this exists for.
 *
 * `null` means "not a type we accept", which is the same answer as "corrupt".
 * The endpoint does not need to tell those apart and should not try.
 */
export function sniffType(buffer: Uint8Array): SniffedType | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  // RIFF????WEBP — the four size bytes at offset 4 are skipped.
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer.subarray(8), [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}

function startsWith(buffer: Uint8Array, bytes: readonly number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, i) => buffer[i] === byte);
}

export type UploadRefusal =
  | { code: "upload_kind_unknown" }
  | { code: "upload_too_large"; maxBytes: number }
  | { code: "upload_empty" }
  | { code: "upload_type_rejected" };

export type UploadVerdict =
  | { ok: true; type: SniffedType; extension: string }
  | { ok: false; refusal: UploadRefusal };

/**
 * Size first, then bytes.
 *
 * A good JPEG that is too large gets the size message either way, so the order
 * only decides what a **doubly** wrong file is told — a 20 MB PDF sent as a
 * photograph. Size wins there because it is the fact the uploader has to act on
 * first: converting the file to a JPEG would still leave it 20 MB.
 */
export function validateUpload(
  kind: UploadKind,
  buffer: Uint8Array,
): UploadVerdict {
  const rule = KIND_RULES[kind];
  if (!rule) return { ok: false, refusal: { code: "upload_kind_unknown" } };
  if (buffer.length === 0) return { ok: false, refusal: { code: "upload_empty" } };
  if (buffer.length > rule.maxBytes) {
    return {
      ok: false,
      refusal: { code: "upload_too_large", maxBytes: rule.maxBytes },
    };
  }

  const type = sniffType(buffer);
  if (!type || !rule.accepts.includes(type)) {
    return { ok: false, refusal: { code: "upload_type_rejected" } };
  }

  return { ok: true, type, extension: EXTENSIONS[type] };
}

/**
 * The storage key. **The uploaded filename is never part of it** — it can
 * traverse (`../../`), it can collide, and it can carry the original name of a
 * file somebody did not mean to reveal.
 */
export function storageKeyFor(prefix: string, uuid: string, extension: string) {
  return { prefix, filename: `${uuid}.${extension}` };
}

/** `drones/{id}` and `declarations/{id}` — the only two prefixes uploads use. */
export function dronePrefix(droneId: string): string {
  return `drones/${droneId}`;
}

export function declarationPrefix(declarationId: string): string {
  return `declarations/${declarationId}`;
}

/**
 * Which drone statuses accept new files.
 *
 * A `pending` drone is in front of a reviewer, and a photo appearing underneath
 * them mid-decision means they approved something they did not see. `approved`
 * is a registration record, not a draft.
 */
export const EDITABLE_DRONE_STATUSES = ["draft", "rejected"] as const;

export function acceptsUploads(status: string): boolean {
  return (EDITABLE_DRONE_STATUSES as readonly string[]).includes(status);
}
