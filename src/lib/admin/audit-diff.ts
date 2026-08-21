import type { Geometry, LinearRing, Position } from "@/lib/geo";

/**
 * `before` / `after` → **a field-level diff**, not a JSON dump.
 *
 * The spec's requirement is one sentence — *"the diff is field-level, not raw
 * JSON"* — and the reason is that an administrator reading why a booking was
 * cancelled should not have to spot a changed character inside two pretty-printed
 * blobs. The interesting rows are the ones that differ, and everything else is
 * noise dressed as completeness.
 *
 * **Pure**, and free of `server-only`: the page computes the diff on the server
 * and the CSV export needs the identical rows, so the file a regulator
 * downloads says the same thing the screen did.
 *
 * `before` and `after` are `jsonb`, written by thirty-odd call sites with
 * thirty-odd shapes. Everything here reads them **defensively** — a row written
 * by a future action with a shape this build has never seen must render as a
 * best-effort row, never throw. The append-only table is precisely the place
 * that must not fail to render.
 */

export type DiffRow = {
  /** The raw JSON key. Translated at render through `audit.fields.*` if known. */
  field: string;
  /** `null` means the key was absent on that side — not that its value was null. */
  before: string | null;
  after: string | null;
};

/**
 * The key whose diff is a **map**, not a pair of strings.
 *
 * A polygon's coordinate list is the one value in this table where the textual
 * before/after is genuinely unreadable — two hundred numbers against two
 * hundred numbers — and also the one where the change matters most, because
 * moving a boundary can put an already-approved flight inside a no-fly area.
 * `diffFields` therefore drops it and `geometryDiff` picks it up.
 */
export const GEOMETRY_FIELD = "geometry";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * One JSON value as one line of text.
 *
 * **No `Intl` anywhere**, per rule 6: a number becomes its own digits and a
 * date is already an ISO string in the column. Nested objects and arrays are
 * compacted rather than pretty-printed — a diff row is a line, and a value that
 * needs more than a line is a value whose *shape* changed, which the reader can
 * see from the compact form.
 */
export function diffValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    /* A cycle cannot survive `jsonb`, but a `BigInt` reaches here and throws. */
    return String(value);
  }
}

/**
 * The rows that **differ**, in a stable order.
 *
 * Sorted by field name rather than by insertion order: `before` and `after`
 * were serialised by two different object literals in most call sites, so
 * insertion order is not a shared property of the two sides and would make the
 * same change render in a different order on two rows.
 */
export function diffFields(before: unknown, after: unknown): DiffRow[] {
  const b = asRecord(before);
  const a = asRecord(after);
  if (!b && !a) return [];

  const keys = [
    ...new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})]),
  ].sort();

  const rows: DiffRow[] = [];
  for (const field of keys) {
    if (field === GEOMETRY_FIELD) continue;

    const hasBefore = b ? field in b : false;
    const hasAfter = a ? field in a : false;
    const beforeText = hasBefore ? diffValue(b?.[field]) : null;
    const afterText = hasAfter ? diffValue(a?.[field]) : null;

    /**
     * Unchanged keys are dropped. An event's `after` often repeats context the
     * reader already has from the row above it — `zoneId`, `zoneCode` — and
     * listing every identical pair buries the one line that moved.
     */
    if (hasBefore && hasAfter && beforeText === afterText) continue;
    rows.push({ field, before: beforeText, after: afterText });
  }
  return rows;
}

/**
 * A **structural** read of a stored geometry — deliberately not
 * `validateGeometry`.
 *
 * That function decides whether a polygon may be *saved*: it refuses one
 * outside Saudi bounds, one below the minimum area, one with too many vertices.
 * Those are the right rules for an editor and the wrong ones for a log. This
 * geometry was written years ago under whatever rules applied then, and the
 * audit browser's job is to show what happened, not to re-litigate whether it
 * should have been allowed. A stricter reader here would render a blank map for
 * exactly the historical rows somebody is looking the change up to understand.
 */
export function geometryFrom(value: unknown): Geometry | null {
  const record = asRecord(value);
  if (!record) return null;
  const { type, coordinates } = record;
  if (!Array.isArray(coordinates)) return null;

  if (type === "Polygon") {
    const rings = ringsFrom(coordinates);
    return rings ? { type: "Polygon", coordinates: rings } : null;
  }
  if (type === "MultiPolygon") {
    const polygons: LinearRing[][] = [];
    for (const polygon of coordinates) {
      if (!Array.isArray(polygon)) return null;
      const rings = ringsFrom(polygon);
      if (!rings) return null;
      polygons.push(rings);
    }
    return polygons.length > 0
      ? { type: "MultiPolygon", coordinates: polygons }
      : null;
  }
  return null;
}

function ringsFrom(input: readonly unknown[]): LinearRing[] | null {
  const rings: LinearRing[] = [];
  for (const ring of input) {
    if (!Array.isArray(ring) || ring.length < 4) return null;
    const positions: Position[] = [];
    for (const position of ring) {
      if (
        !Array.isArray(position) ||
        position.length < 2 ||
        typeof position[0] !== "number" ||
        typeof position[1] !== "number" ||
        !Number.isFinite(position[0]) ||
        !Number.isFinite(position[1])
      ) {
        return null;
      }
      positions.push([position[0], position[1]]);
    }
    rings.push(positions);
  }
  return rings.length > 0 ? rings : null;
}

export type GeometryDiff = { before: Geometry; after: Geometry };

/**
 * The two polygons an overlay map draws, or `null` when this event is not a
 * boundary change.
 *
 * **Both sides are required.** A map showing only the new boundary is not a
 * diff — it is a picture of the zone, which the zone page already has — so an
 * event carrying one side renders as an ordinary field row instead. In practice
 * only `zone.geometry_changed` satisfies this; `updateZoneAction` writes the
 * whole polygon into both sides, which is the one sanctioned exception to the
 * rule that the audit table holds facts rather than payloads.
 */
export function geometryDiff(before: unknown, after: unknown): GeometryDiff | null {
  const b = geometryFrom(asRecord(before)?.[GEOMETRY_FIELD]);
  const a = geometryFrom(asRecord(after)?.[GEOMETRY_FIELD]);
  return b && a ? { before: b, after: a } : null;
}
