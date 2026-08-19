import "server-only";

import { and, asc, count, eq, gte, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { booking, city, zone } from "@/lib/db/schema";
import { isAdmin, type Session } from "@/lib/session";

/**
 * The **admin's** reads of the airspace itself.
 *
 * Separate from `data/zone.ts` on purpose. That file answers the *public*
 * question — which zones may a pilot see and book — and every function in it is
 * scoped to `status = 'active'`. These are scoped by **role**: an admin sees
 * drafts and archived rows too, which is a different question with a different
 * failure mode, and mixing them in one file makes "is this the published set?"
 * unanswerable by reading it.
 *
 * **`isAdmin`, not `isReviewer`.** Drawing airspace is not reviewing a
 * submission: a reviewer decides about what pilots send in, an admin decides
 * where anybody may fly at all. Every function here fails closed to an empty
 * list or `null`.
 */

export type ZoneListRow = {
  id: string;
  code: string;
  kind: string;
  status: string;
  nameAr: string;
  nameEn: string;
  cityNameAr: string | null;
  cityNameEn: string | null;
  capacity: number;
  vertexCount: number;
  geometryVersion: number;
  updatedAt: Date;
  /** Bookings still ahead of now — what a suspension or an edit would disturb. */
  futureBookings: number;
};

/**
 * Every zone, drafts included, **drafts first**.
 *
 * The list is a working surface rather than a catalogue: a draft is unfinished
 * work and belongs at the top, where an admin who drew half a zone yesterday
 * finds it. `status` sorts by the enum's own declared order —
 * `draft, active, suspended, archived` — which is close enough to "how much
 * attention does this want" to need no `case` expression that could drift from
 * the enum.
 *
 * The future-booking count is **one grouped query**, not one per row: it is the
 * number that decides whether a zone can be suspended or archived at all, and
 * an admin should see it before they open anything.
 */
export async function listZonesForAdmin(
  session: Session,
  now: Date = new Date(),
): Promise<ZoneListRow[]> {
  if (!isAdmin(session)) return [];

  const rows = await db
    .select({
      id: zone.id,
      code: zone.code,
      kind: zone.kind,
      status: zone.status,
      nameAr: zone.nameAr,
      nameEn: zone.nameEn,
      cityNameAr: city.nameAr,
      cityNameEn: city.nameEn,
      capacity: zone.capacity,
      vertexCount: zone.vertexCount,
      geometryVersion: zone.geometryVersion,
      updatedAt: zone.updatedAt,
    })
    .from(zone)
    .leftJoin(city, eq(city.id, zone.cityId))
    .orderBy(asc(zone.status), asc(zone.code));

  if (rows.length === 0) return [];

  const counts = await db
    .select({ zoneId: booking.zoneId, value: count() })
    .from(booking)
    .where(
      and(
        inArray(
          booking.zoneId,
          rows.map((row) => row.id),
        ),
        gte(booking.slotStart, now),
        inArray(booking.status, ["pending", "approved"]),
      ),
    )
    .groupBy(booking.zoneId);

  const byZone = new Map(counts.map((row) => [row.zoneId, row.value]));
  return rows.map((row) => ({ ...row, futureBookings: byZone.get(row.id) ?? 0 }));
}

/** One zone in any status, for the editor. `null` for anybody who is not an admin. */
export async function getZoneForAdmin(session: Session, id: string) {
  if (!isAdmin(session)) return null;
  const row = await db.query.zone.findFirst({ where: eq(zone.id, id) });
  return row ?? null;
}

/**
 * The zones to draw **behind** the one being edited.
 *
 * Active zones only, and never the zone being edited itself — it is already on
 * the canvas as the editable feature, and drawing it twice would make a vertex
 * look snappable to its own ghost. Draft zones are left out too: an admin
 * drawing against a boundary nobody has published yet would be aligning to
 * something that may never exist.
 */
export async function listZoneContext(
  session: Session,
  excludeZoneId?: string,
) {
  if (!isAdmin(session)) return [];
  const where = excludeZoneId
    ? and(eq(zone.status, "active"), ne(zone.id, excludeZoneId))
    : eq(zone.status, "active");

  return db
    .select({
      id: zone.id,
      code: zone.code,
      kind: zone.kind,
      nameAr: zone.nameAr,
      nameEn: zone.nameEn,
      // `ceilingAglM` is here only because `zonesToGeoJson` puts it in the
      // feature properties; the context layer never renders it.
      ceilingAglM: zone.ceilingAglM,
      geometry: zone.geometry,
    })
    .from(zone)
    .where(where);
}

/** Cities a zone can belong to. Admin-scoped copy of the public reader. */
export async function listCitiesForAdmin(session: Session) {
  if (!isAdmin(session)) return [];
  return db.query.city.findMany({ orderBy: [asc(city.nameAr)] });
}
