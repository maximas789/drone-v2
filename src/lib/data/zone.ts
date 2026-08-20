import "server-only";

import { and, asc, eq, gte, inArray, isNotNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { zone, zoneClosure, zoneHour } from "@/lib/db/schema";
import { isReviewer, type Session } from "@/lib/session";

/**
 * Zones are public information — anyone may see where they can fly, signed in
 * or not. What is *not* public is a draft or archived zone, which only a
 * reviewer sees. `session` stays the first argument regardless, so the
 * convention holds across the whole folder without exceptions to remember.
 */

export async function listActiveZones(_session: Session | null) {
  return db.query.zone.findMany({
    where: eq(zone.status, "active"),
    orderBy: [asc(zone.code)],
  });
}

/**
 * The map's viewport query. The bbox comparison is a **pre-filter only** — it
 * over-selects on purpose, and `src/lib/airspace/evaluate.ts` does the real
 * point-in-polygon work on the result.
 */
export async function listZonesInBbox(
  _session: Session | null,
  box: { minLat: number; maxLat: number; minLng: number; maxLng: number },
) {
  return db.query.zone.findMany({
    where: and(
      eq(zone.status, "active"),
      // Overlap, not containment: a zone larger than the viewport still counts.
      lte(zone.minLat, box.maxLat),
      gte(zone.maxLat, box.minLat),
      lte(zone.minLng, box.maxLng),
      gte(zone.maxLng, box.minLng),
    ),
    orderBy: [asc(zone.code)],
  });
}

export async function getZoneByCode(session: Session | null, code: string) {
  const row = await db.query.zone.findFirst({ where: eq(zone.code, code) });
  if (!row) return null;
  if (row.status !== "active" && !(session && isReviewer(session))) return null;
  return row;
}

export async function getZoneById(session: Session | null, id: string) {
  const row = await db.query.zone.findFirst({ where: eq(zone.id, id) });
  if (!row) return null;
  if (row.status !== "active" && !(session && isReviewer(session))) return null;
  return row;
}

/** Opening windows, ordered so a Friday's two windows read in time order. */
export async function getZoneHours(_session: Session | null, zoneId: string) {
  return db.query.zoneHour.findMany({
    where: eq(zoneHour.zoneId, zoneId),
    orderBy: [asc(zoneHour.weekday), asc(zoneHour.opensMinute)],
  });
}

/**
 * **Published** closures overlapping a window. Half-open: `[from, to)`.
 *
 * The `published_at` filter was added in F23c, when the closure editor made an
 * unpublished closure a row that actually exists. Before that this function had
 * no caller and returned every closure regardless — a trap waiting for the
 * first pilot-facing caller, because an unpublished closure is a draft nobody
 * has decided on and showing one on a public surface would announce a closure
 * that may never happen. `listClosuresForZones` below always filtered; the two
 * now agree.
 */
export async function listClosures(
  _session: Session | null,
  zoneId: string,
  from: Date,
  to: Date,
) {
  return db.query.zoneClosure.findMany({
    where: and(
      eq(zoneClosure.zoneId, zoneId),
      isNotNull(zoneClosure.publishedAt),
      lte(zoneClosure.startsAt, to),
      gte(zoneClosure.endsAt, from),
    ),
    orderBy: [asc(zoneClosure.startsAt)],
  });
}

/**
 * The **bbox pre-filter** behind every authorization decision (F12).
 *
 * ```sql
 * where min_lat <= :lat and max_lat >= :lat
 *   and min_lng <= :lng and max_lng >= :lng
 *   and status = 'active'
 * ```
 *
 * Rectangles only — this over-selects on purpose and says nothing about
 * containment. `src/lib/airspace/geometry.ts` decides that, in TypeScript, in
 * the one place that also runs in the browser. There is no PostGIS here and no
 * second point-in-polygon in SQL to drift from it.
 */
export async function listZonesContainingPoint(
  _session: Session | null,
  point: { lng: number; lat: number },
) {
  return db.query.zone.findMany({
    where: and(
      eq(zone.status, "active"),
      lte(zone.minLat, point.lat),
      gte(zone.maxLat, point.lat),
      lte(zone.minLng, point.lng),
      gte(zone.maxLng, point.lng),
    ),
    orderBy: [asc(zone.code)],
  });
}

/** Hours for a set of zones, in one query rather than one per zone. */
export async function listHoursForZones(
  _session: Session | null,
  zoneIds: readonly string[],
) {
  if (zoneIds.length === 0) return [];
  return db.query.zoneHour.findMany({
    where: inArray(zoneHour.zoneId, [...zoneIds]),
    orderBy: [asc(zoneHour.weekday), asc(zoneHour.opensMinute)],
  });
}

/**
 * Published closures for a set of zones overlapping `[from, to)`.
 *
 * **Published only.** A draft closure is a reviewer's working note, and
 * refusing a booking on the strength of one would be enforcing a rule nobody
 * has announced.
 */
export async function listClosuresForZones(
  _session: Session | null,
  zoneIds: readonly string[],
  from: Date,
  to: Date,
) {
  if (zoneIds.length === 0) return [];
  return db.query.zoneClosure.findMany({
    where: and(
      inArray(zoneClosure.zoneId, [...zoneIds]),
      isNotNull(zoneClosure.publishedAt),
      lte(zoneClosure.startsAt, to),
      gte(zoneClosure.endsAt, from),
    ),
    orderBy: [asc(zoneClosure.startsAt)],
  });
}

/** Every zone including drafts. Reviewers and admins only. */
export async function listAllZones(session: Session) {
  if (!isReviewer(session)) return [];
  return db.query.zone.findMany({
    where: or(
      eq(zone.status, "active"),
      eq(zone.status, "draft"),
      eq(zone.status, "suspended"),
      eq(zone.status, "archived"),
    ),
    orderBy: [asc(zone.code)],
  });
}
