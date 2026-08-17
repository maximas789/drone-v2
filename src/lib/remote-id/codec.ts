import { randomBytes } from "node:crypto";

/**
 * The Remote ID code format. **Pure** — no database, no session, no request.
 *
 * This is the identifier that replaces the manufacturer serial number, so it is
 * printed on a sticker, read aloud over a radio, and typed in by someone
 * squinting at a scuffed airframe. Every property below exists for one of those
 * three.
 */

/**
 * **Crockford Base32.** 32 symbols, and the four that are missing are the
 * point:
 *
 * - `I`, `L`, `O` are dropped because they are indistinguishable from `1` and
 *   `0` at sticker size, in either language's numerals.
 * - `U` is dropped so a randomly generated code cannot spell something
 *   unfortunate on a government-facing registration document.
 *
 * The ambiguity is solved on **input** — see `normalizeCode` — rather than by
 * shrinking the alphabet further, which would cost entropy for nothing.
 */
export const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Every code starts with it, and the dashes are part of the canonical form. */
export const CODE_PREFIX = "AJN";

/** 8 symbols × 5 bits = 40 bits ≈ 1.1 × 10¹² codes. */
export const CODE_SYMBOLS = 8;

const CODE_BYTES = 5; // 40 bits, an exact multiple of 5 — so no modulo bias.

const CANONICAL = new RegExp(
  `^${CODE_PREFIX}-[${CROCKFORD_ALPHABET}]{4}-[${CROCKFORD_ALPHABET}]{4}$`,
);

/**
 * Ambiguity, resolved the way Crockford specifies: a human who reads `O` off a
 * sticker meant `0`, and there is no code in which they could have meant
 * anything else — `O` is not in the alphabet, so nothing is lost by mapping it.
 */
const AMBIGUOUS: Record<string, string> = {
  I: "1",
  L: "1",
  O: "0",
  U: "V",
};

/**
 * A fresh code. **Takes no arguments, and that is the design.**
 *
 * It is never derived from the drone's or the row's UUID: a derived code would
 * let anyone holding two codes correlate the rows behind them, or walk the id
 * space from one they legitimately hold. The only input is the CSPRNG.
 */
export function generateCode(): string {
  const bytes = randomBytes(CODE_BYTES);

  /**
   * 40 bits read 5 at a time, most significant first. A rolling accumulator
   * rather than one 40-bit integer: JavaScript's bitwise operators are 32-bit,
   * and `BigInt` literals need a compile target this project does not set.
   * The accumulator never holds more than 12 bits, so both are moot.
   */
  let accumulator = 0;
  let pending = 0;
  let symbols = "";

  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    pending += 8;
    while (pending >= 5) {
      pending -= 5;
      symbols += CROCKFORD_ALPHABET[(accumulator >> pending) & 31];
    }
  }

  return formatCode(symbols);
}

/** `4F2K91XZ` → `AJN-4F2K-91XZ`. The stored and displayed form are the same. */
export function formatCode(symbols: string): string {
  return `${CODE_PREFIX}-${symbols.slice(0, 4)}-${symbols.slice(4)}`;
}

/**
 * Whatever a human typed, scanned or pasted → the canonical code, or `null`.
 *
 * **Every entry point runs this first** — the public scan page, the JSON twin,
 * the admin lookup. Accepting `ajn 4f2k 91xz` and `AJN4F2K91XZ` is not
 * leniency for its own sake: the alternative is a field inspector concluding an
 * aircraft is unregistered because they typed a space.
 */
export function normalizeCode(input: string): string | null {
  if (typeof input !== "string") return null;

  const stripped = input.toUpperCase().replace(/[^0-9A-Z]/g, "");

  // The prefix is optional on input. `AJN` contains no ambiguous symbol, so
  // removing it before the mapping and after it are the same thing; before is
  // simply easier to read.
  const body = stripped.startsWith(CODE_PREFIX)
    ? stripped.slice(CODE_PREFIX.length)
    : stripped;

  if (body.length !== CODE_SYMBOLS) return null;

  let symbols = "";
  for (const character of body) {
    const mapped = AMBIGUOUS[character] ?? character;
    if (!CROCKFORD_ALPHABET.includes(mapped)) return null;
    symbols += mapped;
  }

  return formatCode(symbols);
}

/** Canonical form only. `normalizeCode` is what accepts anything else. */
export function isValidCode(value: string): boolean {
  return typeof value === "string" && CANONICAL.test(value);
}
