/**
 * F31 gate, check 10 — **cross-check account A against account B.**
 *
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx scripts/verify/two-accounts.mts
 *
 * Ownership lives in `src/lib/data/*.ts` and every exported function there
 * takes the session first (CLAUDE.md rule 8). So this asks each reader the
 * question directly, with the wrong session, in **both directions** — pilot B
 * against pilot A's rows and pilot A against pilot B's — rather than only
 * against the one real account, which is an admin and would be allowed through
 * by design.
 *
 * It also asks each **staff-only** reader with a pilot session. Those return an
 * empty page rather than throwing, which is right for a component and easy to
 * get wrong: an empty list is what a pilot must see, not a partial one.
 *
 * What this cannot do is press the buttons. A signed-in browser session needs a
 * password and the assistant may not enter one — the `/admin` half is covered
 * over HTTP by `routes.mts` (fabricated cookie → 404) and by hand in F31b.
 *
 * **Throwaway**: two probe pilots, their rows, and nothing else. Both deleted.
 */
import { existsSync } from "node:fs";
import { eq, like } from "drizzle-orm";

if (existsSync(".env")) process.loadEnvFile(".env");

const { db } = await import("@/lib/db");
const { user } = await import("@/lib/db/auth-schema");
const { drone, dronePhoto, notification, pilotProfile } = await import(
  "@/lib/db/schema"
);
const droneData = await import("@/lib/data/drone");
const bookingData = await import("@/lib/data/booking");
const pilotData = await import("@/lib/data/pilot");
const notificationData = await import("@/lib/data/notification");
const auditData = await import("@/lib/data/audit");

const PROBE = "probe-2acct";

const results: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

/** Enough of a session for the data layer. This is not an auth test. */
function pilotSession(id: string) {
  return { user: { id, role: "pilot" } } as unknown as Parameters<
    typeof droneData.listMyDrones
  >[0];
}

async function cleanup() {
  const probes = await db
    .select({ id: user.id })
    .from(user)
    .where(like(user.id, `${PROBE}%`));
  for (const p of probes) {
    const owned = await db
      .select({ id: drone.id })
      .from(drone)
      .where(eq(drone.ownerUserId, p.id));
    for (const d of owned) {
      await db.delete(dronePhoto).where(eq(dronePhoto.droneId, d.id));
      await db.delete(drone).where(eq(drone.id, d.id));
    }
    await db.delete(notification).where(eq(notification.userId, p.id));
    await db.delete(pilotProfile).where(eq(pilotProfile.userId, p.id));
    await db.delete(user).where(eq(user.id, p.id));
  }
}

await cleanup();
if (process.argv.includes("clean")) {
  console.log("cleaned only — nothing written");
  process.exit(0);
}

// --- the two probe pilots -------------------------------------------------

async function makePilot(suffix: string) {
  const id = `${PROBE}-${suffix}`;
  await db.insert(user).values({
    id,
    name: `طيار ${suffix}`,
    email: `${id}@example.test`,
  });
  await db.insert(pilotProfile).values({
    userId: id,
    fullNameAr: `طيار ${suffix}`,
    fullNameEn: `Probe ${suffix}`,
    idDocumentType: "saudi_national_id",
    idDocumentNumber: `000000000${suffix === "a" ? 1 : 2}`,
    idDocumentHash: `${id}-hash`,
    completedAt: new Date(),
  });
  const [d] = await db
    .insert(drone)
    .values({
      ownerUserId: id,
      nickname: `${PROBE} ${suffix}`,
      buildType: "self_built",
      weightGrams: 300,
      weightClass: "micro",
      serialNumber: null,
      status: "draft",
    })
    .returning({ id: drone.id });
  await db.insert(dronePhoto).values({
    droneId: d!.id,
    url: `/api/files/${id}/photo.jpg`,
    pathname: `${id}/photo.jpg`,
    kind: "overall",
  });
  const [n] = await db
    .insert(notification)
    .values({
      userId: id,
      type: "droneApproved",
      params: { drone: `${PROBE} ${suffix}` },
      entityType: "drone",
      entityId: d!.id,
    })
    .returning({ id: notification.id });
  return { id, session: pilotSession(id), droneId: d!.id, notificationId: n!.id };
}

const A = await makePilot("a");
const B = await makePilot("b");

// --- B against A's rows, and A against B's -------------------------------

for (const [name, self, other] of [
  ["B → A", B, A],
  ["A → B", A, B],
] as const) {
  check(
    `${name} getDroneById is null`,
    (await droneData.getDroneById(self.session, other.droneId)) === null,
  );
  check(
    `${name} getMyDroneDetail is null`,
    (await droneData.getMyDroneDetail(self.session, other.droneId)) === null,
  );
  check(
    `${name} getDronePhotos is empty`,
    (await droneData.getDronePhotos(self.session, other.droneId)).length === 0,
  );
  check(
    `${name} getRemoteIdForDrone is null`,
    (await droneData.getRemoteIdForDrone(self.session, other.droneId)) == null,
  );
  check(
    `${name} getProfileByUserId is null`,
    (await pilotData.getProfileByUserId(self.session, other.id)) == null,
  );
  check(
    `${name} markNotificationRead refuses`,
    (await notificationData.markNotificationRead(
      self.session,
      other.notificationId,
    )) === false,
  );
  const mine = await droneData.listMyDrones(self.session);
  check(
    `${name} listMyDrones shows only its own`,
    mine.every((d) => d.ownerUserId === self.id),
    `${mine.length} row(s)`,
  );
  const notes = await notificationData.listMyNotifications(self.session);
  check(
    `${name} listMyNotifications shows only its own`,
    notes.every((n) => n.userId === self.id),
    `${notes.length} row(s)`,
  );
}

// --- B against the *real* account's rows ----------------------------------
// The rows a demo actually shows. A scoping bug that only misses the seeded
// data is still a scoping bug.

const [realDrone] = await db
  .select({ id: drone.id })
  .from(drone)
  .where(like(drone.nickname, "%"))
  .limit(1);
const realBooking = (await db.query.booking.findFirst())?.id;

if (realDrone && realDrone.id !== A.droneId && realDrone.id !== B.droneId) {
  check(
    "B → the real account's drone is null",
    (await droneData.getDroneById(B.session, realDrone.id)) === null,
  );
}
if (realBooking) {
  check(
    "B → the real account's booking is null",
    (await bookingData.getBookingById(B.session, realBooking)) == null,
  );
  check(
    "B → its copilots are empty",
    (await bookingData.getBookingCopilots(B.session, realBooking)).length === 0,
  );
}

// --- staff-only readers, asked with a pilot session -----------------------

check(
  "listPendingDrones is empty for a pilot",
  (await droneData.listPendingDrones(B.session)).length === 0,
);
check(
  "countPendingDrones is 0 for a pilot",
  (await droneData.countPendingDrones(B.session)) === 0,
);
check(
  "listPendingBookings is empty for a pilot",
  (await bookingData.listPendingBookings(B.session)).length === 0,
);
check(
  "listPendingIdentityVerifications is empty for a pilot",
  (await pilotData.listPendingIdentityVerifications(B.session)).length === 0,
);
check(
  "listAuditEvents is empty for a pilot",
  (await auditData.listAuditEvents(B.session)).rows.length === 0,
);
check(
  "listIdentityReveals is empty for a pilot",
  (await auditData.listIdentityReveals(B.session)).length === 0,
);

// --- report ---------------------------------------------------------------

await cleanup();
console.log(results.join("\n"));
console.log(
  `\n${results.filter((r) => r.startsWith("OK")).length}/${results.length} — both probe pilots deleted`,
);
process.exit(process.exitCode ?? 0);
