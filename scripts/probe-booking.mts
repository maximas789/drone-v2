/**
 * F12/F13 probe. **Throwaway** — every row it writes, it deletes.
 *
 * The concurrency half of F13 cannot be unit-tested: "two pilots racing for the
 * last seat produce one booking and one graceful refusal" is a claim about
 * Postgres, its partial unique index, and read-committed snapshots. This drives
 * it against the live database.
 *
 * Run with the react-server condition so `server-only` resolves to its no-op:
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx scripts/probe-booking.mts
 */
import { existsSync } from "node:fs";
import { and, count, eq, like, sql } from "drizzle-orm";

if (existsSync(".env")) process.loadEnvFile(".env");

const { db } = await import("@/lib/db");
const { user } = await import("@/lib/db/auth-schema");
const schema = await import("@/lib/db/schema");
const { createBookingWithSeat } = await import("@/lib/booking/create");
const { deriveSlots, slotStates, findAlternativeSlots } = await import(
  "@/lib/booking/slots"
);
const { evaluateAirspace } = await import("@/lib/airspace/evaluate");
const { riyadhInstant, riyadhYmd } = await import("@/lib/airspace/time");
const { buildDayContext, buildPointContext, zoneRuleById } = await import(
  "@/lib/airspace/query"
);
const { issueRemoteId } = await import("@/lib/remote-id/issue");

const { auditEvent, booking, city, drone, notification, pilotProfile, remoteId, zone } =
  schema;

const PROBE = "probe-bk";
const ACTOR = { userId: `${PROBE}-a`, role: "pilot", isSystem: false };

/** Next Sunday from today — inside every seeded zone's 06:00–11:00 window. */
const DAY = nextSunday();
const SLOT = riyadhInstant(DAY, 8 * 60);
const SLOT_END = riyadhInstant(DAY, 9 * 60);
/**
 * A second instant, for the capacity-3 fan-out. Reusing 08:00 would have every
 * claimant collide on `booking_pilot_slot_uniq` before ever reaching the seat
 * index — a real refusal, but not the one under test.
 */
const SLOT2 = riyadhInstant(DAY, 9 * 60);
const SLOT2_END = riyadhInstant(DAY, 10 * 60);

/** One pilot per concurrent claimant: five racers cannot be one person. */
const PILOTS = ["a", "b", "c", "d", "e", "f"] as const;

const results: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function nextSunday(): string {
  const now = new Date();
  for (let day = 1; day <= 7; day++) {
    const candidate = new Date(now.getTime() + day * 86_400_000);
    const ymd = riyadhYmd(candidate);
    if (new Date(riyadhInstant(ymd, 12 * 60)).getUTCDay() === 0) return ymd;
  }
  throw new Error("no Sunday in the next seven days");
}

/** Enough of a session for the data layer. The probe is not an auth test. */
function sessionFor(id: string) {
  return {
    user: { id, role: "pilot" },
    session: { userId: id },
  } as unknown as Parameters<typeof buildDayContext>[0];
}

type Made = { droneId: string; remoteIdId: string };

/** Filled in by `main`, read by the claim helpers below. */
const MADE: Record<string, Made> = {};

async function main() {
  await cleanup();

  const [riyadh] = await db.select().from(city).limit(1);
  const zones = await db.select().from(zone).where(eq(zone.status, "active"));
  const p03 = zones.find((row) => row.code === "RUH-P-03");
  const p07 = zones.find((row) => row.code === "RUH-P-07");
  if (!p03 || !p07) throw new Error("seeded zones missing — run pnpm db:seed");

  // --- probe accounts, profiles, airframes --------------------------------
  await db.insert(user).values(
    PILOTS.map((suffix) => ({
      id: `${PROBE}-${suffix}`,
      name: `Probe ${suffix.toUpperCase()}`,
      email: `${PROBE}-${suffix}@example.test`,
    })),
  );
  for (const suffix of PILOTS) {
    await db.insert(pilotProfile).values({
      userId: `${PROBE}-${suffix}`,
      fullNameAr: "طيّار الاختبار",
      fullNameEn: "Probe Pilot",
      idDocumentType: "saudi_national_id",
      idDocumentNumber: `100000${PILOTS.indexOf(suffix)}0${PILOTS.indexOf(suffix)}`,
      idDocumentHash: `${PROBE}-hash-${suffix}`,
      addressCityId: riyadh?.id ?? null,
      completedAt: new Date(),
      // Verified by a human reviewer. Here, by fiat, because this probe is
      // about seats and not about the identity queue.
      verifiedAt: new Date(),
    });
  }

  // One airframe each, so a drone-level conflict is never a pilot-level one.
  const made = MADE;
  for (const suffix of PILOTS) {
    made[suffix] = await makeDrone(`${PROBE}-${suffix}`, suffix);
  }

  // --- 1. the index itself -------------------------------------------------
  const indexDef = await db.execute<{ indexdef: string }>(
    sql`select indexdef from pg_indexes where indexname = 'booking_seat_uniq'`,
  );
  const definition = indexDef[0]?.indexdef ?? "";
  check(
    "booking_seat_uniq exists, partial on pending|approved",
    /zone_id/.test(definition) &&
      /slot_start/.test(definition) &&
      /seat_index/.test(definition) &&
      // `[\s\S]` rather than the `s` flag: tsconfig targets ES2017.
      /WHERE [\s\S]*pending[\s\S]*approved/i.test(definition),
    definition.replace(/\s+/g, " ").slice(0, 140),
  );

  // --- 2. capacity 1, two simultaneous ------------------------------------
  const [firstA, firstB] = await Promise.all([
    claim("a", p03.id, 1),
    claim("b", p03.id, 1),
  ]);
  const winners = [firstA, firstB].filter((result) => result.ok);
  const losers = [firstA, firstB].filter((result) => !result.ok);
  const seatRows = await seats(p03.id);
  check(
    "capacity 1 · two simultaneous claims → exactly one booking",
    winners.length === 1 && seatRows.length === 1,
    `winners=${winners.length} rows=${seatRows.length}`,
  );
  check(
    "the loser is refused with slot_full, not an exception",
    losers.length === 1 && !losers[0].ok && losers[0].reason === "slot_full",
    losers.map((result) => (result.ok ? "ok" : result.reason)).join(","),
  );

  // --- 3. the loser is offered alternatives -------------------------------
  const rule = await zoneRuleById(sessionFor(`${PROBE}-a`), p03.id, {
    from: riyadhInstant(DAY, 0),
    to: riyadhInstant(DAY, 24 * 60),
  });
  const alternatives = rule
    ? findAlternativeSlots({
        zone: rule,
        hours: rule.hours,
        closures: rule.closures,
        // Genuinely full: `taken` at the zone's own capacity, not at one.
        availability: [{ slotStart: SLOT.toISOString(), taken: rule.capacity }],
        now: new Date(),
        fromYmd: DAY,
        maxDays: rule.maxAdvanceDays,
      })
    : [];
  check(
    "the loser gets three alternative slots",
    alternatives.length === 3 &&
      alternatives.every((slot) => slot.state === "available") &&
      !alternatives.some((slot) => slot.slotStart === SLOT.toISOString()),
    alternatives.map((slot) => slot.slotStart).join(" "),
  );

  // --- 4. cancelling frees the seat, and it is reused ----------------------
  const held = seatRows[0];
  /**
   * Raw SQL, deliberately. Rule 11 puts every status change behind
   * `applyTransition`, and the human `booking.cancelled` edge is F14's to add —
   * what is under test here is the **partial index**, which is a property of
   * the schema and frees the seat whatever writes the status.
   */
  await db.execute(
    sql`update booking set status = 'cancelled' where id = ${held.id}`,
  );
  const reuse = await claim("c", p03.id, 1);
  const afterReuse = await seats(p03.id);
  check(
    "cancelling frees the seat, and the next booking reuses that index",
    reuse.ok &&
      reuse.seatIndex === held.seatIndex &&
      afterReuse.length === 1,
    `reused seat ${reuse.ok ? reuse.seatIndex : "—"} (was ${held.seatIndex})`,
  );

  // --- 5. capacity 3, five simultaneous -----------------------------------
  const fanOut = await Promise.all(
    ["a", "b", "c", "d", "e"].map((pilot) =>
      claim(pilot, p07.id, 3, SLOT2, SLOT2_END),
    ),
  );
  const claimed = fanOut.filter((result) => result.ok);
  const p07Seats = (await seats(p07.id, SLOT2))
    .map((row) => row.seatIndex)
    .sort();
  check(
    "capacity 3 · five simultaneous claims → seats 0,1,2, no gaps, no duplicates",
    claimed.length === 3 && JSON.stringify(p07Seats) === "[0,1,2]",
    `claimed=${claimed.length} seats=${JSON.stringify(p07Seats)}`,
  );
  check(
    "the other two are refused with slot_full",
    fanOut.filter((result) => !result.ok && result.reason === "slot_full")
      .length === 2,
  );

  // --- 6. the same pilot, the same instant, a different zone ---------------
  // Pilot C holds RUH-P-03 at 08:00 from the reuse above; the same instant in
  // another zone is one pilot in two places at once.
  const duplicatePilot = await claim("c", p07.id, 4);
  check(
    "the same pilot at the same instant in another zone → duplicate_booking",
    !duplicatePilot.ok && duplicatePilot.reason === "duplicate_booking",
    duplicatePilot.ok ? "booked" : duplicatePilot.reason,
  );

  // --- 7. the same drone, the same instant, a different pilot --------------
  const alreadyFlying = (await seats(p07.id, SLOT2))[0];
  const flyingDrone = await db.query.booking.findFirst({
    where: eq(booking.id, alreadyFlying.id),
  });
  // Pilot F has booked nothing, so only the **drone** can conflict here.
  const duplicateDrone = await claimWith(
    `${PROBE}-f`,
    { droneId: flyingDrone!.droneId, remoteIdId: flyingDrone!.remoteIdId },
    p03.id,
    4,
    SLOT2,
    SLOT2_END,
  );
  check(
    "the same drone at the same instant under another pilot → duplicate_booking",
    !duplicateDrone.ok && duplicateDrone.reason === "duplicate_booking",
    duplicateDrone.ok ? "booked" : duplicateDrone.reason,
  );

  // --- 8. a failed booking leaves no trail --------------------------------
  const auditBefore = await rowCount(auditEvent);
  const notifyBefore = await rowCount(notification);
  // Pilot F, their own airframe, into a slot whose three seats are all held.
  const doomed = await claim("f", p07.id, 3, SLOT2, SLOT2_END);
  const auditAfter = await rowCount(auditEvent);
  const notifyAfter = await rowCount(notification);
  check(
    "a failed booking writes no audit event and no notification",
    !doomed.ok && auditAfter === auditBefore && notifyAfter === notifyBefore,
    `audit ${auditBefore}→${auditAfter}, notification ${notifyBefore}→${notifyAfter}`,
  );

  // --- 9. capacity + 1 consecutive conflicts ------------------------------
  let attempts = 0;
  const forced = await createBookingWithSeat({
    pilotUserId: `${PROBE}-f`,
    droneId: made.f.droneId,
    remoteIdId: made.f.remoteIdId,
    zoneId: p07.id,
    slotStart: SLOT2,
    slotEnd: SLOT2_END,
    capacity: 3,
    decisionSnapshot: fakeDecision(),
    actor: { ...ACTOR, userId: `${PROBE}-f` },
    // Always hands back a seat that is already held: every attempt conflicts.
    pickSeat: async () => {
      attempts += 1;
      return 0;
    },
  });
  check(
    "capacity + 1 consecutive conflicts → slot_full, not a spin",
    !forced.ok && forced.reason === "slot_full" && attempts === 4,
    `${attempts} attempts, answer ${forced.ok ? "ok" : forced.reason}`,
  );

  // --- 10. the engine, against the live database --------------------------
  const session = sessionFor(`${PROBE}-a`);
  const { zone: dayZone, context } = await buildDayContext(
    session,
    p03.id,
    DAY,
    made.d.droneId,
  );
  check(
    "buildDayContext hydrates hours and closures from the live rows",
    Boolean(dayZone) && (dayZone?.hours.length ?? 0) > 0,
    `${dayZone?.hours.length ?? 0} windows, ${dayZone?.closures.length ?? 0} closures`,
  );

  const grid = dayZone
    ? slotStates({
        zone: dayZone,
        slots: deriveSlots(dayZone, dayZone.hours, DAY),
        closures: dayZone.closures,
        availability: context.availability,
        now: new Date(),
        pilotBusySlots: context.pilotBusySlots,
        pilotBookingsOnDay: context.pilotBookingsOnDay,
        maxSlotsPerPilotPerDay: dayZone.maxSlotsPerPilotPerDay,
      })
    : [];
  const bookedSlot = grid.find((slot) => slot.slotStart === SLOT.toISOString());
  check(
    "the day grid reflects the seat that was actually taken",
    Boolean(bookedSlot) && bookedSlot!.taken === 1,
    `taken=${bookedSlot?.taken} state=${bookedSlot?.state} of ${grid.length} slots`,
  );

  const decision = evaluateAirspace(
    {
      zoneId: p03.id,
      altitudeAglM: 60,
      slotStart: riyadhInstant(DAY, 10 * 60).toISOString(),
      slotEnd: riyadhInstant(DAY, 11 * 60).toISOString(),
      now: new Date().toISOString(),
    },
    context,
  );
  check(
    "a clean booking against the seeded RUH-P-03 is allowed",
    decision.status === "allowed" && decision.geometryVersion > 0,
    `${decision.status}, reasons=[${decision.reasons.map((r) => r.code).join(",")}]`,
  );

  const tooHigh = evaluateAirspace(
    {
      zoneId: p03.id,
      altitudeAglM: 500,
      slotStart: riyadhInstant(DAY, 10 * 60).toISOString(),
      slotEnd: riyadhInstant(DAY, 11 * 60).toISOString(),
      now: new Date().toISOString(),
    },
    context,
  );
  check(
    "500 m over a zone with an 80 m ceiling → above_ceiling",
    tooHigh.reasons.some((reason) => reason.code === "above_ceiling"),
    tooHigh.reasons.map((reason) => reason.code).join(","),
  );

  // --- 11. the point path, over the real Riyadh polygons -------------------
  const pointContext = await buildPointContext(session, {
    // King Salman Park, inside RUH-P-04 and inside the restricted base.
    point: [46.745, 24.72],
    droneId: made.d.droneId,
  });
  const pointDecision = evaluateAirspace(
    { point: [46.745, 24.72], now: new Date().toISOString() },
    pointContext,
  );
  check(
    "the bbox pre-filter finds both the carve-out and the base, and the carve-out wins",
    pointContext.zones.length >= 2 && pointDecision.zone?.code === "RUH-P-04",
    `${pointContext.zones.length} candidate zones → ${pointDecision.zone?.code}`,
  );

  const noFly = evaluateAirspace(
    { point: [46.71, 24.68], now: new Date().toISOString() },
    await buildPointContext(session, { point: [46.71, 24.68] }),
  );
  check(
    "a point over the Ministry of Defence area → inside_no_fly_zone",
    noFly.reasons.some((reason) => reason.code === "inside_no_fly_zone"),
    `${noFly.zone?.code}: ${noFly.reasons.map((r) => r.code).join(",")}`,
  );

  // --- 12. maxSlotsPerPilotPerDay -----------------------------------------
  const capped = evaluateAirspace(
    {
      zoneId: p03.id,
      slotStart: riyadhInstant(DAY, 10 * 60).toISOString(),
      slotEnd: riyadhInstant(DAY, 11 * 60).toISOString(),
      now: new Date().toISOString(),
    },
    { ...context, pilotBookingsOnDay: 2 },
  );
  check(
    "a pilot at maxSlotsPerPilotPerDay → max_slots_per_day",
    capped.reasons.some((reason) => reason.code === "max_slots_per_day"),
    capped.reasons.map((reason) => reason.code).join(","),
  );
}

// --- helpers ---------------------------------------------------------------

function fakeDecision() {
  return {
    status: "allowed" as const,
    zone: null,
    reasons: [],
    nextOpenAt: null,
    alternativeSlots: [],
    evaluatedAt: new Date().toISOString(),
    geometryVersion: 1,
  };
}

/** One pilot claiming with their own airframe. */
async function claim(
  pilot: string,
  zoneId: string,
  capacity: number,
  slotStart = SLOT,
  slotEnd = SLOT_END,
) {
  return claimWith(
    `${PROBE}-${pilot}`,
    MADE[pilot],
    zoneId,
    capacity,
    slotStart,
    slotEnd,
  );
}

async function claimWith(
  pilotUserId: string,
  made: Made,
  zoneId: string,
  capacity: number,
  slotStart: Date,
  slotEnd: Date,
) {
  return createBookingWithSeat({
    pilotUserId,
    droneId: made.droneId,
    remoteIdId: made.remoteIdId,
    zoneId,
    slotStart,
    slotEnd,
    capacity,
    decisionSnapshot: fakeDecision(),
    actor: { ...ACTOR, userId: pilotUserId },
  });
}

async function seats(zoneId: string, slotStart: Date = SLOT) {
  return db
    .select({ id: booking.id, seatIndex: booking.seatIndex })
    .from(booking)
    .where(
      and(
        eq(booking.zoneId, zoneId),
        eq(booking.slotStart, slotStart),
        sql`${booking.status} in ('pending','approved')`,
      ),
    );
}

async function rowCount(table: typeof auditEvent | typeof notification) {
  const [row] = await db.select({ value: count() }).from(table);
  return row?.value ?? 0;
}

async function makeDrone(ownerUserId: string, label: string): Promise<Made> {
  const [row] = await db
    .insert(drone)
    .values({
      ownerUserId,
      nickname: `${PROBE}-${label}`,
      // No serial number. A self-built airframe is the whole point.
      serialNumber: null,
      buildType: "self_built",
      weightGrams: 900,
      weightClass: "light",
      status: "approved",
      registrationIssuedAt: new Date(),
      registrationExpiresAt: new Date(Date.now() + 3 * 365 * 86_400_000),
    })
    .returning({ id: drone.id });

  const issued = await db.transaction((tx) =>
    issueRemoteId(tx, {
      droneId: row.id,
      actor: { userId: null, role: null, isSystem: true },
    }),
  );
  return { droneId: row.id, remoteIdId: issued.remoteIdId };
}

async function cleanup() {
  const probeDrones = await db
    .select({ id: drone.id })
    .from(drone)
    .where(like(drone.nickname, `${PROBE}-%`));
  const ids = probeDrones.map((row) => row.id);

  for (const id of ids) {
    /**
     * `issueRemoteId` writes `remote_id.issued` as the **system** actor, so
     * those rows carry no probe user id and a cleanup keyed on the actor alone
     * would leave them behind. They are found by entity instead.
     */
    const rids = await db
      .select({ id: remoteId.id })
      .from(remoteId)
      .where(eq(remoteId.droneId, id));
    for (const rid of rids) {
      await db.delete(auditEvent).where(eq(auditEvent.entityId, rid.id));
    }
    await db.delete(auditEvent).where(eq(auditEvent.entityId, id));
    await db.delete(booking).where(eq(booking.droneId, id));
    await db.delete(remoteId).where(eq(remoteId.droneId, id));
    await db.delete(drone).where(eq(drone.id, id));
  }
  await db.delete(pilotProfile).where(like(pilotProfile.userId, `${PROBE}-%`));
  await db.delete(auditEvent).where(like(auditEvent.actorUserId, `${PROBE}-%`));
  await db.delete(notification).where(like(notification.userId, `${PROBE}-%`));
  await db.delete(user).where(like(user.id, `${PROBE}-%`));
}

try {
  await main();
} finally {
  const audits = await db
    .select({ value: count() })
    .from(auditEvent)
    .where(like(auditEvent.actorUserId, `${PROBE}-%`));
  results.push(`--- audit events written by the probe: ${audits[0]?.value ?? 0}`);
  await cleanup();
  const left = await db
    .select({ value: count() })
    .from(drone)
    .where(like(drone.nickname, `${PROBE}-%`));
  results.push(`--- probe rows left behind: ${left[0]?.value ?? 0}`);
  console.log(`\nSlot day: ${DAY}  slot: ${SLOT.toISOString()}\n`);
  console.log(results.join("\n"));
  process.exit(process.exitCode ?? 0);
}
