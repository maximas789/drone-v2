/**
 * F28c probe. **Throwaway, self-cleaning, and the only safe way to run this.**
 *
 * Account deletion is the one path in this app that destroys real data, and it
 * cannot be checked by clicking it: the only accounts on this machine are the
 * user's own admin and the reviewer, and deleting either to see what happens is
 * exactly the mistake the feature has to be trusted not to make.
 *
 * So this builds a **synthetic pilot** with the full set of things deletion has
 * to reason about — a drone, a Remote ID, an approved future booking, a
 * co-pilot, a notification, a preference row, an audit event — then:
 *
 * 1. asserts `deletionBlock` **refuses** while the approved future booking
 *    stands, and names it;
 * 2. cancels it and asserts the block clears;
 * 3. runs the real `deleteAccount`;
 * 4. asserts, against the database, what survived and what did not.
 *
 * **It calls the same functions the server action calls.** A probe that
 * re-implemented the deletion would prove the probe works.
 *
 *   pnpm exec tsx scripts/probe-account-deletion.mts
 *
 * It leaves nothing behind on success. On failure it prints what it found and
 * leaves the rows, so they can be inspected — they are all prefixed `probe-`.
 */
import { existsSync } from "node:fs";
import { and, eq, isNull } from "drizzle-orm";

if (existsSync(".env")) process.loadEnvFile(".env");

const { db } = await import("@/lib/db");
const schema = await import("@/lib/db/schema");
const authSchema = await import("@/lib/db/auth-schema");
const { deleteAccount, deletionBlock } = await import(
  "@/lib/data/account-deletion"
);

const {
  booking,
  bookingCopilot,
  drone,
  dronePhoto,
  auditEvent,
  notification,
  notificationPreference,
  pilotProfile,
  remoteId,
  zone,
} = schema;
const { user } = authSchema;

const ID = `probe-del-${Date.now()}`;
const EMAIL = `${ID}@example.invalid`;

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? "  ok  " : "  FAIL"}  ${label}${ok ? "" : `\n          expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`,
  );
}

// --- build the pilot -------------------------------------------------------

const targetZone = await db.query.zone.findFirst({
  where: eq(zone.status, "active"),
});
if (!targetZone) throw new Error("probe: no active zone — run pnpm db:seed");

await db.insert(user).values({
  id: ID,
  name: "Probe Pilot",
  email: EMAIL,
  emailVerified: true,
  role: "pilot",
});

await db.insert(pilotProfile).values({
  userId: ID,
  fullNameAr: "طيار اختباري",
  fullNameEn: "Probe Pilot",
  idDocumentType: "saudi_national_id",
  idDocumentNumber: "1999999999",
  idDocumentHash: `probe-hash-${Date.now()}`,
});

const [droneRow] = await db
  .insert(drone)
  .values({
    ownerUserId: ID,
    nickname: "probe drone",
    buildType: "self_built",
    weightClass: "micro",
    weightGrams: 249,
    hasCamera: false,
    status: "approved",
    registrationIssuedAt: new Date(),
    registrationExpiresAt: new Date(Date.now() + 86_400_000),
  })
  .returning({ id: drone.id });

const [ridRow] = await db
  .insert(remoteId)
  .values({ droneId: droneRow.id, code: `PROBE-${Date.now() % 100000}` })
  .returning({ id: remoteId.id, code: remoteId.code });

await db.insert(dronePhoto).values({
  droneId: droneRow.id,
  url: "/probe.jpg",
  // Deliberately a path no driver will find: the loop must survive a failed
  // delete, and this is what proves it does.
  pathname: `probe/${ID}/missing.jpg`,
});

const [bookingRow] = await db
  .insert(booking)
  .values({
    pilotUserId: ID,
    droneId: droneRow.id,
    remoteIdId: ridRow.id,
    zoneId: targetZone.id,
    slotStart: new Date(Date.now() + 7 * 86_400_000),
    slotEnd: new Date(Date.now() + 7 * 86_400_000 + 3_600_000),
    seatIndex: 99,
    status: "approved",
  })
  .returning({ id: booking.id });

await db.insert(bookingCopilot).values({
  bookingId: bookingRow.id,
  fullNameAr: "مرافق",
  fullNameEn: "Copilot",
});

await db.insert(notification).values({ userId: ID, type: "droneApproved" });
await db
  .insert(notificationPreference)
  .values({ userId: ID, category: "booking_reminder" });
await db.insert(auditEvent).values({
  actorUserId: ID,
  entityType: "drone",
  entityId: droneRow.id,
  action: "drone.approved",
});

const session = {
  user: { id: ID, email: EMAIL, role: "pilot" },
  session: { id: "probe", token: "probe" },
} as unknown as Parameters<typeof deletionBlock>[0];

console.log(`\nprobe pilot ${ID}\n`);

// --- 1. the refusal --------------------------------------------------------

const blocked = await deletionBlock(session);
check("blocked while an approved future booking stands", blocked?.reason, "approved_bookings");
check(
  "the refusal names the booking",
  blocked?.reason === "approved_bookings" ? blocked.bookings.length : 0,
  1,
);

// --- 2. the block is about *future* flights ---------------------------------

/**
 * The slot is moved into the past rather than the status changed to
 * `cancelled`. Two reasons, and the second is the better one:
 *
 * - ESLint rule 11 forbids a status write outside `src/lib/workflow/`, and it
 *   is right to: a probe reaching past `applyTransition` is a probe that proves
 *   something the app cannot do.
 * - It tests the half of the predicate that is easier to get wrong. That an
 *   approved booking blocks is obvious; that a **finished** one does not is the
 *   clause somebody could drop from the `where` without any test noticing.
 */
await db
  .update(booking)
  .set({
    slotStart: new Date(Date.now() - 2 * 86_400_000),
    slotEnd: new Date(Date.now() - 2 * 86_400_000 + 3_600_000),
  })
  .where(eq(booking.id, bookingRow.id));

check("a past approved booking does not block", await deletionBlock(session), null);

// --- 3. delete -------------------------------------------------------------

const summary = await deleteAccount(
  session,
  { userId: ID, role: "pilot", isSystem: false },
  { ipHash: null, userAgent: "probe" },
);
console.log("\nsummary:", summary, "\n");

check("one drone anonymised", summary.dronesAnonymised, 1);
check("one booking deleted", summary.bookingsDeleted, 1);
check("one photo row deleted", summary.photosDeleted, 1);

// --- 4. what survived ------------------------------------------------------

const [account, profile, prefs, notes, bookings, copilots, photos] =
  await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, ID) }),
    db.query.pilotProfile.findFirst({ where: eq(pilotProfile.userId, ID) }),
    db.query.notificationPreference.findFirst({
      where: eq(notificationPreference.userId, ID),
    }),
    db.query.notification.findFirst({ where: eq(notification.userId, ID) }),
    db.query.booking.findFirst({ where: eq(booking.id, bookingRow.id) }),
    db.query.bookingCopilot.findFirst({
      where: eq(bookingCopilot.bookingId, bookingRow.id),
    }),
    db.query.dronePhoto.findFirst({ where: eq(dronePhoto.droneId, droneRow.id) }),
  ]);

check("account gone", account, undefined);
check("pilot profile gone (cascade)", profile, undefined);
check("notification preference gone (cascade)", prefs, undefined);
check("notification gone (cascade)", notes, undefined);
check("booking gone", bookings, undefined);
check("co-pilot gone (cascade from booking)", copilots, undefined);
check("drone photo row gone", photos, undefined);

const survivingDrone = await db.query.drone.findFirst({
  where: eq(drone.id, droneRow.id),
});
check("drone row SURVIVES", Boolean(survivingDrone), true);
check("…with no owner", survivingDrone?.ownerUserId ?? null, null);

const survivingRid = await db.query.remoteId.findFirst({
  where: eq(remoteId.id, ridRow.id),
});
check("remote ID SURVIVES", survivingRid?.code ?? null, ridRow.code);

const trail = await db.query.auditEvent.findMany({
  where: and(eq(auditEvent.entityId, droneRow.id)),
});
check("the pilot's audit event SURVIVES", trail.length, 1);
check("…with its actor cleared", trail[0]?.actorUserId ?? null, null);

const deletionEvent = await db.query.auditEvent.findFirst({
  where: and(eq(auditEvent.action, "user.deleted"), eq(auditEvent.entityId, ID)),
});
check("a user.deleted event was written", Boolean(deletionEvent), true);
check("…and it too has no actor", deletionEvent?.actorUserId ?? null, null);

// The whole point of the surviving Remote ID.
const { registrationStatusOf } = await import("@/lib/remote-id/redact");
check(
  "the code now resolves as withdrawn",
  registrationStatusOf({
    remoteIdStatus: survivingRid?.status ?? "active",
    droneStatus: survivingDrone?.status ?? "approved",
    validUntil: survivingDrone?.registrationExpiresAt ?? null,
    ownerUserId: survivingDrone?.ownerUserId ?? null,
  }),
  "withdrawn",
);

// --- clean up --------------------------------------------------------------

if (failures === 0) {
  await db.delete(remoteId).where(eq(remoteId.id, ridRow.id));
  await db.delete(drone).where(eq(drone.id, droneRow.id));
  await db.delete(auditEvent).where(isNull(auditEvent.actorUserId) && eq(auditEvent.entityId, ID));
  await db.delete(auditEvent).where(eq(auditEvent.entityId, droneRow.id));
  await db.delete(auditEvent).where(eq(auditEvent.entityId, ID));
  console.log("\ncleaned up.");
} else {
  console.log(`\n${failures} FAILURES — rows left in place for inspection (${ID}).`);
}

console.log(failures === 0 ? "\nPASS\n" : "\nFAIL\n");
process.exit(failures === 0 ? 0 : 1);
