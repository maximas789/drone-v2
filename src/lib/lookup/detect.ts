import {
  CODE_PREFIX,
  CROCKFORD_ALPHABET,
  CODE_SYMBOLS,
  normalizeCode,
} from "@/lib/remote-id/codec";
import { normalizeIdNumber, SAUDI_ID_LENGTH } from "@/lib/validation/saudi-id";

/**
 * What the officer typed, classified. **Pure** — no database, no session, no
 * request — for the same reason `codec.ts` and `redact.ts` are: this is the
 * half of the lookup that decides *which register gets queried*, and a
 * classifier a connection string can veto is a classifier nobody can
 * unit-test.
 *
 * **One box, six questions.** A GACA officer standing beside an aircraft has a
 * code off a sticker, four symbols they could read before it moved, a module
 * serial off a document, a phone number, or half a name. Making them pick a
 * category first is making them classify their own evidence before they know
 * what it is worth. The box works it out, and the screen says **how it was
 * read** — a mistyped code that silently fell through to a name search would
 * report "no registration found" about an aircraft that is registered, which
 * is the one wrong answer this tool must never give.
 */

export type LookupKind =
  | "empty"
  | "code"
  | "partial"
  | "national_id"
  | "mobile"
  | "module_serial"
  | "name";

export type LookupQuery =
  | { kind: "empty" }
  /** A whole code, normalised. `ajn 4f2k 91xz` and `AJN4F2K91XZ` land here. */
  | { kind: "code"; code: string }
  /** 3–7 Crockford symbols — the fragment somebody could read before it moved. */
  | { kind: "partial"; symbols: string }
  /** Ten digits. **Hashed** before it reaches a query; never matched as text. */
  | { kind: "national_id"; digits: string }
  | { kind: "mobile"; e164: string }
  | { kind: "module_serial"; serial: string }
  | { kind: "name"; text: string };

/**
 * The kinds that may be written into an `audit_event`. **`empty` is not one** —
 * an empty box is not a search and nothing is logged for it.
 *
 * The *values* never are: a national ID or a mobile number in the audit table
 * would put unhashed personal data in the regulator's trail for searches that
 * matched nobody, which is exactly backwards.
 */
export const LOGGED_LOOKUP_KINDS = [
  "code",
  "partial",
  "national_id",
  "mobile",
  "module_serial",
  "name",
] as const satisfies readonly Exclude<LookupKind, "empty">[];

/** The shortest fragment worth querying. Two symbols matches half the register. */
export const MIN_PARTIAL_SYMBOLS = 3;

/** The longest input a lookup accepts, in characters. */
export const MAX_LOOKUP_LENGTH = 100;

/**
 * `detectLookup(raw)` — **code first, and the order is the design.**
 *
 * A whole code is the common case and its format is unambiguous, so nothing
 * else gets a chance to claim one. Everything below it is ordered by how
 * distinctive the shape is, most distinctive first, so that a later, vaguer
 * rule can never swallow an input an earlier one would have recognised.
 */
export function detectLookup(raw: string): LookupQuery {
  if (typeof raw !== "string") return { kind: "empty" };
  const trimmed = raw.trim().slice(0, MAX_LOOKUP_LENGTH);
  if (trimmed === "") return { kind: "empty" };

  // 1. A whole code, however it was spelled — including with `O` for `0`.
  const code = normalizeCode(trimmed);
  if (code) return { kind: "code", code };

  /**
   * `normalizeIdNumber` is reused rather than reimplemented: it maps
   * Arabic-Indic and Persian digits to ASCII and strips the bidi marks an RTL
   * input leaves around a Latin run. An officer typing on an Arabic keyboard
   * produces `٠٥٠…`, and refusing that in an Arabic-first app would be absurd.
   */
  const digits = normalizeIdNumber(trimmed);

  // 2. A Saudi mobile, in any of the four ways one is written down.
  const e164 = toSaudiE164(digits);
  if (e164) return { kind: "mobile", e164 };

  // 3. Ten digits. Not "eight to twenty" — a longer run of digits is far more
  //    likely a module serial, and a GCC card searched as a national ID would
  //    answer "not found" about somebody who is registered.
  if (digits.length === SAUDI_ID_LENGTH && /^\d+$/.test(digits)) {
    return { kind: "national_id", digits };
  }

  // 4. A fragment of a code. Shorter than a whole one by definition — an
  //    8-symbol body was already claimed by `normalizeCode` above.
  const symbols = partialSymbols(trimmed);
  if (symbols) return { kind: "partial", symbols };

  /**
   * 5. A module serial. Distinguished from a name by carrying a digit and no
   *    whitespace — no person's name does both. A serial that happens to be
   *    letters-only and short was claimed as a partial code above; the screen
   *    says so, and offers to re-run it as a name. That escape hatch is why
   *    this classifier is allowed to be decisive rather than hedging.
   */
  if (!/\s/.test(trimmed) && /\d/.test(trimmed) && trimmed.length >= 4) {
    return { kind: "module_serial", serial: trimmed };
  }

  return { kind: "name", text: trimmed };
}

/**
 * The four ways a Saudi mobile number is written: `+9665XXXXXXXX`,
 * `009665XXXXXXXX`, `05XXXXXXXX` and `5XXXXXXXX`.
 *
 * All four normalise to E.164, which is what `pilot_profile.mobile_e164`
 * stores — so the match is an equality, not an `ilike` over a column of phone
 * numbers.
 *
 * **The `5` is required.** Saudi mobile numbers all begin with it; without that
 * check a ten-digit landline or a mistyped ID would be searched as a phone
 * number and answer "not found" for the wrong reason.
 */
export function toSaudiE164(digits: string): string | null {
  let body = digits;
  if (body.startsWith("+")) body = body.slice(1);
  else if (body.startsWith("00")) body = body.slice(2);

  if (!/^\d+$/.test(body)) return null;

  if (body.startsWith("966")) {
    const national = body.slice(3);
    return /^5\d{8}$/.test(national) ? `+966${national}` : null;
  }
  if (/^05\d{8}$/.test(body)) return `+966${body.slice(1)}`;
  if (/^5\d{8}$/.test(body)) return `+966${body}`;
  return null;
}

/**
 * A code fragment, normalised the same way a whole code is — so an officer who
 * reads `9IXZ` off a scuffed sticker gets `91XZ`, exactly as they would if they
 * had managed to read all eight symbols.
 *
 * The `AJN` prefix is stripped if present, which means typing `AJN-4F2K` finds
 * the aircraft rather than searching for the letters `AJN`.
 */
export function partialSymbols(raw: string): string | null {
  const stripped = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const body = stripped.startsWith(CODE_PREFIX)
    ? stripped.slice(CODE_PREFIX.length)
    : stripped;

  if (body.length < MIN_PARTIAL_SYMBOLS || body.length >= CODE_SYMBOLS) {
    return null;
  }

  let symbols = "";
  for (const character of body) {
    const mapped = AMBIGUOUS_PARTIAL[character] ?? character;
    if (!CROCKFORD_ALPHABET.includes(mapped)) return null;
    symbols += mapped;
  }
  return symbols;
}

/**
 * The same mapping `normalizeCode` applies, duplicated here because `codec.ts`
 * keeps its table private — and deliberately so: it is the canonical form's
 * business, not a shared utility. `detect.test.ts` asserts the two agree on
 * every symbol, so a change to one that is not made to the other fails a test
 * rather than a field inspector.
 */
const AMBIGUOUS_PARTIAL: Record<string, string> = {
  I: "1",
  L: "1",
  O: "0",
  U: "V",
};
