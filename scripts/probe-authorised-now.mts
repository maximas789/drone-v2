/**
 * F24 probe. **Throwaway** — the one row it writes, it deletes.
 *
 * One job: put an **approved booking whose slot contains *now*** in front of
 * `/admin/lookup`, so that the "Is this drone authorised to be flying right
 * now?" panel can actually be seen answering **yes**, with its zone and slot.
 *
 * **Why it cannot be done through the app.** Approval is a reviewer act and
 * F22c's four-eyes rule refuses a reviewer deciding their own request — and
 * this build has exactly one account, which owns every aircraft and every
 * booking (open thread 64). Booking a slot that has already started is refused
 * too, correctly. So the yes branch is unreachable from the UI until a second
 * account exists, and shipping the single most important panel in F24 unopened
 * was the alternative.
 *
 * **The row is a plain insert, not a transition through `src/lib/workflow/`.**
 * Same call, and the same stated cost, as `probe-drone-states.mts`: F14 proved
 * every booking edge against the live database, so what this row is for is
 * *rendering*. It therefore has **no audit events**, and its slot does not
 * correspond to anything `deriveSlots` would offer. Nothing in the app writes a
 * booking this way — this file is not a template.
 *
 *   pnpm exec tsx scripts/probe-authorised-now.mts        # write
 *   pnpm exec tsx scripts/probe-authorised-now.mts clean  # remove
 */
import { existsSync } from "node:fs";
import { and, eq, like } from "drizzle-orm";

if (existsSync(".env")) process.loadEnvFile(".env");

const { db } = await import("@/lib/db/client");
const schema = await import("@/lib/db/schema");
const { booking, drone, remoteId, zone } = schema;

/** In the purpose text, so an interrupted run still leaves something findable. */
const MARKER = "PROBE24";

const clean = process.argv[2] === "clean";

if (clean) {
  const gone = await db
    .delete(booking)
    .where(like(booking.purpose, `%${MARKER}%`))
    .returning({ id: booking.id });
  console.log(`removed ${gone.length} probe booking(s)`);
  process.exit(0);
}

const code = process.argv[2] ?? "AJN-7Q4M-31KD";

const [target] = await db
  .select({
    droneId: drone.id,
    ownerUserId: drone.ownerUserId,
    remoteIdId: remoteId.id,
  })
  .from(remoteId)
  .innerJoin(drone, eq(drone.id, remoteId.droneId))
  .where(eq(remoteId.code, code));

if (!target) {
  console.error(`no registration for ${code}`);
  process.exit(1);
}

const [permitted] = await db
  .select({ id: zone.id, nameAr: zone.nameAr })
  .from(zone)
  .where(and(eq(zone.kind, "permitted"), eq(zone.status, "active")))
  .limit(1);

if (!permitted) {
  console.error("no active permitted zone — run pnpm db:seed");
  process.exit(1);
}

const now = new Date();
const slotStart = new Date(now.getTime() - 60 * 60 * 1000);
const slotEnd = new Date(now.getTime() + 60 * 60 * 1000);

// `drone.owner_user_id` is nullable since F28c (null = the owner deleted
// their account). A probe wants a real pilot, so this asserts rather than
// silently booking for nobody.
const pilotUserId = target.ownerUserId;
if (!pilotUserId) throw new Error("probe: target has no owner");

const [row] = await db
  .insert(booking)
  .values({
    zoneId: permitted.id,
    droneId: target.droneId,
    remoteIdId: target.remoteIdId,
    pilotUserId,
    slotStart,
    slotEnd,
    // Seat 0 of a slot nothing else holds — `booking_seat_uniq` is partial on
    // (zone, slotStart, seatIndex) and this start time is not on any grid.
    seatIndex: 0,
    status: "approved",
    purpose: `${MARKER} — render probe for the "authorised right now" panel`,
  })
  .returning({ id: booking.id });

console.log(
  `wrote approved booking ${row?.id} on ${permitted.nameAr}, ` +
    `${slotStart.toISOString()} → ${slotEnd.toISOString()}`,
);
process.exit(0);
