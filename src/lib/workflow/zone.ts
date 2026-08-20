import "server-only";

import { and, eq, gt, inArray, ne } from "drizzle-orm";
import { audit, type Actor } from "@/lib/audit";
import type { DbExecutor } from "@/lib/db";
import { booking, zone, zoneClosure, zoneHour } from "@/lib/db/schema";
import {
  publishReadiness,
  type PublishProblem,
} from "@/lib/validation/zone-publish";
import { applyTransition } from "./apply";

/**
 * **The publish lifecycle** — `draft → active → suspended → archived`, and the
 * consequences each edge has for the flights standing on the zone.
 *
 * Here rather than in `actions/admin.ts` for rule 11's reason: a zone's status
 * is a status, and no status is written outside this folder. The action's job
 * is the session, the rate limit and the revalidation; the decision about
 * whether a drawing may become airspace is this file's.
 *
 * Every edge is **admin only**, declared in `transitions.ts` and re-checked by
 * the action independently. Drawing airspace is not reviewing a submission.
 */

const LIVE_BOOKING_STATUSES = ["pending", "approved"] as const;

export type ZoneOutcome =
  | { ok: true; from: string; to: string }
  | {
      ok: false;
      reason:
        | "not_found"
        | "invalid_transition"
        | "already_applied"
        | "reason_required"
        | "archive_has_bookings"
        | PublishProblem;
      /** Codes of the no-fly zones blocking a publish, when that is the refusal. */
      overlappingNoFly?: string[];
    };

/**
 * Draft (or suspended) → active. **The moment a drawing becomes airspace.**
 *
 * `publishReadiness` decides, and it is the same pure function the editor runs
 * to grey the button — so the screen and the authority never disagree about
 * what is missing. The three reads it needs happen here because it is pure and
 * takes them as arguments; that is what keeps it testable without a database
 * and importable by the browser.
 */
export async function publishZone(
  tx: DbExecutor,
  { zoneId, actor }: { zoneId: string; actor: Actor },
): Promise<ZoneOutcome> {
  const row = await tx.query.zone.findFirst({ where: eq(zone.id, zoneId) });
  if (!row) return { ok: false, reason: "not_found" };

  const hours = await tx
    .select({
      weekday: zoneHour.weekday,
      opensMinute: zoneHour.opensMinute,
      closesMinute: zoneHour.closesMinute,
    })
    .from(zoneHour)
    .where(eq(zoneHour.zoneId, zoneId));

  /**
   * **Published** no-fly zones only, and never this zone itself. A draft no-fly
   * zone is invisible to pilots and to the engine, so refusing a publication
   * for overlapping something nobody has published would be refusing on the
   * strength of a drawing.
   */
  const noFly = await tx
    .select({ code: zone.code, geometry: zone.geometry })
    .from(zone)
    .where(
      and(eq(zone.kind, "no_fly"), eq(zone.status, "active"), ne(zone.id, zoneId)),
    );

  const readiness = publishReadiness(
    {
      kind: row.kind,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      capacity: row.capacity,
      geometry: row.geometry,
    },
    hours.map((hour) => ({
      weekday: hour.weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      opensMinute: hour.opensMinute,
      closesMinute: hour.closesMinute,
    })),
    noFly,
  );

  if (!readiness.ok) {
    return {
      ok: false,
      reason: readiness.problems[0],
      overlappingNoFly: readiness.overlappingNoFly,
    };
  }

  return applyTransition(
    {
      transition: "zone.published",
      id: zoneId,
      actor,
      // Set on the first publication and left alone afterwards: it answers
      // "since when has this been airspace", which a suspension does not undo.
      patch: row.publishedAt ? {} : { publishedAt: new Date() },
    },
    tx,
  );
}

/**
 * Active → suspended. Reversible, which is what separates it from archiving.
 *
 * **The bookings are not cancelled here.** The status change and its audit
 * event commit first; the fan-out that cancels each future booking and emails
 * each pilot is an Inngest job the action sends afterwards, one step per
 * booking — for the same reason the closure fan-out is: a failing email must
 * retry one pilot, not all of them, and must never roll back the suspension.
 *
 * The reason is required in **both languages** because it is quoted verbatim
 * to every affected pilot in theirs. Arabic is the authored one and the one the
 * trail records; the English travels on the event to the pilots who read it.
 */
export async function suspendZone(
  tx: DbExecutor,
  {
    zoneId,
    actor,
    reasonAr,
    reasonEn,
  }: { zoneId: string; actor: Actor; reasonAr: string; reasonEn: string },
): Promise<ZoneOutcome> {
  /**
   * **Both languages, not only English.** The first version checked the English
   * alone; the panel disables its button until both are twenty characters, so
   * nothing on screen could reach it — but an action is an ordinary POST, and a
   * closure or suspension published with a blank Arabic reason would quote an
   * empty string verbatim to every Arabic-reading pilot whose flight it just
   * cancelled. That is the audience this app is written for first.
   */
  if (reasonAr.trim().length < 20 || reasonEn.trim().length < 20) {
    return { ok: false, reason: "reason_required" };
  }

  const outcome = await applyTransition(
    {
      transition: "zone.suspended",
      id: zoneId,
      actor,
      /**
       * **Stored in Arabic, the authored language**, exactly as the closure
       * fan-out stores a closure's. The English text travels on the event to
       * the pilots who read English; the row and the trail keep the original.
       * No column holds it — `audit_event.reason` is the record, and adding a
       * `suspensionReason` pair to `zone` would be a second copy that the next
       * suspension silently overwrites.
       */
      reason: reasonAr,
    },
    tx,
  );

  return outcome;
}

/**
 * The end of a zone. **Refused while any future booking still stands** — a
 * booking that survives its zone being archived is a flight authorised in
 * airspace that no longer exists, and archiving is not a cancellation. Suspend
 * first: that path cancels, tells each pilot why, and is reversible if it turns
 * out to have been a mistake.
 */
export async function archiveZone(
  tx: DbExecutor,
  { zoneId, actor, now = new Date() }: { zoneId: string; actor: Actor; now?: Date },
): Promise<ZoneOutcome> {
  const live = await countFutureBookings(tx, zoneId, now);
  if (live > 0) return { ok: false, reason: "archive_has_bookings" };

  return applyTransition({ transition: "zone.archived", id: zoneId, actor }, tx);
}

/** Live bookings whose slot has not yet ended. The number every screen shows. */
export async function countFutureBookings(
  tx: DbExecutor,
  zoneId: string,
  now: Date,
): Promise<number> {
  const rows = await tx
    .select({ id: booking.id })
    .from(booking)
    .where(
      and(
        eq(booking.zoneId, zoneId),
        inArray(booking.status, [...LIVE_BOOKING_STATUSES]),
        gt(booking.slotEnd, now),
      ),
    );
  return rows.length;
}

/**
 * A published boundary moved, so every approved flight inside it goes back to a
 * human. **Flagged, never cancelled.**
 *
 * A booking names a zone and carries no launch point (threads 37 and 55), so
 * nothing in the row can say whether *this* flight was in the part that was cut
 * away. Cancelling on that basis would void authorised flights on a guess;
 * leaving them approved would let one stand on airspace that no longer includes
 * it. Sending them back to `pending` is the third answer: the seat is held —
 * `booking_seat_uniq` covers both statuses — the pilot is told, and a reviewer
 * decides with the new boundary in front of them. `workflow/booking.ts`
 * re-runs `evaluateAirspace` before it lets the re-approval through.
 *
 * `pending` bookings are left alone: they are already in the queue, and the
 * reviewer opening one will see the current geometry regardless.
 */
export async function flagBookingsForGeometryReview(
  tx: DbExecutor,
  {
    zoneId,
    actor,
    zoneNameAr,
    zoneNameEn,
    now = new Date(),
  }: {
    zoneId: string;
    actor: Actor;
    zoneNameAr: string;
    zoneNameEn: string;
    now?: Date;
  },
): Promise<{ flagged: number }> {
  const rows = await tx
    .select({ id: booking.id, pilotUserId: booking.pilotUserId })
    .from(booking)
    .where(
      and(
        eq(booking.zoneId, zoneId),
        eq(booking.status, "approved"),
        gt(booking.slotEnd, now),
      ),
    );

  let flagged = 0;
  for (const row of rows) {
    const outcome = await applyTransition(
      {
        transition: "booking.flagged_for_review",
        id: row.id,
        actor,
        notification: {
          userId: row.pilotUserId,
          type: "bookingUnderReview",
          params: { zoneAr: zoneNameAr, zoneEn: zoneNameEn },
          entityType: "booking",
          entityId: row.id,
          href: `/bookings/${row.id}`,
          // No category. A flight that has stopped being authorised is not a
          // preference a pilot can mute.
        },
      },
      tx,
    );
    if (outcome.ok) flagged += 1;
  }

  return { flagged };
}

/**
 * The whole week, replaced in one write.
 *
 * **Replace, not merge.** The grid is edited as a week and saved as a week, and
 * a merge would need the client to send deletions — which is a second way to
 * say the same thing and a second way to get it wrong. The delete and the
 * insert are in the caller's transaction, so a zone is never briefly open at no
 * hours at all.
 *
 * Not a status change, so no `applyTransition` — but it is in this folder
 * anyway, because opening hours are what decide whether a published zone
 * produces any slots, and that is as consequential as a status.
 */
export async function setZoneHours(
  tx: DbExecutor,
  {
    zoneId,
    actor,
    windows,
  }: {
    zoneId: string;
    actor: Actor;
    windows: readonly {
      weekday: number;
      opensMinute: number;
      closesMinute: number;
    }[];
  },
): Promise<void> {
  const before = await tx
    .select({
      weekday: zoneHour.weekday,
      opensMinute: zoneHour.opensMinute,
      closesMinute: zoneHour.closesMinute,
    })
    .from(zoneHour)
    .where(eq(zoneHour.zoneId, zoneId));

  await tx.delete(zoneHour).where(eq(zoneHour.zoneId, zoneId));
  if (windows.length > 0) {
    await tx
      .insert(zoneHour)
      .values(windows.map((window) => ({ zoneId, ...window })));
  }

  await audit(tx, {
    actor,
    entityType: "zone",
    entityId: zoneId,
    action: "zone.hours_changed",
    before: { hours: before },
    after: { hours: windows },
  });
}

// --- Closures: the NOTAM analogue ------------------------------------------

export type ClosureOutcome<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      reason:
        | "not_found"
        | "zone_not_publishable"
        | "already_applied"
        | "closure_published";
    };

/**
 * Write a closure. **Unpublished**, always.
 *
 * A closure is created and published in two acts, deliberately, and it is the
 * same seam as a zone's own draft: an unpublished closure is invisible to the
 * engine (`listClosuresForZones` filters on `published_at`), refuses nothing
 * and cancels nobody, so an admin can type a window, look at the flights it
 * would cancel **by name**, and then decide. One-shot creation would make the
 * preview a promise about what is *about* to happen rather than a statement
 * about a row that exists.
 *
 * **Only a zone somebody could fly in can be closed.** Closing a draft is
 * closing something no pilot can see; closing an archived zone is closing
 * something that no longer exists. Both would produce a row that can never
 * refuse anything, and a trail with acts in it that did nothing is worse than
 * one without them.
 */
export async function createZoneClosure(
  tx: DbExecutor,
  {
    zoneId,
    actor,
    startsAt,
    endsAt,
    reasonAr,
    reasonEn,
    authorityRef,
  }: {
    zoneId: string;
    actor: Actor;
    startsAt: Date;
    endsAt: Date;
    reasonAr: string;
    reasonEn: string;
    authorityRef: string | null;
  },
): Promise<ClosureOutcome<{ closureId: string }>> {
  const row = await tx.query.zone.findFirst({ where: eq(zone.id, zoneId) });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status !== "active" && row.status !== "suspended") {
    return { ok: false, reason: "zone_not_publishable" };
  }

  const [created] = await tx
    .insert(zoneClosure)
    .values({
      zoneId,
      startsAt,
      endsAt,
      reasonAr,
      reasonEn,
      authorityRef,
      createdByUserId: actor.userId,
    })
    .returning({ id: zoneClosure.id });

  await audit(tx, {
    actor,
    entityType: "zone_closure",
    entityId: created.id,
    action: "zone_closure.created",
    after: {
      zoneId,
      zoneCode: row.code,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      authorityRef,
    },
    // The authored language, as every other reason in this file is stored.
    reason: reasonAr,
  });

  return { ok: true, data: { closureId: created.id } };
}

/**
 * The moment a closure starts refusing flights.
 *
 * **`publishedAt` is stamped once and only once.** The fan-out that cancels
 * each overlapping booking is an Inngest job the *action* sends after this
 * commits — never from inside the transaction — for the closure fan-out's own
 * reason: a failing email must retry one pilot rather than roll back a closure
 * the engine is already enforcing.
 *
 * A second publish answers `already_applied` and writes nothing, so a
 * double-clicked button cannot cancel a pilot's booking twice or send them the
 * same cancellation twice.
 */
export async function publishZoneClosure(
  tx: DbExecutor,
  { closureId, actor }: { closureId: string; actor: Actor },
): Promise<ClosureOutcome<{ zoneId: string; publishedAt: Date }>> {
  const row = await tx.query.zoneClosure.findFirst({
    where: eq(zoneClosure.id, closureId),
  });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.publishedAt) return { ok: false, reason: "already_applied" };

  const publishedAt = new Date();
  await tx
    .update(zoneClosure)
    .set({ publishedAt, updatedAt: publishedAt })
    .where(eq(zoneClosure.id, closureId));

  await audit(tx, {
    actor,
    entityType: "zone_closure",
    entityId: closureId,
    action: "zone_closure.published",
    before: { publishedAt: null },
    after: {
      publishedAt: publishedAt.toISOString(),
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
    },
    reason: row.reasonAr,
  });

  return { ok: true, data: { zoneId: row.zoneId, publishedAt } };
}

/**
 * Delete a closure that was never published.
 *
 * **A published closure is not deletable**, and the refusal says so rather than
 * quietly obeying. Publishing one cancels flights and emails pilots; removing
 * the row afterwards would reopen the airspace while leaving every one of those
 * cancellations standing, and would delete the only record of why they
 * happened. Lifting a closure that is already in force is a different act with
 * different consequences, and this build does not have it — see the build log.
 */
export async function withdrawZoneClosure(
  tx: DbExecutor,
  { closureId, actor }: { closureId: string; actor: Actor },
): Promise<ClosureOutcome<{ zoneId: string }>> {
  const row = await tx.query.zoneClosure.findFirst({
    where: eq(zoneClosure.id, closureId),
  });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.publishedAt) return { ok: false, reason: "closure_published" };

  await audit(tx, {
    actor,
    entityType: "zone_closure",
    entityId: closureId,
    action: "zone_closure.withdrawn",
    before: {
      zoneId: row.zoneId,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
    },
    reason: row.reasonAr,
  });

  /**
   * The audit event is written **before** the row goes, in the same
   * transaction. The table is append-only and outlives what it describes — a
   * closure nobody published is still a thing somebody drafted and then thought
   * better of, and the trail is the only place that survives.
   */
  await tx.delete(zoneClosure).where(eq(zoneClosure.id, closureId));

  return { ok: true, data: { zoneId: row.zoneId } };
}
