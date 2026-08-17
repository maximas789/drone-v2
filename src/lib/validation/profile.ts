/**
 * Everything a pilot profile has to satisfy, in one **pure** module.
 *
 * No database, no session, no `server-only` — so the wizard can run the exact
 * same checks the server runs and answer instantly, and the server can still
 * run them again on a POST that never went near the form. The client is never
 * the check; it is the same check, earlier.
 *
 * Every failure is a **stable code**, translated at render. Nothing here
 * produces a sentence in either language.
 */

import { riyadhDayKey } from "@/lib/format";
import { validateSaudiMobile } from "./mobile";
import { validateIdDocument, type IdDocumentType } from "./saudi-id";

export const MIN_AGE_YEARS = 18;
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 100;
export const ADDRESS_MAX_LENGTH = 200;
/** Nobody alive is older than this, and a typed `1890` is a typo, not a pilot. */
const MAX_AGE_YEARS = 120;

/**
 * Arabic script, plus the space and the few marks that appear inside real
 * names. **No Latin letters** — an English name typed into the Arabic field is
 * the mistake this catches, and it is a common one on a Latin keyboard.
 *
 * The ranges are Arabic (U+0600–U+06FF) and Arabic Supplement / Extended-A,
 * which is where the letters used for some names outside Arabic itself live.
 */
const ARABIC_NAME = /^[؀-ۿݐ-ݿࢠ-ࣿ\s'’.]+$/u;

/**
 * Latin script for the English field, with the apostrophes and hyphens that
 * appear in transliterations (`Abd al-Rahman`, `O’Neill`).
 */
const LATIN_NAME = /^[A-Za-z\s'’.-]+$/u;

/** A Gregorian calendar day, `YYYY-MM-DD`, which is what `date()` stores. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export type ProfileProblem =
  | "name_ar_required"
  | "name_ar_script"
  | "name_en_required"
  | "name_en_script"
  | "id_format"
  | "id_checksum"
  | "id_type_mismatch"
  | "dob_required"
  | "dob_invalid"
  | "dob_underage"
  | "mobile_format"
  | "city_required"
  | "emergency_contact_format"
  | "address_too_long";

// --- Names ----------------------------------------------------------------

function nameProblem(
  raw: string,
  script: RegExp,
  requiredCode: ProfileProblem,
  scriptCode: ProfileProblem,
): ProfileProblem | null {
  const value = raw.trim();
  if (value.length < NAME_MIN_LENGTH || value.length > NAME_MAX_LENGTH) {
    return requiredCode;
  }
  return script.test(value) ? null : scriptCode;
}

export function validateArabicName(raw: string): ProfileProblem | null {
  return nameProblem(raw, ARABIC_NAME, "name_ar_required", "name_ar_script");
}

export function validateLatinName(raw: string): ProfileProblem | null {
  return nameProblem(raw, LATIN_NAME, "name_en_required", "name_en_script");
}

// --- Date of birth --------------------------------------------------------

/**
 * The latest date of birth that is still eighteen years old **today in
 * Riyadh**.
 *
 * Riyadh's civil day, not the server's: a profile completed at 01:00 local is
 * on the next UTC day, and a birthday that turned overnight has to turn where
 * the pilot is standing. `riyadhDayKey` is the same function slot derivation
 * uses, for the same reason.
 *
 * Returned as `YYYY-MM-DD` so the comparison is a string comparison — ISO days
 * sort lexicographically, and there is no `Date` arithmetic to get a timezone
 * wrong in.
 */
export function birthDateCutoff(now: Date, yearsAgo: number): string {
  const [year, month, day] = riyadhDayKey(now).split("-");
  return `${String(Number(year) - yearsAgo).padStart(4, "0")}-${month}-${day}`;
}

export function validateDateOfBirth(
  raw: string,
  now: Date = new Date(),
): ProfileProblem | null {
  const value = raw.trim();
  if (!value) return "dob_required";
  if (!ISO_DAY.test(value)) return "dob_invalid";

  // Reject 2026-02-31 and friends: `Date` would roll it over to March rather
  // than refuse it, and a stored date nobody typed is worse than a refusal.
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "dob_invalid";
  if (parsed.toISOString().slice(0, 10) !== value) return "dob_invalid";

  if (value > birthDateCutoff(now, 0)) return "dob_invalid"; // in the future
  if (value < birthDateCutoff(now, MAX_AGE_YEARS)) return "dob_invalid";
  if (value > birthDateCutoff(now, MIN_AGE_YEARS)) return "dob_underage";

  return null;
}

// --- The whole thing ------------------------------------------------------

export type ProfileDraft = {
  fullNameAr: string;
  fullNameEn: string;
  idDocumentType: IdDocumentType;
  idDocumentNumber: string;
  dateOfBirth: string;
  mobileE164: string;
  addressCityId: string;
  addressLine?: string | null;
  emergencyContact?: string | null;
};

/** The identity half — steps 1 and 2 of the wizard. */
export type IdentityDraft = Pick<
  ProfileDraft,
  "fullNameAr" | "fullNameEn" | "idDocumentType" | "idDocumentNumber" | "dateOfBirth"
>;

/** The contact half — step 3. */
export type ContactDraft = Pick<
  ProfileDraft,
  "mobileE164" | "addressCityId" | "addressLine" | "emergencyContact"
>;

export type Normalized<T> = { ok: true; value: T } | { ok: false; problems: ProfileProblem[] };

/**
 * Steps 1 and 2 together.
 *
 * **They are validated and saved as one** because `pilot_profile` declares
 * `id_document_number` and `id_document_hash` NOT NULL: a row holding a name
 * and no document would be an identity claim with no identity in it, and
 * loosening the columns to let the wizard save half of one would weaken a
 * regulator-facing record for the sake of a form. The wizard still *shows* two
 * panes; the row appears when the second one is answered.
 */
export function validateIdentity(
  draft: IdentityDraft,
  now: Date = new Date(),
): Normalized<{
  fullNameAr: string;
  fullNameEn: string;
  idDocumentType: IdDocumentType;
  idDocumentNumber: string;
  dateOfBirth: string;
}> {
  const problems: ProfileProblem[] = [];

  const arProblem = validateArabicName(draft.fullNameAr);
  if (arProblem) problems.push(arProblem);
  const enProblem = validateLatinName(draft.fullNameEn);
  if (enProblem) problems.push(enProblem);

  const document = validateIdDocument(draft.idDocumentType, draft.idDocumentNumber);
  if (!document.ok) problems.push(document.problem);

  const dobProblem = validateDateOfBirth(draft.dateOfBirth, now);
  if (dobProblem) problems.push(dobProblem);

  if (problems.length > 0 || !document.ok) {
    return { ok: false, problems };
  }

  return {
    ok: true,
    value: {
      fullNameAr: draft.fullNameAr.trim(),
      fullNameEn: draft.fullNameEn.trim(),
      idDocumentType: draft.idDocumentType,
      idDocumentNumber: document.number,
      dateOfBirth: draft.dateOfBirth.trim(),
    },
  };
}

/** Step 3. `addressLine` and `emergencyContact` are genuinely optional. */
export function validateContact(draft: ContactDraft): Normalized<{
  mobileE164: string;
  addressCityId: string;
  addressLine: string | null;
  emergencyContact: string | null;
}> {
  const problems: ProfileProblem[] = [];

  const mobile = validateSaudiMobile(draft.mobileE164);
  if (!mobile.ok) problems.push(mobile.problem);

  const cityId = draft.addressCityId.trim();
  if (!cityId) problems.push("city_required");

  const addressLine = draft.addressLine?.trim() || null;
  if (addressLine && addressLine.length > ADDRESS_MAX_LENGTH) {
    problems.push("address_too_long");
  }

  // Optional, but a number that *is* given has to be reachable — an emergency
  // contact nobody can dial is worse than an empty field, because it looks like
  // one that works.
  const emergencyRaw = draft.emergencyContact?.trim() || null;
  let emergencyContact: string | null = null;
  if (emergencyRaw) {
    const emergency = validateSaudiMobile(emergencyRaw);
    if (emergency.ok) {
      emergencyContact = emergency.e164;
    } else {
      problems.push("emergency_contact_format");
    }
  }

  if (problems.length > 0 || !mobile.ok) {
    return { ok: false, problems };
  }

  return {
    ok: true,
    value: {
      mobileE164: mobile.e164,
      addressCityId: cityId,
      addressLine,
      emergencyContact,
    },
  };
}

/**
 * What `completedAt` means, in one place.
 *
 * A profile is complete when every field a booking decision needs is present —
 * not when the wizard's last button was pressed. Reading it off the row rather
 * than off the journey is what makes it true for a row that F22 edited, a row
 * restored from a backup, or a row somebody half-filled in two sessions ago.
 */
export function isProfileComplete(row: {
  fullNameAr: string | null;
  fullNameEn: string | null;
  idDocumentType: string | null;
  idDocumentNumber: string | null;
  dateOfBirth: string | null;
  mobileE164: string | null;
  addressCityId: string | null;
}): boolean {
  return Boolean(
    row.fullNameAr?.trim() &&
      row.fullNameEn?.trim() &&
      row.idDocumentType &&
      row.idDocumentNumber?.trim() &&
      row.dateOfBirth &&
      row.mobileE164?.trim() &&
      row.addressCityId,
  );
}
