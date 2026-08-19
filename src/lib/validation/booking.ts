/**
 * What a pilot may put on a booking request beyond the slot itself: why they
 * are flying, and who is flying with them.
 *
 * **Pure, and deliberately not in `src/lib/actions/booking.ts`.** That file is
 * `"use server"`, and a `"use server"` module may export *only* async
 * functions — Next wraps every export as a server reference, so a plain array
 * exported from it reaches the browser as a callable proxy rather than an
 * array, and `FLIGHT_PURPOSES.map is not a function` is thrown at render with
 * every static check green. F19b found that the hard way; same split as
 * `validation/drone.ts` and `validation/declaration.ts`.
 */

/**
 * Stored as **codes**, translated at render, like every other enumerable value
 * in this schema. `booking.purpose` is a plain `text` column rather than an
 * enum — F13's choice, so a new purpose is a catalogue entry and not a
 * migration — which is exactly why the allowed set has to be enforced here
 * instead of by Postgres.
 */
export const FLIGHT_PURPOSES = [
  "recreational",
  "training",
  "photography",
  "inspection",
  "research",
] as const;

export type FlightPurpose = (typeof FLIGHT_PURPOSES)[number];

export function isFlightPurpose(value: unknown): value is FlightPurpose {
  return (
    typeof value === "string" &&
    (FLIGHT_PURPOSES as readonly string[]).includes(value)
  );
}

/**
 * **Three.** A crew larger than this is not a recreational flight, and the
 * limit is in the product rather than the schema so that the refusal can be a
 * sentence rather than a constraint violation.
 */
export const MAX_COPILOTS = 3;

export const COPILOT_NAME_MAX_LENGTH = 200;
export const PURPOSE_NOTE_MAX_LENGTH = 2_000;

export type CopilotInput = {
  fullNameAr?: string | null;
  fullNameEn?: string | null;
  mobileE164?: string | null;
};

export type CopilotFields = {
  fullNameAr: string;
  fullNameEn: string;
  mobileE164: string | null;
};

/**
 * Saudi mobile numbers in E.164: `+9665` and eight more digits.
 *
 * Deliberately **not** a general international pattern. A co-pilot is somebody
 * standing in a field in Saudi Arabia beside the pilot, and a permissive regex
 * here would accept a mistyped local number that no one can ever call. Stored
 * normalised so two spellings of one number are one number.
 */
const SAUDI_MOBILE = /^\+9665\d{8}$/;

/** `05xxxxxxxx`, `9665xxxxxxxx`, `+966 5x xxx xxxx` → `+9665xxxxxxxx`. */
export function normaliseMobile(raw: string): string | null {
  const digits = raw.replace(/[\s\-()]/g, "");
  const candidate = digits.startsWith("00")
    ? `+${digits.slice(2)}`
    : digits.startsWith("0")
      ? `+966${digits.slice(1)}`
      : digits.startsWith("+")
        ? digits
        : `+${digits}`;
  return SAUDI_MOBILE.test(candidate) ? candidate : null;
}

export type CopilotProblem =
  | "copilot_name_required"
  | "copilot_name_too_long"
  | "copilot_mobile_format"
  | "too_many_copilots";

export type CopilotValidation =
  | { ok: true; copilots: CopilotFields[] }
  | { ok: false; problems: CopilotProblem[] };

/**
 * **Both names, or neither.** `booking_copilot.full_name_ar` and
 * `full_name_en` are both `NOT NULL` — the paired-column convention for
 * human-authored content — so a co-pilot named in one script only cannot be
 * stored. Rather than quietly copying one into the other, which would put Latin
 * letters in an Arabic column and make the pair a lie, the form asks for both
 * and this refuses until it has them.
 *
 * **Wholly empty rows are dropped, not refused.** The form renders up to three
 * slots and a pilot flying alone leaves all of them blank; treating that as an
 * error would make the commonest case the one that fails.
 */
export function validateCopilots(
  inputs: readonly CopilotInput[],
): CopilotValidation {
  const problems = new Set<CopilotProblem>();
  const copilots: CopilotFields[] = [];

  for (const input of inputs) {
    const ar = (input.fullNameAr ?? "").trim();
    const en = (input.fullNameEn ?? "").trim();
    const mobileRaw = (input.mobileE164 ?? "").trim();

    if (!ar && !en && !mobileRaw) continue;

    if (!ar || !en) problems.add("copilot_name_required");
    if (
      ar.length > COPILOT_NAME_MAX_LENGTH ||
      en.length > COPILOT_NAME_MAX_LENGTH
    ) {
      problems.add("copilot_name_too_long");
    }

    let mobile: string | null = null;
    if (mobileRaw) {
      mobile = normaliseMobile(mobileRaw);
      if (!mobile) problems.add("copilot_mobile_format");
    }

    copilots.push({ fullNameAr: ar, fullNameEn: en, mobileE164: mobile });
  }

  if (copilots.length > MAX_COPILOTS) problems.add("too_many_copilots");

  return problems.size > 0
    ? { ok: false, problems: [...problems] }
    : { ok: true, copilots };
}
