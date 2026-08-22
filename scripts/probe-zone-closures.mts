/**
 * F23c probe — **closures and cities against a real database.** Throwaway:
 * every row it writes, it deletes.
 *
 * `validateClosure` and `validateCity` are pure and have their own suites. What
 * this drives is the half that only fails at runtime:
 *
 * - `createZoneClosure` refusing a zone that is not `active` or `suspended` —
 *   a closure over a draft refuses nothing, and a row that can never refuse
 *   anything is worse than no row.
 * - `publishZoneClosure` stamping `published_at` exactly once, and answering
 *   `already_applied` the second time. A double-published closure would send a
 *   second fan-out and cancel — and email — twice.
 * - `withdrawZoneClosure` deleting an unpublished closure **after** writing its
 *   audit event, and refusing a published one.
 * - The cancellation preview matching what the fan-out actually reads: the
 *   admin query and `listBookingsOverlapping` are two functions, and the whole
 *   point of the preview is that they agree. This asserts they return the same
 *   booking ids over the same window, including the half-open edges.
 * - The engine reading a published closure and ignoring an unpublished one.
 * - `city` insert + audit, and the unique code.
 *
 * Run with the react-server condition so `server-only` resolves to its no-op:
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx scripts/probe-zone-closures.mts
 */
import { existsSync } from "node:fs";
import { and, eq, like } from "drizzle-orm";
import type { Geometry, Position } from "@/lib/geo";

if (existsSync(".env")) process.loadEnvFile(".env");

const { computeBbox } = await import("@/lib/geo/bbox");
const { db } = await import("@/lib/db");
const { user } = await import("@/lib/db/auth-schema");
const schema = await import("@/lib/db/schema");
const { createZoneClosure, publishZoneClosure, withdrawZoneClosure } =
  await import("@/lib/workflow/zone");
const { listBookingsOverlapping } = await import("@/lib/inngest/queries");
const { listBookingsInClosureWindow, listZoneClosures } = await import(
  "@/lib/data/zone-admin"
);
const { listClosures } = await import("@/lib/data/zone");

const {
  auditEvent,
  booking,
  city,
  drone,
  remoteId,
  zone,
  zoneClosure,
} = schema;

const PREFIX = "PROBE-F23C";
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

const REASON_AR = "إغلاق مؤقت لأغراض الاختبار في هذه المنطقة";
const REASON_EN = "Temporary closure for probe purposes in this zone";

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
  status: "draft" | "active",
  cityId: string,
) {
  const geometry = square(46.3, 24.95, 0.05);
  const [row] = await db
    .insert(zone)
    .values({
      code,
      cityId,
      kind: "permitted",
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
    const closures = await db
      .select({ id: zoneClosure.id })
      .from(zoneClosure)
      .where(eq(zoneClosure.zoneId, row.id));
    for (const closure of closures) {
      await db.delete(auditEvent).where(eq(auditEvent.entityId, closure.id));
    }
    await db.delete(zoneClosure).where(eq(zoneClosure.zoneId, row.id));
    const bookings = await db
      .select({ id: booking.id })
      .from(booking)
      .where(eq(booking.zoneId, row.id));
    for (const one of bookings) {
      await db.delete(auditEvent).where(eq(auditEvent.entityId, one.id));
    }
    await db.delete(booking).where(eq(booking.zoneId, row.id));
    await db.delete(auditEvent).where(eq(auditEvent.entityId, row.id));
    await db.delete(zone).where(eq(zone.id, row.id));
  }

  const cities = await db
    .select({ id: city.id })
    .from(city)
    .where(like(city.code, "ZZ%"));
  for (const row of cities) {
    await db.delete(auditEvent).where(eq(auditEvent.entityId, row.id));
    await db.delete(city).where(eq(city.id, row.id));
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
  const session = {
    user: { id: anyAdmin.id, role: "admin" },
  } as unknown as Parameters<typeof listZoneClosures>[0];

  const [anyCity] = await db.select({ id: city.id }).from(city).limit(1);
  if (!anyCity) throw new Error("no city — run pnpm db:seed");

  console.log("\na closure needs airspace somebody could fly in");

  const draftZoneId = await insertZone(`${PREFIX}-DRAFT`, "draft", anyCity.id);
  const window = {
    startsAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    endsAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
  };

  const overDraft = await db.transaction((tx) =>
    createZoneClosure(tx, {
      zoneId: draftZoneId,
      actor: ADMIN,
      ...window,
      reasonAr: REASON_AR,
      reasonEn: REASON_EN,
      authorityRef: null,
    }),
  );
  check(
    "a closure over a draft zone is refused",
    !overDraft.ok && overDraft.reason === "zone_not_publishable",
    overDraft,
  );

  const zoneId = await insertZone(`${PREFIX}-P-1`, "active", anyCity.id);

  console.log("\nthe preview is the fan-out's own query");

  /**
   * Three bookings around the window: one inside it, one ending exactly when it
   * begins, and one beginning exactly when it ends. The half-open rule means
   * only the first is caught — and if the preview and the fan-out ever disagree
   * about that, an admin confirms against a list of one and three people lose
   * their flights.
   */
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

  let insideId: string | null = null;
  if (!aDrone) {
    console.log("  --   no drone with a Remote ID; the overlap checks are skipped");
  } else {
    const hour = 60 * 60 * 1000;
    const rows = await db
      .insert(booking)
      .values([
        {
          pilotUserId,
          droneId: aDrone.id,
          remoteIdId: aDrone.remoteIdId,
          zoneId,
          slotStart: new Date(window.startsAt.getTime() + hour),
          slotEnd: new Date(window.startsAt.getTime() + 2 * hour),
          seatIndex: 0,
          status: "approved",
        },
        {
          pilotUserId,
          droneId: aDrone.id,
          remoteIdId: aDrone.remoteIdId,
          zoneId,
          slotStart: new Date(window.startsAt.getTime() - hour),
          slotEnd: window.startsAt,
          seatIndex: 1,
          status: "approved",
        },
        {
          pilotUserId,
          droneId: aDrone.id,
          remoteIdId: aDrone.remoteIdId,
          zoneId,
          slotStart: window.endsAt,
          slotEnd: new Date(window.endsAt.getTime() + hour),
          seatIndex: 2,
          status: "pending",
        },
      ])
      .returning({ id: booking.id });
    insideId = rows[0].id;

    const preview = await listBookingsInClosureWindow(
      session,
      zoneId,
      window.startsAt,
      window.endsAt,
    );
    check(
      "the preview catches only the overlapping booking",
      preview.length === 1 && preview[0].bookingId === insideId,
      preview.map((row) => row.bookingId),
    );
    check(
      "and it names the pilot rather than counting",
      preview[0]?.pilotName?.length > 0,
      preview[0],
    );

    const fanOut = await listBookingsOverlapping(
      zoneId,
      window.startsAt,
      window.endsAt,
    );
    check(
      "the fan-out's own query returns exactly the same rows",
      JSON.stringify(fanOut.map((row) => row.bookingId).sort()) ===
        JSON.stringify(preview.map((row) => row.bookingId).sort()),
      { fanOut: fanOut.map((row) => row.bookingId), preview: preview.map((row) => row.bookingId) },
    );
  }

  console.log("\ndrafting, publishing, and publishing twice");

  const created = await db.transaction((tx) =>
    createZoneClosure(tx, {
      zoneId,
      actor: ADMIN,
      ...window,
      reasonAr: REASON_AR,
      reasonEn: REASON_EN,
      authorityRef: "PROBE/2026/01",
    }),
  );
  check("a closure is created", created.ok, created);
  if (!created.ok) throw new Error("cannot continue without a closure");
  const closureId = created.data.closureId;

  const [fresh] = await db
    .select({ publishedAt: zoneClosure.publishedAt })
    .from(zoneClosure)
    .where(eq(zoneClosure.id, closureId));
  check("it is unpublished", fresh.publishedAt === null);

  const unpublishedToEngine = await listClosures(
    null,
    zoneId,
    window.startsAt,
    window.endsAt,
  );
  check(
    "an unpublished closure is invisible to the pilot-facing reader",
    unpublishedToEngine.length === 0,
    unpublishedToEngine.map((row) => row.id),
  );

  const adminSees = await listZoneClosures(session, zoneId);
  check(
    "but the admin reader shows it",
    adminSees.length === 1 && adminSees[0].id === closureId,
    adminSees.map((row) => row.id),
  );

  const publishedOutcome = await db.transaction((tx) =>
    publishZoneClosure(tx, { closureId, actor: ADMIN }),
  );
  check("it publishes", publishedOutcome.ok, publishedOutcome);

  const [afterPublish] = await db
    .select({ publishedAt: zoneClosure.publishedAt })
    .from(zoneClosure)
    .where(eq(zoneClosure.id, closureId));
  check("published_at is stamped", afterPublish.publishedAt !== null);

  const nowVisible = await listClosures(
    null,
    zoneId,
    window.startsAt,
    window.endsAt,
  );
  check(
    "and the pilot-facing reader now returns it",
    nowVisible.length === 1 && nowVisible[0].id === closureId,
    nowVisible.map((row) => row.id),
  );

  const twice = await db.transaction((tx) =>
    publishZoneClosure(tx, { closureId, actor: ADMIN }),
  );
  check(
    "publishing twice writes nothing the second time",
    !twice.ok && twice.reason === "already_applied",
    twice,
  );

  const trail = await db
    .select({ action: auditEvent.action, reason: auditEvent.reason })
    .from(auditEvent)
    .where(eq(auditEvent.entityId, closureId));
  check(
    "the trail carries exactly one created and one published",
    trail.filter((row) => row.action === "zone_closure.created").length === 1 &&
      trail.filter((row) => row.action === "zone_closure.published").length === 1,
    trail.map((row) => row.action),
  );
  check(
    "and the reason is stored in the authored language",
    trail.every((row) => row.reason === REASON_AR),
    trail.map((row) => row.reason),
  );

  const auditEntity = await db
    .select({ entityType: auditEvent.entityType })
    .from(auditEvent)
    .where(
      and(
        eq(auditEvent.entityId, closureId),
        eq(auditEvent.action, "zone_closure.published"),
      ),
    );
  check(
    "audited against the zone_closure entity, not the zone",
    auditEntity[0]?.entityType === "zone_closure",
    auditEntity,
  );

  console.log("\nwithdrawing");

  const refused = await db.transaction((tx) =>
    withdrawZoneClosure(tx, { closureId, actor: ADMIN }),
  );
  check(
    "a published closure cannot be deleted",
    !refused.ok && refused.reason === "closure_published",
    refused,
  );

  const second = await db.transaction((tx) =>
    createZoneClosure(tx, {
      zoneId,
      actor: ADMIN,
      startsAt: new Date(window.endsAt.getTime() + 86_400_000),
      endsAt: new Date(window.endsAt.getTime() + 2 * 86_400_000),
      reasonAr: REASON_AR,
      reasonEn: REASON_EN,
      authorityRef: null,
    }),
  );
  if (!second.ok) throw new Error("could not create the second closure");

  const withdrawn = await db.transaction((tx) =>
    withdrawZoneClosure(tx, { closureId: second.data.closureId, actor: ADMIN }),
  );
  check("an unpublished closure is deleted", withdrawn.ok, withdrawn);

  const [gone] = await db
    .select({ id: zoneClosure.id })
    .from(zoneClosure)
    .where(eq(zoneClosure.id, second.data.closureId));
  check("the row is gone", gone === undefined);

  const withdrawTrail = await db
    .select({ action: auditEvent.action })
    .from(auditEvent)
    .where(eq(auditEvent.entityId, second.data.closureId));
  check(
    "but the trail outlives it",
    withdrawTrail.some((row) => row.action === "zone_closure.withdrawn"),
    withdrawTrail.map((row) => row.action),
  );

  console.log("\ncities");

  const [newCity] = await db
    .insert(city)
    .values({
      code: "ZZT",
      nameAr: "مدينة اختبار",
      nameEn: "Probe City",
      centroidLat: 24.5,
      centroidLng: 46.5,
    })
    .returning({ id: city.id, isModelled: city.isModelled });
  check(
    "a new city is created unmodelled",
    newCity.isModelled === false,
    newCity,
  );

  let duplicateRefused = false;
  try {
    await db.insert(city).values({
      code: "ZZT",
      nameAr: "مدينة أخرى",
      nameEn: "Another City",
      centroidLat: 24.5,
      centroidLng: 46.5,
    });
  } catch {
    duplicateRefused = true;
  }
  check("a duplicate city code is refused by the database", duplicateRefused);

  console.log("\ncleaning up");
  await cleanup();

  const leftovers = await db
    .select({ id: zone.id })
    .from(zone)
    .where(like(zone.code, `${PREFIX}%`));
  check("every probe row is gone", leftovers.length === 0, leftovers);

  console.log(
    `\n${failures === 0 ? "all checks passed" : `${failures} FAILED`}\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

await main();
