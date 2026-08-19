/**
 * F22c probe — **the four-eyes rule, and thread 35's triage.** Throwaway:
 * every row it writes, it deletes.
 *
 * These are claims about a database and cannot be unit-tested. `isOwnSubmission`
 * is pure and has its own suite; what this drives is the half that matters —
 * that each of the six decisions actually *asks* it, refuses before writing
 * anything, and still lets a **different** reviewer through. A rule enforced in
 * five of six places is not a rule.
 *
 * It also exercises two queries that only fail at runtime: the declaration
 * lock's `for update … of` across two left joins (a bare `FOR UPDATE` there is
 * refused by Postgres outright), and the first write against the new
 * `drone_report` audit entity type.
 *
 * Run with the react-server condition so `server-only` resolves to its no-op:
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx scripts/probe-four-eyes.mts
 */
import { existsSync } from "node:fs";
import { eq, like } from "drizzle-orm";

if (existsSync(".env")) process.loadEnvFile(".env");

const { db } = await import("@/lib/db");
const { user } = await import("@/lib/db/auth-schema");
const schema = await import("@/lib/db/schema");
const { approveDrone, rejectDrone } = await import("@/lib/workflow/drone");
const { approveBooking, cancelBookingByAuthority, rejectBooking } =
  await import("@/lib/workflow/booking");
const { verifyIdentity, rejectIdentity } = await import(
  "@/lib/workflow/identity"
);
const { verifyDeclaration } = await import("@/lib/workflow/declaration");
const { triageReport } = await import("@/lib/workflow/report");

const {
  auditEvent,
  booking,
  city,
  drone,
  dronePhoto,
  droneReport,
  notification,
  pilotProfile,
  remoteId,
  remoteIdDeclaration,
  zone,
} = schema;

const PROBE = "probe-4eyes";
const PILOT = `${PROBE}-pilot`;
const OTHER = `${PROBE}-reviewer`;

const actor = (userId: string, role: string) => ({
  userId,
  role,
  isSystem: false,
});

const results: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function auditCount(entityId: string) {
  const rows = await db
    .select({ id: auditEvent.id })
    .from(auditEvent)
    .where(eq(auditEvent.entityId, entityId));
  return rows.length;
}

async function main() {
  await cleanup();

  const [riyadh] = await db.select().from(city).limit(1);
  const [anyZone] = await db
    .select()
    .from(zone)
    .where(eq(zone.status, "active"))
    .limit(1);
  if (!anyZone) throw new Error("no active zone — run pnpm db:seed");

  await db.insert(user).values([
    { id: PILOT, name: "Probe Pilot", email: `${PILOT}@example.test` },
    { id: OTHER, name: "Probe Reviewer", email: `${OTHER}@example.test` },
  ]);

  await db.insert(pilotProfile).values({
    userId: PILOT,
    fullNameAr: "طيّار الاختبار",
    fullNameEn: "Probe Pilot",
    idDocumentType: "saudi_national_id",
    idDocumentNumber: "1099887755",
    idDocumentHash: `${PROBE}-hash`,
    addressCityId: riyadh?.id ?? null,
    completedAt: new Date(),
  });
  // --- 1. a registration decision -----------------------------------------

  const [droneRow] = await db
    .insert(drone)
    .values({
      ownerUserId: PILOT,
      nickname: `${PROBE}-alpha`,
      serialNumber: null,
      buildType: "self_built",
      weightGrams: 900,
      weightClass: "light",
      status: "pending",
      submittedAt: new Date(),
    })
    .returning({ id: drone.id });

  const before = await auditCount(droneRow.id);

  const selfApprove = await db.transaction((tx) =>
    approveDrone(tx, { droneId: droneRow.id, actor: actor(PILOT, "admin") }),
  );
  check(
    "the owner cannot approve their own registration",
    !selfApprove.ok && selfApprove.reason === "own_submission",
    selfApprove.ok ? "approved" : selfApprove.reason,
  );

  const selfReject = await db.transaction((tx) =>
    rejectDrone(tx, {
      droneId: droneRow.id,
      actor: actor(PILOT, "admin"),
      reason: "a reason long enough to pass the twenty-character floor",
    }),
  );
  check(
    "the owner cannot reject their own registration either",
    !selfReject.ok && selfReject.reason === "own_submission",
    selfReject.ok ? "rejected" : selfReject.reason,
  );

  /**
   * **A refusal writes nothing at all.** The check happens before the
   * transition, so a self-approval leaves no audit event, no notification and
   * no status change — the trail must not accumulate refused attempts as though
   * something had happened.
   */
  check(
    "a refused self-decision writes no audit event",
    (await auditCount(droneRow.id)) === before,
    `${before} → ${await auditCount(droneRow.id)}`,
  );

  const [stillPending] = await db
    .select({ status: drone.status })
    .from(drone)
    .where(eq(drone.id, droneRow.id));
  check(
    "and leaves the row pending",
    stillPending.status === "pending",
    stillPending.status,
  );

  const otherApprove = await db.transaction((tx) =>
    approveDrone(tx, { droneId: droneRow.id, actor: actor(OTHER, "reviewer") }),
  );
  check(
    "a different reviewer approves the same registration",
    otherApprove.ok,
    otherApprove.ok ? `→ ${otherApprove.to}` : otherApprove.reason,
  );

  // --- 2. a declared module, two joins from its owner ----------------------

  const [rid] = await db
    .select({ id: remoteId.id })
    .from(remoteId)
    .where(eq(remoteId.droneId, droneRow.id));
  check("approval issued a Remote ID to hang a declaration off", Boolean(rid));

  if (rid) {
    const [declaration] = await db
      .insert(remoteIdDeclaration)
      .values({
        remoteIdId: rid.id,
        kind: "faa_broadcast_module",
        manufacturer: `${PROBE}-maker`,
        moduleSerial: `${PROBE}-serial`,
      })
      .returning({ id: remoteIdDeclaration.id });

    const selfVerify = await db.transaction((tx) =>
      verifyDeclaration(tx, {
        declarationId: declaration.id,
        actor: actor(PILOT, "admin"),
        validFrom: null,
        validUntil: null,
      }),
    );
    check(
      "the owner cannot verify a module on their own aircraft",
      !selfVerify.ok && selfVerify.reason === "own_submission",
      selfVerify.ok ? "verified" : selfVerify.reason,
    );

    /**
     * The same call by somebody else proves the locking query itself runs: a
     * bare `FOR UPDATE` over those two left joins is refused by Postgres, and
     * `of: remoteIdDeclaration` is what makes it legal. Nothing catches that
     * except executing it.
     */
    const otherVerify = await db.transaction((tx) =>
      verifyDeclaration(tx, {
        declarationId: declaration.id,
        actor: actor(OTHER, "reviewer"),
        validFrom: null,
        validUntil: null,
      }),
    );
    check(
      "a different reviewer verifies it, and the join-lock query runs",
      otherVerify.ok,
      otherVerify.ok ? `broadcastCapable=${otherVerify.broadcastCapable}` : otherVerify.reason,
    );
  }

  // --- 3. an identity ------------------------------------------------------

  const selfIdentity = await db.transaction((tx) =>
    verifyIdentity(tx, { userId: PILOT, actor: actor(PILOT, "admin") }),
  );
  check(
    "nobody verifies their own identity document",
    !selfIdentity.ok && selfIdentity.reason === "own_submission",
    selfIdentity.ok ? "verified" : selfIdentity.reason,
  );

  const otherIdentity = await db.transaction((tx) =>
    verifyIdentity(tx, { userId: PILOT, actor: actor(OTHER, "reviewer") }),
  );
  check(
    "a different reviewer verifies it",
    otherIdentity.ok,
    otherIdentity.ok ? "verified" : otherIdentity.reason,
  );

  const twice = await db.transaction((tx) =>
    verifyIdentity(tx, { userId: PILOT, actor: actor(OTHER, "reviewer") }),
  );
  check(
    "verifying twice is refused rather than written twice",
    !twice.ok && twice.reason === "already_applied",
    twice.ok ? "verified again" : twice.reason,
  );

  const [verified] = await db
    .select({
      verifiedAt: pilotProfile.verifiedAt,
      verifiedByUserId: pilotProfile.verifiedByUserId,
    })
    .from(pilotProfile)
    .where(eq(pilotProfile.userId, PILOT));
  check(
    "the row records who vouched for them",
    verified.verifiedAt !== null && verified.verifiedByUserId === OTHER,
    `${verified.verifiedByUserId}`,
  );

  const refuseIdentity = await db.transaction((tx) =>
    rejectIdentity(tx, {
      userId: PILOT,
      actor: actor(OTHER, "reviewer"),
      reason: "the identity document image is not legible enough to read",
    }),
  );
  check(
    "a refusal overrides an earlier verification",
    refuseIdentity.ok,
    refuseIdentity.ok ? "" : refuseIdentity.reason,
  );
  const [afterRefusal] = await db
    .select({
      verifiedAt: pilotProfile.verifiedAt,
      rejectedAt: pilotProfile.rejectedAt,
    })
    .from(pilotProfile)
    .where(eq(pilotProfile.userId, PILOT));
  check(
    "and clears `verifiedAt`, so the two columns cannot both stand",
    afterRefusal.verifiedAt === null && afterRefusal.rejectedAt !== null,
  );

  // --- 4. a booking --------------------------------------------------------

  if (rid) {
    const slotStart = new Date(Date.now() + 3 * 86_400_000);
    const [bookingRow] = await db
      .insert(booking)
      .values({
        pilotUserId: PILOT,
        droneId: droneRow.id,
        remoteIdId: rid.id,
        zoneId: anyZone.id,
        slotStart,
        slotEnd: new Date(slotStart.getTime() + 60 * 60_000),
        seatIndex: 0,
        status: "pending",
      })
      .returning({ id: booking.id });

    const selfBooking = await db.transaction((tx) =>
      approveBooking(tx, {
        bookingId: bookingRow.id,
        actor: actor(PILOT, "admin"),
      }),
    );
    check(
      "the pilot cannot approve their own booking",
      !selfBooking.ok && selfBooking.reason === "own_submission",
      selfBooking.ok ? "approved" : selfBooking.reason,
    );

    const selfBookingReject = await db.transaction((tx) =>
      rejectBooking(tx, {
        bookingId: bookingRow.id,
        actor: actor(PILOT, "admin"),
        reason: "a reason long enough to pass the twenty-character floor",
      }),
    );
    check(
      "nor reject it",
      !selfBookingReject.ok && selfBookingReject.reason === "own_submission",
      selfBookingReject.ok ? "rejected" : selfBookingReject.reason,
    );

    /**
     * The one that is not obvious: an authority cancellation has **no**
     * lead-time limit, so a reviewer cancelling their own flight would be
     * walking round `pilotMayCancel`'s two-hour cutoff with a power granted for
     * somebody else's emergency.
     */
    const selfAuthorityCancel = await db.transaction((tx) =>
      cancelBookingByAuthority(tx, {
        bookingId: bookingRow.id,
        actor: actor(PILOT, "admin"),
        reason: "a reason long enough to pass the twenty-character floor",
      }),
    );
    check(
      "nor take their own slot away as the authority",
      !selfAuthorityCancel.ok &&
        selfAuthorityCancel.reason === "own_submission",
      selfAuthorityCancel.ok ? "cancelled" : selfAuthorityCancel.reason,
    );

    const otherReject = await db.transaction((tx) =>
      rejectBooking(tx, {
        bookingId: bookingRow.id,
        actor: actor(OTHER, "reviewer"),
        reason: "a reason long enough to pass the twenty-character floor",
      }),
    );
    check(
      "a different reviewer decides the same booking",
      otherReject.ok,
      otherReject.ok ? `→ ${otherReject.to}` : otherReject.reason,
    );
  }

  // --- 5. thread 35: report triage ----------------------------------------

  const [report] = await db
    .insert(droneReport)
    .values({
      reportedCode: `${PROBE}-CODE`,
      description: "probe report",
    })
    .returning({ id: droneReport.id, status: droneReport.status });
  check("a filed report starts open", report.status === "open", report.status);

  const triaged = await db.transaction((tx) =>
    triageReport(tx, {
      reportId: report.id,
      actor: actor(OTHER, "reviewer"),
      status: "actioned",
      note: "suspended the Remote ID and called the operator",
    }),
  );
  check(
    "a reviewer closes it",
    triaged.ok && triaged.status === "actioned",
    triaged.ok ? "" : triaged.reason,
  );

  const triagedTwice = await db.transaction((tx) =>
    triageReport(tx, {
      reportId: report.id,
      actor: actor(OTHER, "reviewer"),
      status: "dismissed",
      note: "",
    }),
  );
  check(
    "closing it twice is refused rather than overwritten",
    !triagedTwice.ok && triagedTwice.reason === "already_applied",
    triagedTwice.ok ? "closed again" : triagedTwice.reason,
  );

  /**
   * The first write against the `drone_report` audit entity type — a value
   * added to the enum by this feature's migration, and unexercised until here.
   */
  const trail = await db
    .select({ action: auditEvent.action, entityType: auditEvent.entityType })
    .from(auditEvent)
    .where(eq(auditEvent.entityId, report.id));
  check(
    "the decision is audited against the report itself",
    trail.length === 1 &&
      trail[0].action === "drone_report.actioned" &&
      trail[0].entityType === "drone_report",
    JSON.stringify(trail),
  );

  await cleanup();
  console.log(results.join("\n"));
  console.log(
    `\n${results.filter((line) => line.startsWith("OK")).length}/${results.length} passed`,
  );
}

async function cleanup() {
  const probeDrones = await db
    .select({ id: drone.id })
    .from(drone)
    .where(like(drone.nickname, `${PROBE}-%`));

  for (const { id } of probeDrones) {
    const rids = await db
      .select({ id: remoteId.id })
      .from(remoteId)
      .where(eq(remoteId.droneId, id));
    for (const row of rids) {
      await db
        .delete(remoteIdDeclaration)
        .where(eq(remoteIdDeclaration.remoteIdId, row.id));
      await db.delete(auditEvent).where(eq(auditEvent.entityId, row.id));
    }
    const bookings = await db
      .select({ id: booking.id })
      .from(booking)
      .where(eq(booking.droneId, id));
    for (const row of bookings) {
      await db.delete(auditEvent).where(eq(auditEvent.entityId, row.id));
      await db.delete(notification).where(eq(notification.entityId, row.id));
    }
    await db.delete(auditEvent).where(eq(auditEvent.entityId, id));
    await db.delete(notification).where(eq(notification.entityId, id));
    await db.delete(booking).where(eq(booking.droneId, id));
    await db.delete(dronePhoto).where(eq(dronePhoto.droneId, id));
    await db.delete(remoteId).where(eq(remoteId.droneId, id));
    await db.delete(drone).where(eq(drone.id, id));
  }

  const reports = await db
    .select({ id: droneReport.id })
    .from(droneReport)
    .where(like(droneReport.reportedCode, `${PROBE}-%`));
  for (const { id } of reports) {
    await db.delete(auditEvent).where(eq(auditEvent.entityId, id));
    await db.delete(droneReport).where(eq(droneReport.id, id));
  }

  const profiles = await db
    .select({ id: pilotProfile.id })
    .from(pilotProfile)
    .where(eq(pilotProfile.userId, PILOT));
  for (const { id } of profiles) {
    await db.delete(auditEvent).where(eq(auditEvent.entityId, id));
  }
  await db.delete(pilotProfile).where(eq(pilotProfile.userId, PILOT));

  for (const id of [PILOT, OTHER]) {
    await db.delete(notification).where(eq(notification.userId, id));
    await db.delete(user).where(eq(user.id, id));
  }
}

await main();
process.exit(process.exitCode ?? 0);
