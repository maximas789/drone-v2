/**
 * Saudi identity-document validation. **Pure** — no database, no session, no
 * request, no `server-only`.
 *
 * Same split as `src/lib/airspace/evaluate.ts` and `src/lib/rate-limit/rules.ts`
 * and for the same reason: this is arithmetic that decides whether somebody can
 * register at all, and arithmetic a connection string can veto is arithmetic
 * nobody can unit-test. It also runs unchanged in the browser, so the wizard can
 * say "that checksum is wrong" before a round trip — and the server still says
 * it again, because the client is never the check.
 */

export type IdDocumentType = "saudi_national_id" | "iqama" | "gcc_id";

/**
 * Every way an identity number can be wrong, as a stable code. Translated at
 * render like every other refusal in this app — never a sentence from here.
 */
export type IdDocumentProblem =
  | "id_format" // not the right shape at all
  | "id_checksum" // right shape, fails the check digit
  | "id_type_mismatch"; // a `1` number declared as an Iqama, or the reverse

/** Saudi national IDs and Iqamas are both exactly ten digits. */
export const SAUDI_ID_LENGTH = 10;

/** `1` is a Saudi citizen, `2` a resident. No other first digit is issued. */
const PREFIX_FOR: Record<"saudi_national_id" | "iqama", "1" | "2"> = {
  saudi_national_id: "1",
  iqama: "2",
};

/**
 * A GCC identity card is another state's document and this app does not know
 * its check digit, so the only honest check is a shape check. Kept deliberately
 * wide — narrowing it would refuse real documents on a guess.
 */
const GCC_MIN_LENGTH = 8;
const GCC_MAX_LENGTH = 20;

/**
 * What a person typed, reduced to the digits they meant.
 *
 * Three things happen here, and every one of them is load-bearing because
 * `idDocumentHash` is UNIQUE over this output — two spellings of one number
 * that normalise differently are two profiles for one person.
 *
 * 1. **Arabic-Indic digits become ASCII.** An Arabic keyboard produces `٠١٢`
 *    (U+0660–0669) and a Persian layout `۰۱۲` (U+06F0–06F9). Rejecting those as
 *    "not a number" in an Arabic-first app would be absurd — the app forces
 *    Latin numerals when it *renders* (rule 6); it must still read what a
 *    reader of Arabic actually types.
 * 2. **Separators go.** Spaces and dashes are how people group long numbers.
 * 3. **Bidi marks go.** A browser can leave U+200E/U+200F around Latin digits
 *    typed into an RTL input. They are invisible, so a mismatch caused by one
 *    would be undebuggable from the screen.
 */
/**
 * The separators and invisibles that are dropped.
 *
 * A labelled list rather than a regex character class: U+200E and U+200F are
 * invisible, and inside `/[\s-]/` the next person to read the line would see a
 * class with nothing in it and tidy it away. On their own lines, with a comment
 * each, they are at least *findable*.
 */
const DISCARDED_IN_ID = new Set([
  " ",
  "\t",
  "-",
  "–", // en dash, from a paste
  "‎", // left-to-right mark
  "‏", // right-to-left mark
]);

export function normalizeIdNumber(raw: string): string {
  return [...raw]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;
      if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
      if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
      // Anything else that is not a separator is kept **as typed** — a letter
      // in an ID field is a typo, and silently deleting it could turn one
      // person's mistyped number into another person's valid one.
      return DISCARDED_IN_ID.has(character) ? "" : character;
    })
    .join("");
}

/**
 * The Saudi check digit, over all ten digits.
 *
 * A Luhn variant: reading left to right, the digits in **odd positions** (1st,
 * 3rd, … 9th — indices 0, 2, 4, 6, 8) are doubled and their own digits summed;
 * the rest, **including the tenth check digit**, are added as they are. A valid
 * number totals a multiple of ten.
 *
 * Written as one loop over all ten rather than "compute the expected check
 * digit and compare", because the two are the same statement and this is the
 * form the check is published in.
 */
export function saudiIdChecksumValid(digits: string): boolean {
  if (!/^\d{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < SAUDI_ID_LENGTH; i++) {
    const digit = Number(digits[i]);
    if (i % 2 === 0) {
      const doubled = digit * 2;
      // 16 contributes 7, not 16. `Math.floor(d / 10)` is 1 for anything
      // doubled past 9 and 0 otherwise.
      sum += Math.floor(doubled / 10) + (doubled % 10);
    } else {
      sum += digit;
    }
  }
  return sum % 10 === 0;
}

/**
 * The check digit a nine-digit stem needs. **Test helper and nothing else** —
 * no production path generates an identity number, and one that did would be
 * manufacturing identities.
 *
 * Exported because the alternative is a test file that hard-codes numbers
 * somebody once read on the internet and asserts they are real people's IDs.
 */
export function saudiIdCheckDigit(stem: string): number {
  if (!/^\d{9}$/.test(stem)) {
    throw new Error(`saudiIdCheckDigit expects nine digits, got ${stem.length}`);
  }
  for (let candidate = 0; candidate < 10; candidate++) {
    if (saudiIdChecksumValid(`${stem}${candidate}`)) return candidate;
  }
  // Unreachable: the check digit is the sum's complement mod 10, so exactly one
  // of the ten always closes it.
  throw new Error(`no check digit closes ${stem}`);
}

/**
 * Which Saudi document a number claims to be, from its first digit alone.
 *
 * Returns `null` for anything else — including a number that is otherwise
 * well-formed. The type is **not** guessed from context, because a `3` prefix
 * is not an Iqama with a typo, it is a number Saudi Arabia does not issue.
 */
export function detectSaudiIdType(
  digits: string,
): "saudi_national_id" | "iqama" | null {
  if (!/^\d{10}$/.test(digits)) return null;
  if (digits.startsWith("1")) return "saudi_national_id";
  if (digits.startsWith("2")) return "iqama";
  return null;
}

export type IdDocumentVerdict =
  | { ok: true; number: string }
  | { ok: false; problem: IdDocumentProblem };

/**
 * The whole check, for one declared type and one typed number.
 *
 * The declared type must **agree** with the number rather than being overridden
 * by it. Silently rewriting "Iqama" to "national ID" because the number starts
 * with a 1 would put a claim in a regulator-facing record that the person never
 * made, and the mismatch is far more likely to be a typed digit than a
 * misunderstood dropdown.
 */
export function validateIdDocument(
  type: IdDocumentType,
  raw: string,
): IdDocumentVerdict {
  const digits = normalizeIdNumber(raw);

  if (type === "gcc_id") {
    // Digits only, and a length range wide enough to hold documents this app
    // has never seen. No checksum: inventing one for another state's card
    // would refuse valid people on a guess.
    return /^\d+$/.test(digits) &&
      digits.length >= GCC_MIN_LENGTH &&
      digits.length <= GCC_MAX_LENGTH
      ? { ok: true, number: digits }
      : { ok: false, problem: "id_format" };
  }

  if (!/^\d{10}$/.test(digits)) {
    return { ok: false, problem: "id_format" };
  }

  if (!digits.startsWith(PREFIX_FOR[type])) {
    // A `3`-prefixed ten-digit number reaches here too, and "that is not the
    // document you selected" is the true thing to say about it.
    return { ok: false, problem: "id_type_mismatch" };
  }

  if (!saudiIdChecksumValid(digits)) {
    return { ok: false, problem: "id_checksum" };
  }

  return { ok: true, number: digits };
}
