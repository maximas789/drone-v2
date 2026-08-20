import {
  areaIntersectsGeometry,
  areaWithinGeometry,
} from "@/lib/airspace/geometry";
import type { Geometry } from "@/lib/geo";
import { validateGeometry } from "@/lib/geo/validate";
import type { HourWindow } from "./zone-hours";

/**
 * **Is this zone fit to publish?** Pure, so the screen can say so before
 * anybody presses the button and `publishZoneAction` can decide with the same
 * function.
 *
 * Publishing is the moment a drawing becomes airspace: from then on pilots see
 * it, slots derive from it, and the engine authorises flights against it. Every
 * check here is something that would be discovered *by a pilot* otherwise.
 */

export type PublishProblem =
  | "publish_geometry_invalid"
  | "publish_name_missing"
  | "publish_hours_missing"
  | "publish_capacity_invalid"
  | "publish_overlaps_no_fly";

export type PublishCandidate = {
  kind: string;
  nameAr: string;
  nameEn: string;
  capacity: number;
  geometry: Geometry;
};

export type PublishReadiness = {
  ok: boolean;
  problems: PublishProblem[];
  /** Codes of the no-fly zones this one overlaps. Shown, not merely counted. */
  overlappingNoFly: string[];
};

/**
 * `noFlyZones` is every **published** no-fly zone except this one. It is passed
 * in rather than read here so this file stays importable by the browser — the
 * same reason `evaluate.ts` takes a context instead of a database.
 */
export function publishReadiness(
  zone: PublishCandidate,
  hours: readonly HourWindow[],
  noFlyZones: readonly { code: string; geometry: Geometry }[],
): PublishReadiness {
  const problems: PublishProblem[] = [];

  const geometry = validateGeometry(zone.geometry);
  if (!geometry.ok) problems.push("publish_geometry_invalid");

  if (zone.nameAr.trim() === "" || zone.nameEn.trim() === "") {
    problems.push("publish_name_missing");
  }

  if (zone.capacity < 1) problems.push("publish_capacity_invalid");

  /**
   * **Hours are demanded of a permitted zone only.** A restricted or no-fly
   * zone is a rule that applies at all times; asking somebody to give opening
   * hours to a prohibition would be asking them to say when it stops applying.
   * A permitted zone without a window is the opposite — it is published, it is
   * visible, and it produces no slots at all, which reads to a pilot as a bug.
   */
  if (zone.kind === "permitted" && hours.length === 0) {
    problems.push("publish_hours_missing");
  }

  /**
   * **Threads 37 and 55.** A booking carries a zone, not a launch point, so
   * `createBookingAction` asks the engine about a zone id — and a no-fly zone
   * sitting inside a permitted one is invisible to that question. The *map*
   * refuses at the overlap because a tap always has a coordinate; the booking
   * path cannot. The seeded `RUH-P-01` and `RUH-NF-KKIA` touch in a ~50 m
   * sliver, so this is not hypothetical.
   *
   * Rather than let the two surfaces disagree, the overlap is refused **at
   * publish**: it is the one moment where somebody is looking at the boundary
   * and can move it. That is what keeps "the map is stricter than booking" from
   * ever becoming "booking authorised a flight over a no-fly zone".
   */
  const overlappingNoFly = geometry.ok
    ? noFlyZones
        .filter((other) => areaIntersectsGeometry(zone.geometry, other.geometry))
        .map((other) => other.code)
    : [];
  if (zone.kind === "permitted" && overlappingNoFly.length > 0) {
    problems.push("publish_overlaps_no_fly");
  }

  return { ok: problems.length === 0, problems, overlappingNoFly };
}

/**
 * Did the boundary **shrink or move**, rather than only grow?
 *
 * This is what decides whether a geometry edit on a published zone has to
 * disturb the bookings standing on it. If every point of the old polygon is
 * still inside the new one, nothing that was inside can have fallen outside,
 * and no booking needs a second look — extending a zone northwards is not a
 * reason to put somebody's authorised flight back in a queue.
 *
 * The moment that is *not* true, every future booking in the zone is affected,
 * because **a booking has no launch point** (threads 37 and 55) — it names a
 * zone, and "was this flight inside the part that was cut away" is a question
 * the row cannot answer. So the honest answer is the conservative one: all of
 * them, flagged for a human, rather than a confident subset computed from a
 * coordinate the app never collected.
 *
 * **Conservative where the boundaries touch.** `areaWithinGeometry` carries
 * F12's "touching denies" arithmetic, so a new boundary that reuses an edge of
 * the old one reads as shrinking. `updateZoneAction` compares the JSON first
 * and never asks about an unchanged polygon, so what this over-reports is an
 * edit that kept an edge — and sending those to a human is the direction that
 * cannot ground somebody by accident.
 */
export function geometryShrinks(before: Geometry, after: Geometry): boolean {
  // `areaWithinGeometry` is F12's "is this drawn area entirely inside the
  // zone" — the same question, asked of the old boundary against the new one.
  return !areaWithinGeometry(before, after);
}
