import "server-only";

import {
  countMyBookingsInWindow,
  listMyBookedSlotStarts,
  listSlotUsage,
} from "@/lib/data/booking";
import { getDroneById, getRemoteIdForDrone } from "@/lib/data/drone";
import { getMyProfile } from "@/lib/data/pilot";
import { listDeclarations } from "@/lib/data/remote-id";
import {
  getZoneById,
  listClosuresForZones,
  listHoursForZones,
  listZonesContainingPoint,
  listZonesInBbox,
} from "@/lib/data/zone";
import type { Geometry, Position } from "@/lib/geo";
import type { Session } from "@/lib/session";
import { riyadhDayBounds, riyadhYmd } from "./time";
import type {
  AircraftContext,
  AirspaceContext,
  BuildTypeValue,
  DeclarationWindow,
  PilotContext,
  WeightClassValue,
  ZoneClosureWindow,
  ZoneRule,
  ZoneWindow,
} from "./types";

/**
 * **The db-facing edge of the airspace engine, and the only one.**
 *
 * `evaluate.ts` may not import a database, a session or a request — it runs in
 * the browser map as well as on the server. Everything it needs is assembled
 * here and passed in as plain data, which is also why the map can fetch the
 * identical structure as JSON and reach the identical answer.
 *
 * No SQL lives in this file either: every read goes through `src/lib/data/*`,
 * session first, so ownership stays answerable by reading that one folder.
 */

/** How far a `Date` column travels: as an ISO string, never as a `Date`. */
function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

type ZoneRow = Awaited<ReturnType<typeof getZoneById>>;
type HourRow = { zoneId: string; weekday: number; opensMinute: number; closesMinute: number };
type ClosureRow = {
  zoneId: string;
  startsAt: Date;
  endsAt: Date;
  reasonAr: string;
  reasonEn: string;
};

/**
 * One `zone` row plus its two child tables, flattened into the shape the engine
 * and the map both consume. Exported because `/api/zones/geojson` serves
 * exactly this — the map does not get a different, thinner zone that then
 * evaluates differently.
 */
export function toZoneRule(
  row: NonNullable<ZoneRow>,
  hours: readonly HourRow[],
  closures: readonly ClosureRow[],
): ZoneRule {
  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    status: row.status,
    nameAr: row.nameAr,
    nameEn: row.nameEn,

    geometry: row.geometry as Geometry,
    geometryVersion: row.geometryVersion,
    bbox: {
      minLat: row.minLat,
      maxLat: row.maxLat,
      minLng: row.minLng,
      maxLng: row.maxLng,
    },

    ceilingAglM: row.ceilingAglM,
    floorAglM: row.floorAglM,

    capacity: row.capacity,
    slotDurationMinutes: row.slotDurationMinutes,
    minLeadMinutes: row.minLeadMinutes,
    maxAdvanceDays: row.maxAdvanceDays,
    maxSlotsPerPilotPerDay: row.maxSlotsPerPilotPerDay,
    autoApprove: row.autoApprove,
    nightAllowed: row.nightAllowed,

    maxWeightClass: row.maxWeightClass,
    permittedBuildTypes: row.permittedBuildTypes,
    requiresBroadcastRid: row.requiresBroadcastRid,

    hours: hours
      .filter((hour) => hour.zoneId === row.id)
      .map(
        (hour): ZoneWindow => ({
          weekday: hour.weekday as ZoneWindow["weekday"],
          opensMinute: hour.opensMinute,
          closesMinute: hour.closesMinute,
        }),
      ),
    closures: closures
      .filter((closure) => closure.zoneId === row.id)
      .map(
        (closure): ZoneClosureWindow => ({
          startsAt: closure.startsAt.toISOString(),
          endsAt: closure.endsAt.toISOString(),
          reasonAr: closure.reasonAr,
          reasonEn: closure.reasonEn,
        }),
      ),
  };
}

async function hydrate(
  session: Session | null,
  rows: NonNullable<ZoneRow>[],
  from: Date,
  to: Date,
): Promise<ZoneRule[]> {
  const ids = rows.map((row) => row.id);
  const [hours, closures] = await Promise.all([
    listHoursForZones(session, ids),
    listClosuresForZones(session, ids, from, to),
  ]);
  return rows.map((row) => toZoneRule(row, hours, closures));
}

/** Zones whose bbox contains the point, hydrated with hours and closures. */
export async function zonesForPoint(
  session: Session | null,
  point: Position,
  window: { from: Date; to: Date },
): Promise<ZoneRule[]> {
  const [lng, lat] = point;
  const rows = await listZonesContainingPoint(session, { lng, lat });
  return hydrate(session, rows, window.from, window.to);
}

/** The map's viewport fetch. Overlap, not containment — a zone larger than the screen still counts. */
export async function zonesForViewport(
  session: Session | null,
  box: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  window: { from: Date; to: Date },
): Promise<ZoneRule[]> {
  const rows = await listZonesInBbox(session, box);
  return hydrate(session, rows, window.from, window.to);
}

export async function zoneRuleById(
  session: Session | null,
  zoneId: string,
  window: { from: Date; to: Date },
): Promise<ZoneRule | null> {
  const row = await getZoneById(session, zoneId);
  if (!row) return null;
  const [rule] = await hydrate(session, [row], window.from, window.to);
  return rule ?? null;
}

/**
 * The aircraft's facts, **including the declaration rows rather than the
 * `broadcastCapable` boolean**. That flag is a write-time snapshot with nothing
 * sweeping it; a booking asks about a future instant and only the rows can
 * answer that. See `broadcastCapableAt` in `evaluate.ts`.
 *
 * Returns `null` when the drone is not this session's to see — which reads to
 * the engine exactly like "no aircraft selected", and tells a prober nothing.
 */
export async function aircraftContextFor(
  session: Session,
  droneId: string,
): Promise<AircraftContext | null> {
  const drone = await getDroneById(session, droneId);
  if (!drone) return null;

  const remoteId = await getRemoteIdForDrone(session, droneId);
  const declarations = remoteId
    ? await listDeclarations(session, remoteId.id)
    : [];

  return {
    droneId: drone.id,
    status: drone.status,
    buildType: drone.buildType as BuildTypeValue,
    weightClass: drone.weightClass as WeightClassValue,
    registrationExpiresAt: iso(drone.registrationExpiresAt),
    remoteIdStatus: remoteId?.status ?? null,
    declarations: declarations.map(
      (row): DeclarationWindow => ({
        verifiedAt: iso(row.verifiedAt),
        rejectedAt: iso(row.rejectedAt),
        supersededAt: iso(row.supersededAt),
        validFrom: iso(row.validFrom),
        validUntil: iso(row.validUntil),
      }),
    ),
  };
}

/** Identity is verified by a **human reviewer**. There is no automatic path to it. */
export async function pilotContextFor(session: Session): Promise<PilotContext> {
  const profile = await getMyProfile(session);
  return {
    profileComplete: Boolean(profile?.completedAt),
    identityVerified: Boolean(profile?.verifiedAt),
  };
}

export type PointContextInput = {
  point: Position;
  droneId?: string | null;
  slotStart?: Date | null;
  slotEnd?: Date | null;
};

/**
 * Everything needed to answer one point-and-time question.
 *
 * The availability, busy-slot and daily-count reads only happen when a slot was
 * actually asked about — a map click that names no time should cost one zone
 * query, not four.
 */
export async function buildPointContext(
  session: Session | null,
  { point, droneId, slotStart, slotEnd }: PointContextInput,
): Promise<AirspaceContext> {
  const reference = slotStart ?? new Date();
  const { start: dayStart, end: dayEnd } = riyadhDayBounds(riyadhYmd(reference));
  const window = {
    from: slotStart ?? dayStart,
    to: slotEnd ?? dayEnd,
  };

  const zones = await zonesForPoint(session, point, {
    from: window.from,
    // Closures are wanted for the whole day, so the picker can grey the
    // neighbouring slots rather than only the one asked about.
    to: dayEnd > window.to ? dayEnd : window.to,
  });

  if (!session) return { zones };

  const [pilot, aircraft] = await Promise.all([
    pilotContextFor(session),
    droneId ? aircraftContextFor(session, droneId) : Promise.resolve(null),
  ]);

  if (!slotStart) return { zones, pilot, aircraft };

  const matched = zones.find((zone) => zone.kind === "permitted");
  const [availability, pilotBusySlots, pilotBookingsOnDay] = await Promise.all([
    matched
      ? listSlotUsage(session, matched.id, dayStart, dayEnd)
      : Promise.resolve([]),
    listMyBookedSlotStarts(session, dayStart, dayEnd),
    countMyBookingsInWindow(session, dayStart, dayEnd),
  ]);

  return {
    zones,
    pilot,
    aircraft,
    availability,
    pilotBusySlots,
    pilotBookingsOnDay,
  };
}

/**
 * The day view: one zone, one Riyadh civil day, everything the slot grid needs.
 *
 * **Riyadh midnight to Riyadh midnight**, not UTC midnight — a 06:00 slot is
 * 03:00Z, and grouping by the UTC day would move every evening slot into the
 * next day's picker.
 */
export async function buildDayContext(
  session: Session,
  zoneId: string,
  ymd: string,
  droneId?: string | null,
): Promise<{ zone: ZoneRule | null; context: AirspaceContext }> {
  const { start, end } = riyadhDayBounds(ymd);
  const zone = await zoneRuleById(session, zoneId, { from: start, to: end });
  if (!zone) return { zone: null, context: { zones: [] } };

  const [pilot, aircraft, availability, pilotBusySlots, pilotBookingsOnDay] =
    await Promise.all([
      pilotContextFor(session),
      droneId ? aircraftContextFor(session, droneId) : Promise.resolve(null),
      listSlotUsage(session, zone.id, start, end),
      listMyBookedSlotStarts(session, start, end),
      countMyBookingsInWindow(session, start, end),
    ]);

  return {
    zone,
    context: {
      zones: [zone],
      pilot,
      aircraft,
      availability,
      pilotBusySlots,
      pilotBookingsOnDay,
    },
  };
}
