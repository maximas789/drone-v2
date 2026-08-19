import { approximateAreaSqM } from "./area";
import { computeBbox, countVertices, SAUDI_BOUNDS } from "./bbox";
import type { BoundingBox, Geometry, LinearRing, Position } from "./index";
import { segmentsIntersect } from "./segments";
import { ensureWinding } from "./winding";

/**
 * Is this polygon fit to be airspace? — **the server's rule, not the client's
 * guidance.**
 *
 * The drawing tool checks as you draw, which is a courtesy; this is the check
 * that decides, and it runs inside the action over whatever JSON actually
 * arrived. A drawn zone is a claim about where aircraft may fly, and the two
 * halves are not the same code by accident: everything here is **pure**, so the
 * editor can call it for live feedback and the action can call it as the
 * authority without either being a second implementation.
 *
 * **Refusals are codes, never exceptions** (rule 10). `bbox.ts` throws for the
 * seed's benefit — a bad row there should stop the script — but a person
 * drawing a polygon gets a list of problems their screen can translate.
 *
 * Two problems are **repaired rather than refused**, because both are artefacts
 * of how drawing tools emit geometry rather than mistakes about where the
 * airspace is:
 *
 * - an **unclosed ring**, which most editors leave to the serialiser;
 * - **winding**, which almost nothing gets right unprompted.
 *
 * Both come back as warnings, so the screen says what it changed. A silent
 * repair would leave somebody believing they drew a hole when they drew an
 * island.
 */

/** Every way a drawn geometry can be wrong, as a code the catalogue renders. */
export type GeometryProblemCode =
  | "not_an_object"
  | "unsupported_type"
  | "no_rings"
  | "ring_too_short"
  | "position_not_a_pair"
  | "position_not_finite"
  | "self_intersecting"
  | "too_many_vertices"
  | "outside_saudi_arabia"
  | "area_too_small"
  /** Warnings — repaired, and said out loud. */
  | "ring_auto_closed"
  | "winding_corrected";

export type GeometryProblem = {
  code: GeometryProblemCode;
  /** Pre-formatting is the caller's job; these are numbers, not sentences. */
  params?: Record<string, number>;
};

export type GeometryCheck =
  | {
      ok: true;
      /** Closed, wound correctly, and safe to store. */
      geometry: Geometry;
      bbox: BoundingBox;
      vertexCount: number;
      areaSqM: number;
      warnings: GeometryProblem[];
    }
  | { ok: false; problems: GeometryProblem[] };

/**
 * **The vertex cap.** Five thousand positions across every ring.
 *
 * Two reasons, and the second is the serious one. A polygon in `jsonb` is
 * unbounded unless something bounds it, so this is a denial-of-service floor;
 * and every containment test is O(vertices), run per zone per map tap and again
 * inside the booking transaction. A traced coastline would make the airspace
 * engine crawl for a boundary nobody drew deliberately.
 */
export const MAX_VERTICES = 5_000;

/**
 * **The area floor.** 0.01 km² — a square a hundred metres on a side.
 *
 * Below this it is a mis-click, not airspace: two taps close together produce a
 * sliver, and a sliver zone is one a pilot can never actually be inside.
 */
export const MIN_AREA_SQM = 10_000;

function ringsOf(geometry: Geometry): readonly LinearRing[] {
  return geometry.type === "Polygon"
    ? geometry.coordinates
    : geometry.coordinates.flat();
}

/**
 * Does any pair of a ring's own edges cross?
 *
 * A self-intersecting ring makes ray casting meaningless — the crossing count
 * stops corresponding to "inside", so `pointInRing` answers confidently and
 * wrongly, and it is the answer a flight is authorised against. This is the one
 * check with no repair: nobody can guess which of the two loops the person
 * meant.
 *
 * **Adjacent edges are skipped, and so is the first-against-last pair.**
 * Consecutive edges share a vertex by construction, and `segmentsIntersect`
 * counts touching as intersecting — deliberately, because F12 needs an area
 * grazing a no-fly boundary to be refused. Subtracting the expected touches
 * here rather than weakening that predicate keeps both callers honest.
 *
 * O(n²) over a ring, which is why `MAX_VERTICES` is checked **first**.
 */
export function ringSelfIntersects(ring: LinearRing): boolean {
  const edges = ring.length - 1;
  for (let i = 0; i < edges; i++) {
    for (let j = i + 2; j < edges; j++) {
      // The last edge ends where the first begins: also an expected touch.
      if (i === 0 && j === edges - 1) continue;
      if (
        segmentsIntersect(ring[i], ring[i + 1], ring[j], ring[j + 1])
      ) {
        return true;
      }
    }
  }
  return false;
}

/** A ring with its first position repeated at the end, if it was not already. */
function closeRing(ring: LinearRing): { ring: LinearRing; closed: boolean } {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return { ring, closed: false };
  }
  return { ring: [...ring, first], closed: true };
}

/**
 * Narrow arbitrary JSON to a `Geometry`, or say what is wrong with it.
 *
 * Hand-written rather than schema-generated, like the rest of
 * `src/lib/validation/` — the project carries no schema library, and the
 * failure modes worth naming here (`position_not_a_pair`,
 * `position_not_finite`) are more specific than a generic parser's anyway.
 */
function parseGeometry(
  input: unknown,
  problems: GeometryProblem[],
): { type: Geometry["type"]; polygons: LinearRing[][] } | null {
  if (typeof input !== "object" || input === null) {
    problems.push({ code: "not_an_object" });
    return null;
  }

  const candidate = input as { type?: unknown; coordinates?: unknown };
  const type = candidate.type;
  if (type !== "Polygon" && type !== "MultiPolygon") {
    problems.push({ code: "unsupported_type" });
    return null;
  }
  if (!Array.isArray(candidate.coordinates)) {
    problems.push({ code: "no_rings" });
    return null;
  }

  const rawPolygons: unknown[] =
    type === "Polygon" ? [candidate.coordinates] : candidate.coordinates;
  if (rawPolygons.length === 0) {
    problems.push({ code: "no_rings" });
    return null;
  }

  const polygons: LinearRing[][] = [];
  for (const rawPolygon of rawPolygons) {
    if (!Array.isArray(rawPolygon) || rawPolygon.length === 0) {
      problems.push({ code: "no_rings" });
      return null;
    }
    const rings: LinearRing[] = [];
    for (const rawRing of rawPolygon) {
      if (!Array.isArray(rawRing)) {
        problems.push({ code: "no_rings" });
        return null;
      }
      const ring: Position[] = [];
      for (const rawPosition of rawRing) {
        if (!Array.isArray(rawPosition) || rawPosition.length < 2) {
          problems.push({ code: "position_not_a_pair" });
          return null;
        }
        const [lng, lat] = rawPosition as unknown[];
        if (
          typeof lng !== "number" ||
          typeof lat !== "number" ||
          !Number.isFinite(lng) ||
          !Number.isFinite(lat)
        ) {
          problems.push({ code: "position_not_finite" });
          return null;
        }
        // A third element is elevation in GeoJSON. Dropped: this app is
        // two-dimensional, and carrying a value nothing reads would invite
        // somebody to believe a ceiling was stored in the polygon.
        ring.push([lng, lat]);
      }
      rings.push(ring);
    }
    polygons.push(rings);
  }

  return { type, polygons };
}

/**
 * The whole check, in the order that keeps it cheap and its messages useful.
 *
 * Structure first — there is nothing to say about a ring that is not a list of
 * pairs. Then the **vertex cap**, before any O(n²) work. Then the repairs, then
 * the geometric refusals, then the bounds and the area, which need a geometry
 * that is already closed.
 */
export function validateGeometry(input: unknown): GeometryCheck {
  const problems: GeometryProblem[] = [];
  const warnings: GeometryProblem[] = [];

  const parsed = parseGeometry(input, problems);
  if (!parsed) return { ok: false, problems };

  const total = parsed.polygons
    .flat()
    .reduce((sum, ring) => sum + ring.length, 0);
  if (total > MAX_VERTICES) {
    // Returned alone: every later check is O(n) or worse over exactly the
    // positions this one has just declared too numerous to trust.
    return {
      ok: false,
      problems: [
        { code: "too_many_vertices", params: { count: total, max: MAX_VERTICES } },
      ],
    };
  }

  const closedPolygons: LinearRing[][] = [];
  let autoClosed = false;
  for (const rings of parsed.polygons) {
    const closedRings: LinearRing[] = [];
    for (const ring of rings) {
      // Three distinct positions plus the repeat is the smallest real ring.
      if (ring.length < 3) {
        problems.push({ code: "ring_too_short" });
        continue;
      }
      const { ring: closed, closed: wasOpen } = closeRing(ring);
      if (wasOpen) autoClosed = true;
      if (closed.length < 4) {
        problems.push({ code: "ring_too_short" });
        continue;
      }
      closedRings.push(closed);
    }
    if (closedRings.length > 0) closedPolygons.push(closedRings);
  }
  if (problems.length > 0) return { ok: false, problems };
  if (closedPolygons.length === 0) {
    return { ok: false, problems: [{ code: "no_rings" }] };
  }
  if (autoClosed) warnings.push({ code: "ring_auto_closed" });

  const closedGeometry: Geometry =
    parsed.type === "Polygon"
      ? { type: "Polygon", coordinates: closedPolygons[0] }
      : { type: "MultiPolygon", coordinates: closedPolygons };

  for (const ring of ringsOf(closedGeometry)) {
    if (ringSelfIntersects(ring)) {
      problems.push({ code: "self_intersecting" });
      break;
    }
  }

  for (const ring of ringsOf(closedGeometry)) {
    for (const [lng, lat] of ring) {
      if (
        lat < SAUDI_BOUNDS.minLat ||
        lat > SAUDI_BOUNDS.maxLat ||
        lng < SAUDI_BOUNDS.minLng ||
        lng > SAUDI_BOUNDS.maxLng
      ) {
        problems.push({ code: "outside_saudi_arabia" });
        break;
      }
    }
    if (problems.some((problem) => problem.code === "outside_saudi_arabia")) {
      break;
    }
  }

  const areaSqM = approximateAreaSqM(closedGeometry);
  if (areaSqM < MIN_AREA_SQM) {
    problems.push({
      code: "area_too_small",
      params: { areaSqM: Math.round(areaSqM), minSqM: MIN_AREA_SQM },
    });
  }

  if (problems.length > 0) return { ok: false, problems };

  /**
   * Winding last, so a geometry that is about to be refused is not quietly
   * rewritten on the way out. `ensureWinding` returns the same object when
   * nothing changed, which is how the warning is decided.
   */
  const wound = ensureWinding(closedGeometry);
  if (wound !== closedGeometry) warnings.push({ code: "winding_corrected" });

  return {
    ok: true,
    geometry: wound,
    // **Computed here, never taken from the client.** A caller that posts its
    // own bbox is posting a claim about which map viewports will find the zone.
    bbox: computeBbox(wound),
    vertexCount: countVertices(wound),
    areaSqM,
    warnings,
  };
}
