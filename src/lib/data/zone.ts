import "server-only";

import { and, asc, eq, gte, lte, or } from "drizzle-orm";
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

/** Closures overlapping a window. Half-open: `[from, to)`. */
export async function listClosures(
  _session: Session | null,
  zoneId: string,
  from: Date,
  to: Date,
) {
  return db.query.zoneClosure.findMany({
    where: and(
      eq(zoneClosure.zoneId, zoneId),
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
