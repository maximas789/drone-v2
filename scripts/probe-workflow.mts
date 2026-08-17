/**
 * F14 probe. **Throwaway** — every row it writes, it deletes.
 *
 * The workflow's claims are claims about a database: that a decision writes the
 * row, the audit event and the notification together or not at all; that an
 * illegal edge changes nothing; that approving re-reads the airspace. None of
 * that is unit-testable, so this drives it against the live database.
 *
 * Run with the react-server condition so `server-only` resolves to its no-op:
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx scripts/probe-workflow.mts
 */
import { existsSync } from "node:fs";
import { count, eq, like } from "drizzle-orm";

if (existsSync(".env")) process.loadEnvFile(".env");

const { db } = await import("@/lib/db");
const { user } = await import("@/lib/db/auth-schema");
const schema = await import("@/lib/db/schema");
const { registrationExpiryFrom } = await import("@/lib/workflow/rules");
const {
  approveDrone,
  reinstateDrone,
  rejectDrone,
  renewDrone,
  resubmitDrone,
  revokeDrone,
  submitDrone,
} = await import("@/lib/workflow/drone");
const {
  approveBooking,
  cancelBookingByAuthority,
  cancelBookingByPilot,
  checkInBooking,
  rejectBooking,
} = await import("@/lib/workflow/booking");
const { applyTransition } = await import("@/lib/workflow/apply");
const { createBookingWithSeat } = await import("@/lib/booking/create");
const { riyadhInstant, riyadhYmd } = await import("@/lib/airspace/time");
const { countRecentNoShows, autoApproveEligible } = await import(
  "@/lib/data/pilot"
);

const {
  auditEvent,
  booking,
  city,
  drone,
  dronePhoto,
  notification,
  pilotProfile,
  remoteId,
  zone,
  zoneClosure,
} = schema;

const PROBE = "probe-wf";
const PILOT = `${PROBE}-pilot`;
const REVIEWER = `${PROBE}-reviewer`;
const ADMIN = `${PROBE}-admin`;

const actor = (userId: string, role: string) => ({
  userId,
  role,
  isSystem: false,
});
const SYSTEM = { userId: null, role: null, isSystem: true };

const results: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function nextSunday(): string {
  const now = new Date();
  for (let day = 1; day <= 7; day++) {
    const ymd = riyadhYmd(new Date(now.getTime() + day * 86_400_000));
    if (new Date(riyadhInstant(ymd, 12 * 60)).getUTCDay() === 0) return ymd;
  }
  throw new Error("no Sunday in the next seven days");
}

const DAY = nextSunday();

async function auditFor(entityId: string) {
  return db
    .select()
    .from(auditEvent)
    .where(eq(auditEvent.entityId, entityId));
}

async function countRows(table: typeof auditEvent | typeof notification) {
  const [row] = await db.select({ value: count() }).from(table);
  return row?.value ?? 0;
}

async function main() {
  await cleanup();

  const [riyadh] = await db.select().from(city).limit(1);
  const zones = await db.select().from(zone).where(eq(zone.status, "active"));
  // RUH-P-03 auto-approves; RUH-P-07 does not. Both 60-minute grids.
  const auto = zones.find((row) => row.code === "RUH-P-03");
  const manual = zones.find((row) => row.code === "RUH-P-07");
  if (!auto || !manual) throw new Error("seeded zones missing — run pnpm db:seed");
  check(
    "the seed still gives us one auto-approve zone and one that is not",
    auto.autoApprove && !manual.autoApprove,
    `${auto.code} auto=${auto.autoApprove}, ${manual.code} auto=${manual.autoApprove}`,
  );

  await db.insert(user).values([
    { id: PILOT, name: "Probe Pilot", email: `${PILOT}@example.test` },
    { id: REVIEWER, name: "Probe Reviewer", email: `${REVIEWER}@example.test` },
    { id: ADMIN, name: "Probe Admin", email: `${ADMIN}@example.test` },
  ]);

  // --- 1. submission guards ------------------------------------------------
  const droneId = await makeDrone("alpha");

  const noProfile = await db.transaction((tx) =>
    submitDrone(tx, { droneId, actor: actor(PILOT, "pilot") }),
  );
  check(
    "submitting with no pilot profile is refused",
    !noProfile.ok && noProfile.reason === "profile_incomplete",
    noProfile.ok ? "submitted" : noProfile.reason,
  );

  await db.insert(pilotProfile).values({
    userId: PILOT,
    fullNameAr: "طيّار الاختبار",
    fullNameEn: "Probe Pilot",
    idDocumentType: "saudi_national_id",
    idDocumentNumber: "1099887766",
    idDocumentHash: `${PROBE}-hash`,
    addressCityId: riyadh?.id ?? null,
    completedAt: new Date(),
    verifiedAt: new Date(),
  });

  const noPhoto = await db.transaction((tx) =>
    submitDrone(tx, { droneId, actor: actor(PILOT, "pilot") }),
  );
  check(
    "submitting with no photograph is refused",
    !noPhoto.ok && noPhoto.reason === "photo_required",
    noPhoto.ok ? "submitted" : noPhoto.reason,
  );

  await db.insert(dronePhoto).values({
    droneId,
    url: "/api/files/probe.jpg",
    pathname: "probe/probe.jpg",
    kind: "overall",
  });

  // A commercial airframe with no serial: the one case that still needs one.
  const commercialId = await makeDrone("commercial", "commercial");
  await db.insert(dronePhoto).values({
    droneId: commercialId,
    url: "/api/files/probe2.jpg",
    pathname: "probe/probe2.jpg",
    kind: "overall",
  });
  const noSerial = await db.transaction((tx) =>
    submitDrone(tx, { droneId: commercialId, actor: actor(PILOT, "pilot") }),
  );
  check(
    "a commercial airframe with no serial number is refused",
    !noSerial.ok && noSerial.reason === "serial_required",
    noSerial.ok ? "submitted" : noSerial.reason,
  );

  // …and the self-built one, with no serial, goes straight through. **This is
  // the product.**
  const submitted = await db.transaction((tx) =>
    submitDrone(tx, { droneId, actor: actor(PILOT, "pilot") }),
  );
  check(
    "a self-built airframe with NO serial number submits successfully",
    submitted.ok && submitted.to === "pending",
    submitted.ok ? `${submitted.from} → ${submitted.to}` : submitted.reason,
  );

  // --- 2. who may decide ---------------------------------------------------
  const selfApprove = await db.transaction((tx) =>
    approveDrone(tx, { droneId, actor: actor(PILOT, "pilot") }),
  );
  check(
    "a pilot approving their own drone is refused",
    !selfApprove.ok && selfApprove.reason === "invalid_transition",
    selfApprove.ok ? "approved" : selfApprove.reason,
  );

  const shortReason = await db.transaction((tx) =>
    rejectDrone(tx, {
      droneId,
      actor: actor(REVIEWER, "reviewer"),
      reason: "no",
    }),
  );
  check(
    "rejecting with a 2-character reason is refused",
    !shortReason.ok && shortReason.reason === "reason_required",
    shortReason.ok ? "rejected" : shortReason.reason,
  );

  const statusAfterRefusals = await droneStatus(droneId);
  const auditAfterRefusals = (await auditFor(droneId)).length;
  check(
    "every refusal so far changed nothing",
    statusAfterRefusals === "pending" && auditAfterRefusals === 1,
    `status=${statusAfterRefusals}, audit events=${auditAfterRefusals}`,
  );

  // --- 3. rejection, and back round ---------------------------------------
  const rejected = await db.transaction((tx) =>
    rejectDrone(tx, {
      droneId,
      actor: actor(REVIEWER, "reviewer"),
      reason: "The serial plate photograph is unreadable at this resolution.",
    }),
  );
  check("a 20+ character reason rejects successfully", rejected.ok);

  const resubmitted = await db.transaction((tx) =>
    resubmitDrone(tx, { droneId, actor: actor(PILOT, "pilot") }),
  );
  const afterResubmit = await db.query.drone.findFirst({
    where: eq(drone.id, droneId),
  });
  const rejectionInTrail = (await auditFor(droneId)).find(
    (row) => row.action === "drone.rejected",
  );
  check(
    "resubmitting increments rejectionCount and leaves the reason in the trail",
    resubmitted.ok &&
      afterResubmit?.rejectionCount === 1 &&
      afterResubmit?.rejectionReason === null &&
      Boolean(rejectionInTrail?.reason),
    `count=${afterResubmit?.rejectionCount}, trail reason=${rejectionInTrail?.reason?.slice(0, 30)}…`,
  );

  // --- 4. approval ---------------------------------------------------------
  const approvedAt = new Date();
  const approved = await db.transaction((tx) =>
    approveDrone(tx, {
      droneId,
      actor: actor(REVIEWER, "reviewer"),
      at: approvedAt,
    }),
  );
  const afterApproval = await db.query.drone.findFirst({
    where: eq(drone.id, droneId),
  });
  const issuedRid = await db.query.remoteId.findFirst({
    where: eq(remoteId.droneId, droneId),
  });
  check(
    "approving issues the Remote ID and sets the registration window",
    approved.ok &&
      Boolean(issuedRid?.code) &&
      afterApproval?.registrationIssuedAt?.getTime() === approvedAt.getTime(),
    `code=${issuedRid?.code}`,
  );
  check(
    "the registration expires exactly three years later, to the day",
    afterApproval?.registrationExpiresAt?.getTime() ===
      registrationExpiryFrom(approvedAt).getTime(),
    `${afterApproval?.registrationExpiresAt?.toISOString()}`,
  );

  const firstCode = issuedRid?.code ?? "";

  // --- 5. expiry and renewal keep the code --------------------------------
  const expired = await applyTransition({
    transition: "drone.expired",
    id: droneId,
    actor: SYSTEM,
  });
  const renewed = await db.transaction((tx) =>
    renewDrone(tx, { droneId, actor: actor(PILOT, "pilot") }),
  );
  const reapproved = await db.transaction((tx) =>
    approveDrone(tx, { droneId, actor: actor(REVIEWER, "reviewer") }),
  );
  const afterRenewal = await db.query.remoteId.findFirst({
    where: eq(remoteId.droneId, droneId),
  });
  check(
    "expiring, renewing and re-approving keeps the SAME Remote ID code",
    expired.ok &&
      renewed.ok &&
      reapproved.ok &&
      afterRenewal?.code === firstCode &&
      afterRenewal?.status === "active",
    `${firstCode} → ${afterRenewal?.code} (${afterRenewal?.status})`,
  );

  // --- 6. revocation is admin-only ----------------------------------------
  const reviewerRevoke = await db.transaction((tx) =>
    revokeDrone(tx, {
      droneId,
      actor: actor(REVIEWER, "reviewer"),
      reason: "Attempting revocation as a reviewer, which must be refused.",
    }),
  );
  check(
    "a reviewer revoking is refused",
    !reviewerRevoke.ok && reviewerRevoke.reason === "invalid_transition",
    reviewerRevoke.ok ? "revoked" : reviewerRevoke.reason,
  );

  const adminRevoke = await db.transaction((tx) =>
    revokeDrone(tx, {
      droneId,
      actor: actor(ADMIN, "admin"),
      reason: "Airframe reported operating outside its registered envelope.",
    }),
  );
  const suspendedRid = await db.query.remoteId.findFirst({
    where: eq(remoteId.droneId, droneId),
  });
  check(
    "an admin revoking suspends the Remote ID and keeps the code",
    adminRevoke.ok &&
      suspendedRid?.status === "suspended" &&
      suspendedRid?.code === firstCode,
    `${suspendedRid?.status}, code ${suspendedRid?.code}`,
  );

  const reinstated = await db.transaction((tx) =>
    reinstateDrone(tx, {
      droneId,
      actor: actor(ADMIN, "admin"),
      reason: "Investigation closed with no finding against the operator.",
    }),
  );
  const backAgain = await db.query.remoteId.findFirst({
    where: eq(remoteId.droneId, droneId),
  });
  check(
    "reinstating brings the Remote ID back, still the same code",
    reinstated.ok &&
      backAgain?.status === "active" &&
      backAgain?.code === firstCode &&
      backAgain?.suspensionReason === null,
    `${backAgain?.status}, code ${backAgain?.code}`,
  );

  // --- 7. the audit trail --------------------------------------------------
  const trail = await auditFor(droneId);
  const actions = trail.map((row) => row.action);
  check(
    "every transition wrote exactly one audit event, in order",
    JSON.stringify(actions) ===
      JSON.stringify([
        "drone.submitted",
        "drone.rejected",
        "drone.resubmitted",
        "drone.approved",
        "drone.expired",
        "drone.renewal_submitted",
        "drone.approved",
        "drone.revoked",
        "drone.reinstated",
      ]),
    actions.join(" → "),
  );
  check(
    "the system transition is marked as the system, with no actor",
    trail.some(
      (row) =>
        row.action === "drone.expired" &&
        row.actorIsSystem &&
        row.actorUserId === null,
    ),
  );
  check(
    "actorRole records the role at the time of the act",
    trail.find((row) => row.action === "drone.rejected")?.actorRole ===
      "reviewer" &&
      trail.find((row) => row.action === "drone.revoked")?.actorRole === "admin",
  );

  // Promote the reviewer to admin and confirm the old event still says reviewer.
  await db.update(user).set({ role: "admin" }).where(eq(user.id, REVIEWER));
  const afterPromotion = (await auditFor(droneId)).find(
    (row) => row.action === "drone.rejected",
  );
  check(
    "promoting the reviewer does not rewrite their old events",
    afterPromotion?.actorRole === "reviewer",
    `still ${afterPromotion?.actorRole}`,
  );

  check(
    "no audit event carries a document number or a token",
    trail.every((row) => {
      const blob = JSON.stringify([row.before, row.after, row.reason]);
      return !blob.includes("1099887766") && !/token|password/i.test(blob);
    }),
  );

  // --- 8. bookings ---------------------------------------------------------
  const rid = await db.query.remoteId.findFirst({
    where: eq(remoteId.droneId, droneId),
  });

  const autoBooking = await claimBooking(auto.id, droneId, rid!.id, 8, true);
  check(
    "a booking in an auto-approve zone lands approved, as a logged decision",
    autoBooking.status === "approved" &&
      autoBooking.actions.includes("booking.auto_approved"),
    `${autoBooking.status}: ${autoBooking.actions.join(" → ")}`,
  );

  const manualBooking = await claimBooking(manual.id, droneId, rid!.id, 9, false);
  check(
    "a booking in a normal zone lands pending",
    manualBooking.status === "pending",
    manualBooking.status,
  );

  // --- 9. approval re-runs the airspace engine ----------------------------
  const [closure] = await db
    .insert(zoneClosure)
    .values({
      zoneId: manual.id,
      startsAt: riyadhInstant(DAY, 8 * 60),
      endsAt: riyadhInstant(DAY, 12 * 60),
      reasonAr: "إغلاق اختبار",
      reasonEn: "Probe closure",
      publishedAt: new Date(),
    })
    .returning({ id: zoneClosure.id });

  const staleApproval = await db.transaction((tx) =>
    approveBooking(tx, {
      bookingId: manualBooking.id,
      actor: actor(ADMIN, "admin"),
    }),
  );
  check(
    "approving a booking whose zone closed after the request is REFUSED",
    !staleApproval.ok &&
      staleApproval.reason === "no_longer_authorised" &&
      (staleApproval.reasons ?? []).some(
        (reason) => reason.code === "zone_closed_window",
      ),
    staleApproval.ok
      ? "approved anyway"
      : (staleApproval.reasons ?? []).map((r) => r.code).join(","),
  );

  await db.delete(zoneClosure).where(eq(zoneClosure.id, closure.id));

  const cleanApproval = await db.transaction((tx) =>
    approveBooking(tx, {
      bookingId: manualBooking.id,
      actor: actor(ADMIN, "admin"),
    }),
  );
  const approvedBooking = await db.query.booking.findFirst({
    where: eq(booking.id, manualBooking.id),
  });
  const snapshot = approvedBooking?.decisionSnapshot as {
    geometryVersion?: number;
    status?: string;
  } | null;
  check(
    "with the closure withdrawn it approves, and stores the decision snapshot",
    cleanApproval.ok &&
      snapshot?.status === "needs_review" &&
      typeof snapshot?.geometryVersion === "number" &&
      snapshot.geometryVersion > 0,
    `snapshot status=${snapshot?.status}, geometryVersion=${snapshot?.geometryVersion}`,
  );

  // --- 10. check-in changes no status -------------------------------------
  const checkedIn = await db.transaction((tx) =>
    checkInBooking(tx, {
      bookingId: manualBooking.id,
      actor: actor(PILOT, "pilot"),
    }),
  );
  const afterCheckIn = await db.query.booking.findFirst({
    where: eq(booking.id, manualBooking.id),
  });
  check(
    "check-in sets checkedInAt and leaves the status alone",
    checkedIn.ok &&
      Boolean(afterCheckIn?.checkedInAt) &&
      afterCheckIn?.status === "approved",
    `${afterCheckIn?.status}, checkedInAt=${Boolean(afterCheckIn?.checkedInAt)}`,
  );

  const strangerCheckIn = await db.transaction((tx) =>
    checkInBooking(tx, {
      bookingId: manualBooking.id,
      actor: actor(REVIEWER, "admin"),
    }),
  );
  check(
    "somebody else cannot check in to a pilot's flight",
    !strangerCheckIn.ok,
    strangerCheckIn.ok ? "checked in" : strangerCheckIn.reason,
  );

  // --- 11. cancellation windows -------------------------------------------
  const soonId = await claimRaw(auto.id, droneId, rid!.id, hoursFromNow(1));
  const tooLate = await db.transaction((tx) =>
    cancelBookingByPilot(tx, {
      bookingId: soonId,
      actor: actor(PILOT, "pilot"),
    }),
  );
  check(
    "a pilot cancelling inside two hours of the slot is refused",
    !tooLate.ok && tooLate.reason === "cancel_too_late",
    tooLate.ok ? "cancelled" : tooLate.reason,
  );

  const authorityCancel = await db.transaction((tx) =>
    cancelBookingByAuthority(tx, {
      bookingId: soonId,
      actor: actor(ADMIN, "admin"),
      reason: "Unannounced state visit closing the airspace at short notice.",
    }),
  );
  check(
    "an authority can cancel the very same booking, with a reason",
    authorityCancel.ok,
    authorityCancel.ok ? "cancelled" : authorityCancel.reason,
  );

  const laterId = await claimRaw(auto.id, droneId, rid!.id, hoursFromNow(48));
  const inTime = await db.transaction((tx) =>
    cancelBookingByPilot(tx, {
      bookingId: laterId,
      actor: actor(PILOT, "pilot"),
    }),
  );
  check(
    "a pilot cancelling two days ahead succeeds",
    inTime.ok,
    inTime.ok ? "cancelled" : inTime.reason,
  );

  // --- 12. a refused decision leaves no trace -----------------------------
  const auditBefore = await countRows(auditEvent);
  const notifyBefore = await countRows(notification);
  const doomed = await db.transaction((tx) =>
    rejectBooking(tx, {
      bookingId: manualBooking.id,
      actor: actor(ADMIN, "admin"),
      reason: "short",
    }),
  );
  const stillApproved = await db.query.booking.findFirst({
    where: eq(booking.id, manualBooking.id),
  });
  check(
    "a refused decision writes no status, no audit event and no notification",
    !doomed.ok &&
      doomed.reason === "reason_required" &&
      stillApproved?.status === "approved" &&
      (await countRows(auditEvent)) === auditBefore &&
      (await countRows(notification)) === notifyBefore,
    `audit ${auditBefore}, notification ${notifyBefore}`,
  );

  // --- 13. the no-show rule self-heals ------------------------------------
  const now = new Date();
  for (let index = 0; index < 3; index++) {
    await db.insert(booking).values({
      pilotUserId: PILOT,
      droneId,
      remoteIdId: rid!.id,
      zoneId: auto.id,
      slotStart: new Date(now.getTime() - (10 + index) * 86_400_000),
      slotEnd: new Date(now.getTime() - (10 + index) * 86_400_000 + 3_600_000),
      seatIndex: index,
      status: "no_show",
    });
  }
  check(
    "three no-shows in 90 days switch off the auto-approve fast path",
    (await countRecentNoShows(null, PILOT, now)) === 3 &&
      !(await autoApproveEligible(null, PILOT, now)),
  );
  const later = new Date(now.getTime() + 91 * 86_400_000);
  check(
    "at 91 days it comes back with nobody resetting anything",
    (await countRecentNoShows(null, PILOT, later)) === 0 &&
      (await autoApproveEligible(null, PILOT, later)),
  );

  // --- 14. nothing updates or deletes an audit event ----------------------
  check(
    "the audit module exports no update and no delete",
    await auditIsAppendOnly(),
  );
}

// --- helpers ---------------------------------------------------------------

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 3_600_000);
}

async function droneStatus(droneId: string) {
  const row = await db.query.drone.findFirst({ where: eq(drone.id, droneId) });
  return row?.status;
}

async function makeDrone(label: string, buildType: "self_built" | "commercial" = "self_built") {
  const [row] = await db
    .insert(drone)
    .values({
      ownerUserId: PILOT,
      nickname: `${PROBE}-${label}`,
      // No serial number. A self-built airframe is the entire point.
      serialNumber: null,
      buildType,
      weightGrams: 900,
      weightClass: "light",
      status: "draft",
    })
    .returning({ id: drone.id });
  return row.id;
}

function fakeDecision(status: "allowed" | "needs_review") {
  return {
    status,
    zone: null,
    reasons: [],
    nextOpenAt: null,
    alternativeSlots: [],
    evaluatedAt: new Date().toISOString(),
    geometryVersion: 1,
  };
}

async function claimRaw(
  zoneId: string,
  droneId: string,
  remoteIdId: string,
  slotStart: Date,
) {
  const claimed = await createBookingWithSeat({
    pilotUserId: PILOT,
    droneId,
    remoteIdId,
    zoneId,
    slotStart,
    slotEnd: new Date(slotStart.getTime() + 3_600_000),
    capacity: 4,
    decisionSnapshot: fakeDecision("allowed"),
    actor: actor(PILOT, "pilot"),
  });
  if (!claimed.ok) throw new Error(`probe could not claim a seat: ${claimed.reason}`);
  return claimed.bookingId;
}

async function claimBooking(
  zoneId: string,
  droneId: string,
  remoteIdId: string,
  hour: number,
  autoApprove: boolean,
) {
  const slotStart = riyadhInstant(DAY, hour * 60);
  const claimed = await createBookingWithSeat({
    pilotUserId: PILOT,
    droneId,
    remoteIdId,
    zoneId,
    slotStart,
    slotEnd: riyadhInstant(DAY, (hour + 1) * 60),
    capacity: 4,
    decisionSnapshot: fakeDecision(autoApprove ? "allowed" : "needs_review"),
    actor: actor(PILOT, "pilot"),
    autoApprove: autoApprove
      ? { zoneNameAr: "منطقة", zoneNameEn: "Zone" }
      : undefined,
  });
  if (!claimed.ok) throw new Error(`probe could not claim a seat: ${claimed.reason}`);

  const row = await db.query.booking.findFirst({
    where: eq(booking.id, claimed.bookingId),
  });
  const events = await auditFor(claimed.bookingId);
  return {
    id: claimed.bookingId,
    status: row?.status ?? "?",
    actions: events.map((event) => event.action),
  };
}

/**
 * Append-only is a property of the module's surface, not of a row. Reading the
 * source is the honest check: an `update` or `delete` on `audit_event` anywhere
 * in `src/lib/audit.ts` would make the trail editable.
 */
async function auditIsAppendOnly(): Promise<boolean> {
  const source = await (await import("node:fs/promises")).readFile(
    "src/lib/audit.ts",
    "utf8",
  );
  return !/\.update\(|\.delete\(/.test(source);
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
    for (const rid of rids) {
      await db.delete(auditEvent).where(eq(auditEvent.entityId, rid.id));
    }
    const bookings = await db
      .select({ id: booking.id })
      .from(booking)
      .where(eq(booking.droneId, id));
    for (const row of bookings) {
      await db.delete(auditEvent).where(eq(auditEvent.entityId, row.id));
    }
    await db.delete(auditEvent).where(eq(auditEvent.entityId, id));
    await db.delete(booking).where(eq(booking.droneId, id));
    await db.delete(dronePhoto).where(eq(dronePhoto.droneId, id));
    await db.delete(remoteId).where(eq(remoteId.droneId, id));
    await db.delete(drone).where(eq(drone.id, id));
  }

  await db
    .delete(zoneClosure)
    .where(like(zoneClosure.reasonEn, "Probe closure%"));
  await db.delete(notification).where(like(notification.userId, `${PROBE}-%`));
  await db.delete(pilotProfile).where(like(pilotProfile.userId, `${PROBE}-%`));
  await db.delete(auditEvent).where(like(auditEvent.actorUserId, `${PROBE}-%`));
  await db.delete(user).where(like(user.id, `${PROBE}-%`));
}

try {
  await main();
} finally {
  await cleanup();
  const [left] = await db
    .select({ value: count() })
    .from(drone)
    .where(like(drone.nickname, `${PROBE}-%`));
  const [audits] = await db.select({ value: count() }).from(auditEvent);
  const [notifications] = await db.select({ value: count() }).from(notification);
  results.push(`--- probe drones left: ${left?.value ?? 0}`);
  results.push(
    `--- audit_event rows in the database now: ${audits?.value ?? 0}, notification: ${notifications?.value ?? 0}`,
  );
  console.log(`\nSlot day: ${DAY}\n`);
  console.log(results.join("\n"));
  process.exit(process.exitCode ?? 0);
}
