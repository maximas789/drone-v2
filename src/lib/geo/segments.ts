import type { Position } from "./index";

/**
 * Segment arithmetic — **one implementation, two callers.**
 *
 * It was written in `src/lib/airspace/geometry.ts` for F12's no-fly overlap
 * test, and F23 needs exactly the same three functions to ask whether a polygon
 * crosses *itself*. Importing the airspace module from here would invert the
 * layering — `airspace/geometry.ts` already imports `computeBbox` from this
 * folder, so the pair would be a cycle — and writing a second orientation test
 * would be worse: the day one of them changes its treatment of collinear
 * points, "touching denies" and "this polygon is valid" stop agreeing about
 * what an intersection is.
 *
 * So the arithmetic lives here, in the layer both sides already depend on, and
 * `airspace/geometry.ts` re-exports `segmentsIntersect` under its old name for
 * its own callers.
 *
 * Pure, planar, and deliberately not spherical: over a city-sized polygon the
 * difference is far below the precision anybody draws with.
 */

/**
 * The sign of the cross product — which way you turn going `p → q → r`.
 *
 * `0` is collinear, `1` clockwise, `2` counter-clockwise. Kept as the same
 * three-valued encoding F12 used, because the intersection test below reads it
 * as an equality rather than as a direction.
 */
export function orientation(p: Position, q: Position, r: Position): 0 | 1 | 2 {
  const value =
    (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  if (value === 0) return 0;
  return value > 0 ? 1 : 2;
}

/** Whether `p` lies on segment `a–b`, given the three are already collinear. */
export function onSegment(a: Position, b: Position, p: Position): boolean {
  return (
    Math.min(a[0], b[0]) <= p[0] &&
    p[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= p[1] &&
    p[1] <= Math.max(a[1], b[1])
  );
}

/**
 * Proper or touching intersection of two segments.
 *
 * **Touching counts.** F12 needs that — an area whose edge runs along a no-fly
 * boundary is intersecting it, and touching denies. F23's self-intersection
 * check has to subtract the cases where touching is *expected* (consecutive
 * edges share a vertex, and a ring's first and last edges share two), which it
 * does by skipping those pairs rather than by weakening this.
 */
export function segmentsIntersect(
  a1: Position,
  a2: Position,
  b1: Position,
  b2: Position,
): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if (o1 !== o2 && o3 !== o4) return true;

  if (o1 === 0 && onSegment(a1, a2, b1)) return true;
  if (o2 === 0 && onSegment(a1, a2, b2)) return true;
  if (o3 === 0 && onSegment(b1, b2, a1)) return true;
  if (o4 === 0 && onSegment(b1, b2, a2)) return true;

  return false;
}
