import { SAUDI_BOUNDS } from "@/lib/geo/bbox";

/**
 * A city's rules — **pure, shared by the form and the action.**
 *
 * A city is the smallest table in this build and the one with the most leverage
 * over the rest of it: a zone belongs to a city, the zone editor centres its
 * map on the city's centroid, and `isModelled` is what decides whether a city
 * claims to have authored airspace at all. Adding one is how an
 * `isModelled: false` city becomes a drawable one.
 *
 * **`isModelled` is not on this form.** It says "this city has authored
 * airspace", and nothing about creating a row makes that true — Riyadh is the
 * one city in this build with zones drawn for it, and a new city becomes
 * modelled by somebody drawing them, not by ticking a box. An admin who could
 * tick it would be publishing a claim the map cannot support.
 */

/** `RUH`, `JED`, `DMM` — three uppercase Latin letters, as the seed uses. */
const CODE_PATTERN = /^[A-Z]{3}$/;

export const MAX_CITY_NAME_LENGTH = 120;

export type CityProblem =
  | "city_code_required"
  | "city_code_invalid"
  | "city_name_ar_required"
  | "city_name_en_required"
  | "city_name_too_long"
  | "city_centroid_required"
  | "city_centroid_outside_saudi_arabia";

export type CityDraft = {
  code: string;
  nameAr: string;
  nameEn: string;
  /** Typed separately and labelled, because `[lng, lat]` reversal is the classic bug. */
  centroidLat: string;
  centroidLng: string;
};

export type CityValue = {
  code: string;
  nameAr: string;
  nameEn: string;
  centroidLat: number;
  centroidLng: number;
};

export type CityValidation =
  | { ok: true; value: CityValue }
  | { ok: false; problems: CityProblem[] };

export function emptyCityDraft(): CityDraft {
  return { code: "", nameAr: "", nameEn: "", centroidLat: "", centroidLng: "" };
}

/**
 * **The centroid is bounds-checked against Saudi Arabia**, by the same box the
 * seed and the geometry validator use.
 *
 * It is a sanity check, not a border: the box is a rectangle around the country
 * and a point in the Gulf passes it. What it catches is the failure that
 * actually happens — a latitude and a longitude swapped, which puts Riyadh at
 * 46°N 24°E, in the Adriatic, and makes every map that centres on the city open
 * over the sea.
 */
export function validateCity(draft: CityDraft): CityValidation {
  const problems: CityProblem[] = [];

  const code = draft.code.trim().toUpperCase();
  if (code === "") problems.push("city_code_required");
  else if (!CODE_PATTERN.test(code)) problems.push("city_code_invalid");

  const nameAr = draft.nameAr.trim();
  const nameEn = draft.nameEn.trim();
  if (nameAr === "") problems.push("city_name_ar_required");
  if (nameEn === "") problems.push("city_name_en_required");
  if (
    nameAr.length > MAX_CITY_NAME_LENGTH ||
    nameEn.length > MAX_CITY_NAME_LENGTH
  ) {
    problems.push("city_name_too_long");
  }

  const lat = Number(draft.centroidLat.trim());
  const lng = Number(draft.centroidLng.trim());
  const haveNumbers =
    draft.centroidLat.trim() !== "" &&
    draft.centroidLng.trim() !== "" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  if (!haveNumbers) problems.push("city_centroid_required");
  else if (
    lat < SAUDI_BOUNDS.minLat ||
    lat > SAUDI_BOUNDS.maxLat ||
    lng < SAUDI_BOUNDS.minLng ||
    lng > SAUDI_BOUNDS.maxLng
  ) {
    problems.push("city_centroid_outside_saudi_arabia");
  }

  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    value: { code, nameAr, nameEn, centroidLat: lat, centroidLng: lng },
  };
}
