/**
 * F23b probe — **the publish lifecycle against a real database.** Throwaway:
 * every row it writes, it deletes.
 *
 * These are claims about Postgres and about `applyTransition`'s third entity,
 * and no unit test can make them. `publishReadiness`, `validateZoneHours` and
 * `geometryShrinks` are pure and have their own suites; what this drives is the
 * half that only fails at runtime:
 *
 * - `apply.ts` locking a **zone** row with `select … for update` and writing its
 *   status — a code path that did not exist before this feature, over a table
 *   with no `ownerUserId` column to select.
 * - Publishing refused for a permitted zone with no operating window, and for
 *   one overlapping a **published** no-fly zone (threads 37 and 55).
 * - Archiving refused while a future booking stands, and allowed once it does
 *   not.
 * - `setZoneHours` replacing a week and auditing both sides of it.
 * - `flagBookingsForGeometryReview` sending an **approved** booking back to
 *   `pending` — keeping its seat — and writing the notification with it.
 *
 * Run with the react-server condition so `server-only` resolves to its no-op:
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx scripts/probe-zone-lifecycle.mts
 */
import { existsSync } from "node:fs";
import { and, eq, like } from "drizzle-orm";
import type { Geometry, Position } from "@/lib/geo";

if (existsSync(".env")) process.loadEnvFile(".env");

const { computeBbox } = await import("@/lib/geo/bbox");
const { db } = await import("@/lib/db");
const { user } = await import("@/lib/db/auth-schema");
const schema = await import("@/lib/db/schema");
const {
  archiveZone,
  flagBookingsForGeometryReview,
  publishZone,
  setZoneHours,
  suspendZone,
} = await import("@/lib/workflow/zone");

const {
  auditEvent,
  booking,
  city,
  drone,
  notification,
  remoteId,
  zone,
  zoneHour,
} = schema;

const PREFIX = "PROBE-F23B";
const ADMIN = { userId: "", role: "admin", isSystem: false };

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}`, detail ?? "");
  }
}

/** A counter-clockwise square in `[lng, lat]`, north-west of Riyadh. */
function square(minLng: number, minLat: number, size: number) {
  return {
    type: "Polygon" as const,
    coordinates: [
      [
        [minLng, minLat],
        [minLng + size, minLat],
        [minLng + size, minLat + size],
        [minLng, minLat + size],
        [minLng, minLat],
      ],
    ],
  } satisfies { type: "Polygon"; coordinates: Position[][] } as Geometry;
}

async function insertZone(
  code: string,
  kind: "permitted" | "no_fly",
  status: "draft" | "active",
  geometry: Geometry,
  cityId: string,
) {
  const [row] = await db
    .insert(zone)
    .values({
      code,
      cityId,
      kind,
      status,
      nameAr: `منطقة ${code}`,
      nameEn: `Zone ${code}`,
      geometry,
      vertexCount: 5,
      ...computeBbox(geometry),
      capacity: 4,
    })
    .returning({ id: zone.id });
  return row.id;
}

async function cleanup() {
  const zones = await db
    .select({ id: zone.id })
    .from(zone)
    .where(like(zone.code, `${PREFIX}%`));
  for (const row of zones) {
    await db.delete(booking).where(eq(booking.zoneId, row.id));
    await db.delete(zoneHour).where(eq(zoneHour.zoneId, row.id));
    await db.delete(auditEvent).where(eq(auditEvent.entityId, row.id));
    await db.delete(zone).where(eq(zone.id, row.id));
  }
}

async function main() {
  await cleanup();

  const [anyAdmin] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, "admin"))
    .limit(1);
  if (!anyAdmin) throw new Error("no admin account — sign up first");
  ADMIN.userId = anyAdmin.id;

  const [anyCity] = await db.select({ id: city.id }).from(city).limit(1);
  if (!anyCity) throw new Error("no city — run pnpm db:seed");

  console.log("\npublishing");

  const permittedGeometry = square(46.2, 24.9, 0.05);
  const permittedId = await insertZone(
    `${PREFIX}-P-1`,
    "permitted",
    "draft",
    permittedGeometry,
    anyCity.id,
  );

  const noHours = await db.transaction((tx) =>
    publishZone(tx, { zoneId: permittedId, actor: ADMIN }),
  );
  check(
    "a permitted zone with no window is refused",
    !noHours.ok && noHours.reason === "publish_hours_missing",
    noHours,
  );

  await db.transaction((tx) =>
    setZoneHours(tx, {
      zoneId: permittedId,
      actor: ADMIN,
      windows: [{ weekday: 0, opensMinute: 360, closesMinute: 720 }],
    }),
  );
  const hoursAudit = await db
    .select({ action: auditEvent.action })
    .from(auditEvent)
    .where(
      and(
        eq(auditEvent.entityId, permittedId),
        eq(auditEvent.action, "zone.hours_changed"),
      ),
    );
  check("setting the week writes one audit event", hoursAudit.length === 1);

  /**
   * A **published** no-fly zone laid across the permitted one. The booking path
   * cannot see this overlap, so publishing has to.
   */
  const noFlyId = await insertZone(
    `${PREFIX}-NF-1`,
    "no_fly",
    "active",
    square(46.22, 24.92, 0.05),
    anyCity.id,
  );

  const overlapping = await db.transaction((tx) =>
    publishZone(tx, { zoneId: permittedId, actor: ADMIN }),
  );
  check(
    "an overlap with a published no-fly zone refuses the publish",
    !overlapping.ok && overlapping.reason === "publish_overlaps_no_fly",
    overlapping,
  );
  check(
    "and the refusal names the zone in the way",
    !overlapping.ok &&
      overlapping.overlappingNoFly?.[0] === `${PREFIX}-NF-1`,
    overlapping,
  );

  /**
   * Take the prohibition away entirely — deleted, not demoted. Rule 11's ESLint
   * rule bans a `.set({ status: … })` outside `src/lib/workflow/`, and it is
   * right to: a probe that reached past the workflow to move a status would be
   * proving something about a state the app cannot itself produce.
   */
  await db.delete(auditEvent).where(eq(auditEvent.entityId, noFlyId));
  await db.delete(zone).where(eq(zone.id, noFlyId));

  const published = await db.transaction((tx) =>
    publishZone(tx, { zoneId: permittedId, actor: ADMIN }),
  );
  check("an unobstructed zone publishes", published.ok, published);

  const [afterPublish] = await db
    .select({ status: zone.status, publishedAt: zone.publishedAt })
    .from(zone)
    .where(eq(zone.id, permittedId));
  check("the row is active", afterPublish.status === "active");
  check("publishedAt is stamped", afterPublish.publishedAt !== null);

  const again = await db.transaction((tx) =>
    publishZone(tx, { zoneId: permittedId, actor: ADMIN }),
  );
  check(
    "publishing twice writes nothing the second time",
    !again.ok && again.reason === "already_applied",
    again,
  );

  console.log("\na reviewer drives none of it");

  const reviewerAttempt = await db.transaction((tx) =>
    suspendZone(tx, {
      zoneId: permittedId,
      actor: { userId: ADMIN.userId, role: "reviewer", isSystem: false },
      reasonAr: "سبب كافٍ الطول لتجاوز الحد الأدنى المطلوب.",
      reasonEn: "A reason long enough to clear the twenty-character floor.",
    }),
  );
  check(
    "a reviewer cannot suspend a zone",
    !reviewerAttempt.ok && reviewerAttempt.reason === "invalid_transition",
    reviewerAttempt,
  );

  console.log("\narchiving, and the booking that blocks it");

  const [aDrone] = await db
    .select({
      id: drone.id,
      ownerUserId: drone.ownerUserId,
      remoteIdId: remoteId.id,
    })
    .from(drone)
    .innerJoin(remoteId, eq(remoteId.droneId, drone.id))
    .limit(1);

// `drone.owner_user_id` is nullable since F28c (null = the owner deleted
// their account). A probe wants a real pilot, so this asserts rather than
// silently booking for nobody.
const pilotUserId = aDrone.ownerUserId;
if (!pilotUserId) throw new Error("probe: aDrone has no owner");

  let bookingId: string | null = null;
  if (aDrone) {
    const slotStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [row] = await db
      .insert(booking)
      .values({
        pilotUserId,
        droneId: aDrone.id,
        remoteIdId: aDrone.remoteIdId,
        zoneId: permittedId,
        slotStart,
        slotEnd: new Date(slotStart.getTime() + 60 * 60 * 1000),
        seatIndex: 0,
        status: "approved",
      })
      .returning({ id: booking.id });
    bookingId = row.id;

    const blocked = await db.transaction((tx) =>
      archiveZone(tx, { zoneId: permittedId, actor: ADMIN }),
    );
    check(
      "archiving is refused while a future booking stands",
      !blocked.ok && blocked.reason === "archive_has_bookings",
      blocked,
    );

    console.log("\na moved boundary flags, it does not cancel");

    const flag = await db.transaction((tx) =>
      flagBookingsForGeometryReview(tx, {
        zoneId: permittedId,
        actor: ADMIN,
        zoneNameAr: "منطقة الاختبار",
        zoneNameEn: "Probe zone",
      }),
    );
    check("one approved booking was flagged", flag.flagged === 1, flag);

    const [flagged] = await db
      .select({ status: booking.status, seatIndex: booking.seatIndex })
      .from(booking)
      .where(eq(booking.id, bookingId));
    check(
      "it went back to pending, not to cancelled",
      flagged.status === "pending",
      flagged,
    );
    check("and it kept its seat", flagged.seatIndex === 0);

    const notices = await db
      .select({ type: notification.type })
      .from(notification)
      .where(eq(notification.entityId, bookingId));
    check(
      "the pilot was told, with the right type",
      notices.some((row) => row.type === "bookingUnderReview"),
      notices,
    );

    const trail = await db
      .select({ action: auditEvent.action })
      .from(auditEvent)
      .where(eq(auditEvent.entityId, bookingId));
    check(
      "the trail says flagged, not cancelled",
      trail.some((row) => row.action === "booking.flagged_for_review") &&
        !trail.some((row) => row.action.startsWith("booking.cancelled")),
      trail,
    );

    await db.delete(notification).where(eq(notification.entityId, bookingId));
    await db.delete(auditEvent).where(eq(auditEvent.entityId, bookingId));
    await db.delete(booking).where(eq(booking.id, bookingId));
  } else {
    console.log("  skip  no approved drone with a Remote ID to book with");
  }

  const suspended = await db.transaction((tx) =>
    suspendZone(tx, {
      zoneId: permittedId,
      actor: ADMIN,
      reasonAr: "أعمال في المطار المجاور حتى إشعار آخر.",
      reasonEn: "Works at the adjacent airfield until further notice.",
    }),
  );
  check("an active zone suspends", suspended.ok, suspended);

  const shortReason = await db.transaction((tx) =>
    publishZone(tx, { zoneId: permittedId, actor: ADMIN }),
  );
  check("a suspended zone publishes again", shortReason.ok, shortReason);

  const archived = await db.transaction((tx) =>
    archiveZone(tx, { zoneId: permittedId, actor: ADMIN }),
  );
  check("with no bookings left, it archives", archived.ok, archived);

  console.log("\ncleaning up");
  await cleanup();
  const left = await db
    .select({ id: zone.id })
    .from(zone)
    .where(like(zone.code, `${PREFIX}%`));
  check("no probe row survives", left.length === 0, left);

  console.log(
    failures === 0
      ? "\nall green\n"
      : `\n${failures} failure(s)\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

await main();
