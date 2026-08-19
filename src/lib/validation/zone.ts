import { BUILD_TYPES } from "./drone";

/**
 * The zone form's rules — **pure, and shared by the form and the action.**
 *
 * The form runs them for live feedback; `createZoneAction` runs the same ones
 * as the authority, because a server action is an ordinary POST and markup is
 * not a check. Same split as `validation/profile.ts` and `validation/drone.ts`,
 * and the same reason.
 *
 * Geometry is **not** validated here — `src/lib/geo/validate.ts` owns that, and
 * it is a different question with a different vocabulary.
 */

export const ZONE_KINDS = ["permitted", "restricted", "no_fly"] as const;
export type ZoneKind = (typeof ZONE_KINDS)[number];

export const WEIGHT_CLASSES = ["micro", "light", "medium", "heavy"] as const;
export type WeightClass = (typeof WEIGHT_CLASSES)[number];

/**
 * A zone code, `RUH-P-01`-shaped: a city prefix, a letter for the kind, a
 * number. Uppercase, ASCII, hyphenated — it is an identifier a person reads
 * aloud over a radio, so no Arabic and no spaces.
 */
const CODE_PATTERN = /^[A-Z]{2,4}(-[A-Z0-9]{1,6}){1,3}$/;

export const MAX_NAME_LENGTH = 120;
export const MAX_NOTES_LENGTH = 2_000;

/** The ceiling a zone may state, metres AGL. Above this it is not a drone rule. */
export const MAX_CEILING_M = 1_000;
export const MAX_CAPACITY = 50;
export const MAX_SLOT_MINUTES = 8 * 60;
export const MAX_ADVANCE_DAYS = 365;

export type ZoneProblem =
  | "code_required"
  | "code_invalid"
  | "city_required"
  | "kind_invalid"
  | "name_ar_required"
  | "name_en_required"
  | "name_too_long"
  | "notes_too_long"
  | "ceiling_invalid"
  | "floor_invalid"
  | "floor_above_ceiling"
  | "capacity_invalid"
  | "slot_duration_invalid"
  | "lead_invalid"
  | "advance_invalid"
  | "slots_per_day_invalid"
  | "weight_class_invalid"
  | "build_types_invalid"
  | "build_types_empty";

export type ZoneDraft = {
  code: string;
  cityId: string;
  kind: string;
  nameAr: string;
  nameEn: string;
  districtAr: string;
  districtEn: string;
  notesAr: string;
  notesEn: string;
  ceilingAglM: number | null;
  floorAglM: number;
  capacity: number;
  slotDurationMinutes: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  maxSlotsPerPilotPerDay: number;
  autoApprove: boolean;
  nightAllowed: boolean;
  maxWeightClass: string | null;
  permittedBuildTypes: string[];
  requiresBroadcastRid: boolean;
  authorityRef: string;
};

export type ZoneValidation =
  | { ok: true; value: ZoneDraft }
  | { ok: false; problems: ZoneProblem[] };

function isWholeNumberInRange(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

/**
 * **Both languages are required.** A zone named only in English is broken for
 * the app's primary audience — the pilot map, the booking confirmation and the
 * cancellation email would all fall back to a name half the users cannot read —
 * so the form refuses rather than storing a silent gap. Arabic is authored
 * first everywhere else in this project; here they are simply both mandatory.
 *
 * District and notes are genuinely optional, but **paired**: supplying one
 * language of a pair without the other is not refused, because an admin adding
 * an Arabic note first and the English later is a reasonable order to work in
 * and the render side already handles a missing one.
 */
export function validateZone(draft: ZoneDraft): ZoneValidation {
  const problems: ZoneProblem[] = [];

  const code = draft.code.trim().toUpperCase();
  if (code === "") problems.push("code_required");
  else if (!CODE_PATTERN.test(code)) problems.push("code_invalid");

  if (draft.cityId.trim() === "") problems.push("city_required");
  if (!(ZONE_KINDS as readonly string[]).includes(draft.kind)) {
    problems.push("kind_invalid");
  }

  const nameAr = draft.nameAr.trim();
  const nameEn = draft.nameEn.trim();
  if (nameAr === "") problems.push("name_ar_required");
  if (nameEn === "") problems.push("name_en_required");
  if (nameAr.length > MAX_NAME_LENGTH || nameEn.length > MAX_NAME_LENGTH) {
    problems.push("name_too_long");
  }
  if (
    draft.notesAr.length > MAX_NOTES_LENGTH ||
    draft.notesEn.length > MAX_NOTES_LENGTH
  ) {
    problems.push("notes_too_long");
  }

  /**
   * A null ceiling means "no zone ceiling of its own" — the engine then applies
   * nothing beyond the national limit, which is a real and intended state. Zero
   * is not that: a zone with a ceiling of nought metres is one nobody may fly
   * in, and if that is what somebody means, `no_fly` is the honest way to say
   * it.
   */
  if (draft.ceilingAglM !== null) {
    if (!isWholeNumberInRange(draft.ceilingAglM, 1, MAX_CEILING_M)) {
      problems.push("ceiling_invalid");
    }
  }
  if (!isWholeNumberInRange(draft.floorAglM, 0, MAX_CEILING_M)) {
    problems.push("floor_invalid");
  }
  if (
    draft.ceilingAglM !== null &&
    draft.floorAglM >= draft.ceilingAglM &&
    problems.every((problem) => !problem.startsWith("ceiling") && !problem.startsWith("floor"))
  ) {
    problems.push("floor_above_ceiling");
  }

  if (!isWholeNumberInRange(draft.capacity, 1, MAX_CAPACITY)) {
    problems.push("capacity_invalid");
  }
  /**
   * Fifteen minutes is the floor because the slot grid is what pilots book
   * against, and a five-minute grid over a twelve-hour day is 144 buttons.
   */
  if (!isWholeNumberInRange(draft.slotDurationMinutes, 15, MAX_SLOT_MINUTES)) {
    problems.push("slot_duration_invalid");
  }
  if (!isWholeNumberInRange(draft.minLeadMinutes, 0, 30 * 24 * 60)) {
    problems.push("lead_invalid");
  }
  if (!isWholeNumberInRange(draft.maxAdvanceDays, 1, MAX_ADVANCE_DAYS)) {
    problems.push("advance_invalid");
  }
  if (!isWholeNumberInRange(draft.maxSlotsPerPilotPerDay, 1, 24)) {
    problems.push("slots_per_day_invalid");
  }

  if (
    draft.maxWeightClass !== null &&
    !(WEIGHT_CLASSES as readonly string[]).includes(draft.maxWeightClass)
  ) {
    problems.push("weight_class_invalid");
  }

  if (draft.permittedBuildTypes.length === 0) {
    /**
     * An empty list is not "all" — it is a zone nobody may fly in, which is
     * `no_fly`'s job. Making the empty case a refusal rather than a silent
     * "everything" is what stops an admin unticking all three and publishing a
     * zone that refuses every pilot for a reason none of them can see.
     */
    problems.push("build_types_empty");
  } else if (
    draft.permittedBuildTypes.some(
      (value) => !(BUILD_TYPES as readonly string[]).includes(value),
    )
  ) {
    problems.push("build_types_invalid");
  }

  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    value: {
      ...draft,
      code,
      nameAr,
      nameEn,
      districtAr: draft.districtAr.trim(),
      districtEn: draft.districtEn.trim(),
      notesAr: draft.notesAr.trim(),
      notesEn: draft.notesEn.trim(),
      authorityRef: draft.authorityRef.trim(),
    },
  };
}

/** The shape a new zone starts in — the defaults the schema itself carries. */
export function emptyZoneDraft(): ZoneDraft {
  return {
    code: "",
    cityId: "",
    kind: "permitted",
    nameAr: "",
    nameEn: "",
    districtAr: "",
    districtEn: "",
    notesAr: "",
    notesEn: "",
    ceilingAglM: 120,
    floorAglM: 0,
    capacity: 4,
    slotDurationMinutes: 60,
    minLeadMinutes: 60,
    maxAdvanceDays: 30,
    maxSlotsPerPilotPerDay: 2,
    autoApprove: false,
    nightAllowed: false,
    maxWeightClass: null,
    permittedBuildTypes: [...BUILD_TYPES],
    requiresBroadcastRid: false,
    authorityRef: "",
  };
}
