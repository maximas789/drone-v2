import "server-only";

import { count, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  auditEvent,
  booking,
  drone,
  pilotProfile,
  remoteId,
  zone,
} from "@/lib/db/schema";
import { bookingStatus, droneStatus, zoneKind } from "@/lib/db/enums";

/**
 * Row counts — the cheap sanity check after a deploy or a seed.
 *
 * **Grouped counts are projected over the enum, not read from the rows.** A
 * `group by status` returns only the statuses that currently have rows, so a
 * fresh database would show four drone statuses instead of six and the two
 * missing ones would look like a rendering bug rather than a zero. Every
 * status the app can produce appears, with `0` where it means zero.
 *
 * `$count` and one grouped query per table, rather than one query per status:
 * six round trips to answer "how many drones are there" would make this panel
 * the slowest thing on the page.
 */

export type CountGroup = { key: string; value: number };

export type DataCounts = {
  pilots: number;
  remoteIds: number;
  auditEvents: number;
  drones: CountGroup[];
  bookings: CountGroup[];
  zones: CountGroup[];
};

async function groupedCounts(
  table: typeof drone | typeof booking | typeof zone,
  column: Parameters<typeof eq>[0],
  keys: readonly string[],
): Promise<CountGroup[]> {
  const rows = await db
    .select({ key: sql<string>`${column}`, value: count() })
    .from(table)
    .groupBy(sql`${column}`);

  const found = new Map(rows.map((row) => [String(row.key), row.value]));
  return keys.map((key) => ({ key, value: found.get(key) ?? 0 }));
}

export async function getDataCounts(): Promise<DataCounts> {
  const [pilots, remoteIds, auditEvents, drones, bookings, zones] =
    await Promise.all([
      db.$count(pilotProfile),
      db.$count(remoteId),
      db.$count(auditEvent),
      groupedCounts(drone, drone.status, droneStatus.enumValues),
      groupedCounts(booking, booking.status, bookingStatus.enumValues),
      groupedCounts(zone, zone.kind, zoneKind.enumValues),
    ]);

  return { pilots, remoteIds, auditEvents, drones, bookings, zones };
}
