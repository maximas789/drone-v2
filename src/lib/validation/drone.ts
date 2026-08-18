/**
 * What a drone registration has to satisfy, in one **pure** module.
 *
 * Same split as `./profile.ts`, `airspace/evaluate.ts` and `rate-limit/rules.ts`:
 * no database, no session, no `server-only`, so the wizard runs the identical
 * checks the server runs and the weight-class boundaries can be tested without
 * a connection string.
 *
 * Every failure is a **stable code**, translated at render.
 */

import type { droneBuildType, droneWeightClass } from "@/lib/db/enums";

export type BuildType = (typeof droneBuildType.enumValues)[number];
export type WeightClass = (typeof droneWeightClass.enumValues)[number];

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 60;
export const TEXT_MAX_LENGTH = 120;
export const SERIAL_MIN_LENGTH = 3;
export const SERIAL_MAX_LENGTH = 64;

/**
 * The heaviest aircraft this app will accept a registration for.
 *
 * Not a regulatory limit — a typo guard. 300 kg is far beyond anything called a
 * drone by a civilian operator, and without a ceiling a slipped keystroke stores
 * a 2,500,000 g airframe in the regulator's record.
 */
const MAX_WEIGHT_GRAMS = 300_000;

export type DroneProblem =
  | "nickname_required"
  | "build_type_required"
  | "manufacturer_required"
  | "weight_required"
  | "weight_out_of_range"
  | "serial_required"
  | "serial_format"
  | "serial_not_applicable"
  | "text_too_long";

// --- What may still be changed --------------------------------------------

/**
 * The statuses in which a pilot may still change their own registration.
 *
 * **One list, because there is one rule.** F07 wrote it for uploads and F18a
 * wrote `status !== "draft"` for the fields, and the two disagreed: a rejected
 * drone accepted new photographs but refused a corrected weight, so a pilot
 * told "the declared weight does not match the airframe" had no way to act on
 * it. A rejection that cannot be answered is the dead end F18 exists to
 * prevent.
 *
 * `pending` is out because a form changing underneath a reviewer means they
 * decided on something they did not see. `approved`, `expired` and `revoked`
 * are out because those are registration records, not drafts — an expired
 * registration is renewed, which resubmits the aircraft as it was registered.
 *
 * It lives **here**, in the pure module, so a client component can ask the
 * question without pulling `src/lib/storage` into the browser bundle.
 */
export const EDITABLE_DRONE_STATUSES = ["draft", "rejected"] as const;

export function isDroneEditable(status: string): boolean {
  return (EDITABLE_DRONE_STATUSES as readonly string[]).includes(status);
}

// --- Weight ---------------------------------------------------------------

/**
 * `weightGrams` → `weightClass`, and the **only** place that mapping exists.
 *
 * Stored rather than derived at read time because it is indexed and because a
 * zone's weight ceiling is compared against it in the airspace engine's hot
 * loop — but derived rather than *entered*, because a pilot who picks their own
 * class picks the flattering one.
 *
 * The boundaries are **exclusive at the top**: 249 g is `micro`, 250 g is
 * `light`. That is what "under 250 g" means, and getting it backwards would put
 * an aircraft in the exempt class that is not exempt.
 */
export function weightClassFor(grams: number): WeightClass {
  if (grams < 250) return "micro";
  if (grams < 4_000) return "light";
  if (grams < 25_000) return "medium";
  return "heavy";
}

/**
 * Whether an aircraft is light enough that registration may not be required at
 * all.
 *
 * The UI says "**may** be exempt" and links to nothing that promises it —
 * exemptions are the regulator's to grant and this app is a proposal, not an
 * authority. Stating it is still worth doing: somebody registering a 200 g toy
 * should know the rule exists rather than find out later.
 */
export function mayBeExempt(grams: number): boolean {
  return weightClassFor(grams) === "micro";
}

// --- The serial number ----------------------------------------------------

/**
 * **The inversion this whole product is built on.**
 *
 * GACA requires a manufacturer serial number to register, which self-built and
 * FPV aircraft do not have — so their operators cannot legally register
 * anywhere. Ajniha requires a serial **only** for a commercial airframe, and
 * replaces it with Remote ID everywhere else.
 *
 * `drone.serialNumber` is nullable and this function is why. Do not "fix"
 * either of them.
 */
export function serialRequiredFor(buildType: BuildType): boolean {
  return buildType === "commercial";
}

// --- Step 1: type ---------------------------------------------------------

export type TypeDraft = {
  nickname: string;
  buildType: BuildType | "";
  manufacturer: string;
  model: string;
  propulsion: string;
};

export type Checked<T> =
  | { ok: true; value: T }
  | { ok: false; problems: DroneProblem[] };

/**
 * Step 1.
 *
 * **`manufacturer` is required for a commercial airframe and free text for
 * everybody else** — a self-builder writes their own name, which is the true
 * answer to "who made this". `model` and `propulsion` are optional throughout:
 * a scratch-built quad has no model number and inventing a required field would
 * make the pilot fabricate one.
 */
export function validateDroneType(draft: TypeDraft): Checked<{
  nickname: string;
  buildType: BuildType;
  manufacturer: string | null;
  model: string | null;
  propulsion: string | null;
}> {
  const problems: DroneProblem[] = [];

  const nickname = draft.nickname.trim();
  if (
    nickname.length < NICKNAME_MIN_LENGTH ||
    nickname.length > NICKNAME_MAX_LENGTH
  ) {
    problems.push("nickname_required");
  }

  if (!draft.buildType) problems.push("build_type_required");

  const manufacturer = draft.manufacturer.trim();
  if (draft.buildType === "commercial" && manufacturer.length === 0) {
    problems.push("manufacturer_required");
  }

  const model = draft.model.trim();
  const propulsion = draft.propulsion.trim();
  if (
    [manufacturer, model, propulsion].some(
      (value) => value.length > TEXT_MAX_LENGTH,
    )
  ) {
    problems.push("text_too_long");
  }

  if (problems.length > 0 || !draft.buildType) {
    return { ok: false, problems };
  }

  return {
    ok: true,
    value: {
      nickname,
      buildType: draft.buildType,
      manufacturer: manufacturer || null,
      model: model || null,
      propulsion: propulsion || null,
    },
  };
}

// --- Step 2: specifications ----------------------------------------------

export type SpecsDraft = {
  buildType: BuildType;
  /** As typed. A text field, not `type="number"` — see the component. */
  weightGrams: string;
  hasCamera: boolean;
  serialNumber: string;
};

export function validateDroneSpecs(draft: SpecsDraft): Checked<{
  weightGrams: number;
  weightClass: WeightClass;
  hasCamera: boolean;
  serialNumber: string | null;
}> {
  const problems: DroneProblem[] = [];

  const typed = draft.weightGrams.trim();
  const grams = Number(typed);
  let weightOk = false;
  if (typed.length === 0) {
    problems.push("weight_required");
  } else if (!/^\d+$/.test(typed) || !Number.isFinite(grams)) {
    // A whole number of grams. `Number("1e5")` is finite and `Number("")` is 0,
    // so the shape has to be checked before the value.
    problems.push("weight_out_of_range");
  } else if (grams <= 0 || grams > MAX_WEIGHT_GRAMS) {
    problems.push("weight_out_of_range");
  } else {
    weightOk = true;
  }

  const serial = draft.serialNumber.trim();
  if (serialRequiredFor(draft.buildType)) {
    if (serial.length === 0) {
      problems.push("serial_required");
    } else if (
      serial.length < SERIAL_MIN_LENGTH ||
      serial.length > SERIAL_MAX_LENGTH
    ) {
      problems.push("serial_format");
    }
  } else if (serial.length > 0) {
    /**
     * A serial typed into a form that never showed the field — so it arrived by
     * a direct POST, not from the wizard. Refused rather than silently dropped:
     * storing it would put a manufacturer's serial on an airframe that has none,
     * and dropping it quietly would tell the caller nothing.
     */
    problems.push("serial_not_applicable");
  }

  if (problems.length > 0 || !weightOk) {
    return { ok: false, problems };
  }

  return {
    ok: true,
    value: {
      weightGrams: grams,
      weightClass: weightClassFor(grams),
      hasCamera: draft.hasCamera,
      serialNumber: serialRequiredFor(draft.buildType) ? serial : null,
    },
  };
}
