"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { refuse, refuseWith, type ActionResult } from "@/lib/actions/result";
import { audit, type Actor } from "@/lib/audit";
import { getSession } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { city, zone } from "@/lib/db/schema";
import { validateGeometry } from "@/lib/geo/validate";
import { inngest } from "@/lib/inngest/client";
import { zoneSuspendedEvent } from "@/lib/inngest/events";
import { enforceLimit } from "@/lib/rate-limit";
import { listZoneBookingImpact } from "@/lib/data/zone-admin";
import { isAdmin, roleOf, type Session } from "@/lib/session";
import {
  validateZone,
  type ZoneDraft,
  type ZoneProblem,
} from "@/lib/validation/zone";
import {
  validateZoneHours,
  type HourWindow,
} from "@/lib/validation/zone-hours";
import { geometryShrinks } from "@/lib/validation/zone-publish";
import {
  archiveZone,
  flagBookingsForGeometryReview,
  publishZone,
  setZoneHours,
  suspendZone,
} from "@/lib/workflow";

/**
 * Writing the airspace itself. **Admin only, every one of them.**
 *
 * `requireReviewer` is not enough here and never will be: a reviewer decides
 * about what pilots submit, an admin decides where anybody may fly at all.
 * Every action re-checks the session for itself — an action is an ordinary POST
 * and the `(admin)` layout that guarded the page never runs for it — and
 * answers `not_found` rather than `forbidden`, so a refusal does not confirm
 * the surface exists.
 *
 * **The geometry is validated here, not in the browser.** The editor checks as
 * you draw because that is a kinder way to find out; this is the check that
 * decides, over whatever JSON actually arrived. `validateGeometry` is the same
 * pure function both call.
 *
 * **`bbox` and `vertexCount` are computed, never accepted.** A caller posting
 * its own bounding box is posting a claim about which map viewports will find
 * the zone — and a wrong one makes a zone silently invisible to the viewport
 * query while still being enforced by the engine, which is the worst pair of
 * behaviours available.
 *
 * **No status is written in this file.** Rule 11 puts every status change in
 * `src/lib/workflow/`; the lifecycle actions at the foot of this file are the
 * session, the rate limit and the revalidation around a call into
 * `workflow/zone.ts`, which is where the decision lives.
 */

const MAX_TEXT_LENGTH = 2_000;

export type ZoneSaved = {
  id: string;
  /** Warnings the geometry check repaired — rings closed, winding corrected. */
  warnings: string[];
  /** Approved flights sent back to a reviewer by a moved boundary. */
  flagged?: number;
};

/**
 * Both write paths share everything except the row they end at, so they share
 * the checking too. Anything that differs between create and update is decided
 * by the caller and passed in.
 */
async function checkedZoneInput(
  session: Session | null,
  draft: ZoneDraft,
  geometry: unknown,
) {
  if (!session) return { ok: false as const, result: refuse("not_authenticated") };
  if (!isAdmin(session)) return { ok: false as const, result: refuse("not_found") };

  const limit = await enforceLimit("zone.write", "user", session.user.id);
  if (!limit.ok) {
    return {
      ok: false as const,
      result: refuseWith("rate_limited", {
        retryAfterSeconds: limit.retryAfterSeconds,
      }),
    };
  }

  const fields = validateZone({
    ...draft,
    notesAr: draft.notesAr.slice(0, MAX_TEXT_LENGTH),
    notesEn: draft.notesEn.slice(0, MAX_TEXT_LENGTH),
  });
  const checkedGeometry = validateGeometry(geometry);

  /**
   * **Both halves are reported at once.** A form that answers "the name is
   * missing", then on the next attempt "and the polygon crosses itself", makes
   * somebody redraw a boundary twice. The codes are namespaced so the screen
   * can put each problem beside the thing that caused it.
   */
  if (!fields.ok || !checkedGeometry.ok) {
    const reasons = [
      ...(fields.ok ? [] : fields.problems.map((code: ZoneProblem) => ({ code }))),
      ...(checkedGeometry.ok
        ? []
        : checkedGeometry.problems.map((problem) => ({
            code: `geometry_${problem.code}`,
            params: problem.params,
          }))),
    ];
    return { ok: false as const, result: { ok: false as const, reasons } };
  }

  return { ok: true as const, fields: fields.value, geometry: checkedGeometry };
}

/**
 * Draw a new zone. It starts as a **draft**: invisible to pilots, producing no
 * slots, and staying that way until F23b's publish exists.
 */
export async function createZoneAction(
  draft: ZoneDraft,
  geometry: unknown,
): Promise<ActionResult<ZoneSaved>> {
  const session = await getSession();
  const checked = await checkedZoneInput(session, draft, geometry);
  if (!checked.ok) return checked.result;
  const actor = actorFrom(session as Session);

  const [cityRow] = await db
    .select({ id: city.id })
    .from(city)
    .where(eq(city.id, checked.fields.cityId))
    .limit(1);
  if (!cityRow) return refuse("city_required");

  const [existing] = await db
    .select({ id: zone.id })
    .from(zone)
    .where(eq(zone.code, checked.fields.code))
    .limit(1);
  // The code is a `unique` column, so this is a courtesy rather than the
  // enforcement — it turns a constraint violation into a sentence.
  if (existing) return refuse("code_taken");

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(zone)
      .values({
        ...toColumns(checked.fields, checked.geometry),
        createdByUserId: actor.userId,
        updatedByUserId: actor.userId,
      })
      .returning({ id: zone.id });

    await audit(tx, {
      actor,
      entityType: "zone",
      entityId: row.id,
      action: "zone.created",
      after: {
        code: checked.fields.code,
        kind: checked.fields.kind,
        status: "draft",
        vertexCount: checked.geometry.vertexCount,
        // The polygon itself, in full. See `updateZoneAction` for why.
        geometry: checked.geometry.geometry,
      },
    });

    return row;
  });

  revalidateZoneSurfaces();
  return {
    ok: true,
    data: {
      id: created.id,
      warnings: checked.geometry.warnings.map((warning) => warning.code),
    },
  };
}

/**
 * Edit a zone that already exists.
 *
 * **A geometry change increments `geometryVersion` and audits the whole
 * polygon, before and after.** That is the one deliberate exception to "only
 * the changed fields go in the trail": a diff of coordinates answers nothing a
 * person can act on, and *"who moved this boundary, and where was it before"*
 * is the question an incident review asks about airspace. The two polygons are
 * the answer.
 *
 * **Moving a published boundary is consequential, so it is confirmed.** If the
 * new polygon does not contain the old one — the boundary was cut back or moved
 * rather than only extended — every approved flight still ahead in that zone is
 * affected, and the action refuses with `geometry_impact_unconfirmed` until the
 * caller has seen `previewGeometryChangeAction`'s list and says so. On
 * confirmation the bookings are **flagged for review, not cancelled**: they go
 * back to `pending`, keeping their seat, and a reviewer decides against the new
 * boundary. A boundary tweak must not quietly void somebody's authorised
 * flight, and it must not quietly leave one standing outside its zone either.
 */
export async function updateZoneAction(
  zoneId: string,
  draft: ZoneDraft,
  geometry: unknown,
  /** Set once the admin has seen which flights a moved boundary would disturb. */
  confirmGeometryImpact = false,
): Promise<ActionResult<ZoneSaved>> {
  const session = await getSession();
  const checked = await checkedZoneInput(session, draft, geometry);
  if (!checked.ok) return checked.result;
  const actor = actorFrom(session as Session);

  const current = await db.query.zone.findFirst({ where: eq(zone.id, zoneId) });
  if (!current) return refuse("not_found");

  const before = JSON.stringify(current.geometry);
  const after = JSON.stringify(checked.geometry.geometry);
  const geometryChanged = before !== after;

  /**
   * A draft has no bookings and nobody can see it, so it is edited freely. On
   * anything published the question is whether the boundary **shrank or moved**
   * — see `geometryShrinks` for why the answer cannot be per-booking.
   */
  const disturbs =
    geometryChanged &&
    current.status !== "draft" &&
    geometryShrinks(current.geometry, checked.geometry.geometry);

  if (disturbs && !confirmGeometryImpact) {
    return refuse("geometry_impact_unconfirmed");
  }

  const [clash] = await db
    .select({ id: zone.id })
    .from(zone)
    .where(eq(zone.code, checked.fields.code))
    .limit(1);
  if (clash && clash.id !== zoneId) return refuse("code_taken");

  let flagged = 0;
  await db.transaction(async (tx) => {
    await tx
      .update(zone)
      .set({
        ...toColumns(checked.fields, checked.geometry),
        geometryVersion: geometryChanged
          ? current.geometryVersion + 1
          : current.geometryVersion,
        updatedByUserId: actor.userId,
        updatedAt: new Date(),
      })
      .where(eq(zone.id, zoneId));

    await audit(tx, {
      actor,
      entityType: "zone",
      entityId: zoneId,
      action: geometryChanged ? "zone.geometry_changed" : "zone.updated",
      before: geometryChanged
        ? {
            geometry: current.geometry,
            geometryVersion: current.geometryVersion,
          }
        : { code: current.code, kind: current.kind },
      after: geometryChanged
        ? {
            geometry: checked.geometry.geometry,
            geometryVersion: current.geometryVersion + 1,
            vertexCount: checked.geometry.vertexCount,
          }
        : { code: checked.fields.code, kind: checked.fields.kind },
    });

    /**
     * **In the same transaction as the boundary.** A polygon that moved and a
     * set of bookings still marked approved against the old one is exactly the
     * inconsistency this is here to prevent, so either both land or neither
     * does.
     */
    if (disturbs) {
      const result = await flagBookingsForGeometryReview(tx, {
        zoneId,
        actor,
        zoneNameAr: checked.fields.nameAr,
        zoneNameEn: checked.fields.nameEn,
      });
      flagged = result.flagged;
    }
  });

  revalidateZoneSurfaces();
  return {
    ok: true,
    data: {
      id: zoneId,
      warnings: checked.geometry.warnings.map((warning) => warning.code),
      flagged,
    },
  };
}

/**
 * The columns a zone form writes. **Status is not among them** — rule 11 keeps
 * every status change in `src/lib/workflow/`, and a new row simply takes the
 * schema's own `draft` default.
 */
function toColumns(
  fields: ZoneDraft,
  geometry: Extract<ReturnType<typeof validateGeometry>, { ok: true }>,
) {
  return {
    code: fields.code,
    cityId: fields.cityId,
    kind: fields.kind as "permitted" | "restricted" | "no_fly",
    nameAr: fields.nameAr,
    nameEn: fields.nameEn,
    districtAr: fields.districtAr || null,
    districtEn: fields.districtEn || null,
    notesAr: fields.notesAr || null,
    notesEn: fields.notesEn || null,
    geometry: geometry.geometry,
    vertexCount: geometry.vertexCount,
    minLat: geometry.bbox.minLat,
    maxLat: geometry.bbox.maxLat,
    minLng: geometry.bbox.minLng,
    maxLng: geometry.bbox.maxLng,
    ceilingAglM: fields.ceilingAglM,
    floorAglM: fields.floorAglM,
    capacity: fields.capacity,
    slotDurationMinutes: fields.slotDurationMinutes,
    minLeadMinutes: fields.minLeadMinutes,
    maxAdvanceDays: fields.maxAdvanceDays,
    maxSlotsPerPilotPerDay: fields.maxSlotsPerPilotPerDay,
    autoApprove: fields.autoApprove,
    nightAllowed: fields.nightAllowed,
    maxWeightClass: fields.maxWeightClass as
      | "micro"
      | "light"
      | "medium"
      | "heavy"
      | null,
    permittedBuildTypes: fields.permittedBuildTypes as (
      | "commercial"
      | "self_built"
      | "fpv"
    )[],
    requiresBroadcastRid: fields.requiresBroadcastRid,
    authorityRef: fields.authorityRef || null,
  };
}

/**
 * Every surface a zone write changes. The public map reads the same rows, and
 * `/api/zones/geojson` is what the pilot map fetches — a boundary that moved
 * and a map still drawing the old one is the one outcome worth the extra call.
 */
function revalidateZoneSurfaces(): void {
  revalidatePath("/[locale]/admin/zones", "page");
  revalidatePath("/[locale]/admin/zones/[id]", "page");
  revalidatePath("/[locale]/zones", "page");
  revalidatePath("/api/zones/geojson");
}

/** The role is captured at the time of the act, never re-derived later. */
function actorFrom(session: Session): Actor {
  return { userId: session.user.id, role: roleOf(session), isSystem: false };
}

// --- The publish lifecycle -------------------------------------------------

/**
 * Every lifecycle action starts the same way and there is no version of this
 * that is safe to skip: an action is an ordinary POST, the `(admin)` layout
 * that guarded the page never runs for it, and `not_found` rather than
 * `forbidden` is what stops a refusal from confirming the surface exists.
 */
async function requireAdminSession() {
  const session = await getSession();
  if (!session) return { ok: false as const, result: refuse("not_authenticated") };
  if (!isAdmin(session)) return { ok: false as const, result: refuse("not_found") };

  const limit = await enforceLimit("zone.write", "user", session.user.id);
  if (!limit.ok) {
    return {
      ok: false as const,
      result: refuseWith("rate_limited", {
        retryAfterSeconds: limit.retryAfterSeconds,
      }),
    };
  }
  return { ok: true as const, session };
}

/**
 * Replace a zone's whole week of operating windows.
 *
 * **Validated here as the authority**, by the same pure function the grid runs
 * as you type. The grid can be bypassed; `validateZoneHours` cannot, and an
 * overlapping pair that slipped through would give one hour of airspace two
 * slot grids and two seats where there is one.
 */
export async function setZoneHoursAction(
  zoneId: string,
  windows: readonly HourWindow[],
): Promise<ActionResult<{ count: number }>> {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.result;

  const checked = validateZoneHours(windows);
  if (!checked.ok) {
    return { ok: false, reasons: checked.problems.map((code) => ({ code })) };
  }

  const [row] = await db
    .select({ id: zone.id })
    .from(zone)
    .where(eq(zone.id, zoneId))
    .limit(1);
  if (!row) return refuse("not_found");

  await db.transaction((tx) =>
    setZoneHours(tx, {
      zoneId,
      actor: actorFrom(guard.session),
      windows: checked.value,
    }),
  );

  revalidateZoneSurfaces();
  return { ok: true, data: { count: checked.value.length } };
}

/**
 * Draft (or suspended) → active. **The moment a drawing becomes airspace.**
 *
 * The refusal codes are `publishReadiness`'s own, so the screen names the thing
 * that is missing rather than saying "not ready". `publish_overlaps_no_fly`
 * carries the codes of the zones in the way — an admin told only that something
 * overlaps has to go and find it.
 */
export async function publishZoneAction(
  zoneId: string,
): Promise<ActionResult<{ status: string }>> {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.result;

  const outcome = await db.transaction((tx) =>
    publishZone(tx, { zoneId, actor: actorFrom(guard.session) }),
  );
  if (!outcome.ok) {
    return outcome.overlappingNoFly?.length
      ? refuseWith(outcome.reason, {
          zones: outcome.overlappingNoFly.join("، "),
        })
      : refuse(outcome.reason);
  }

  revalidateZoneSurfaces();
  return { ok: true, data: { status: outcome.to } };
}

/**
 * Active → suspended, with a reason in both languages that reaches every pilot
 * holding a slot.
 *
 * The cancellations **fan out as a job** rather than happening here: the
 * suspension must commit whether or not a mail provider is reachable, and a
 * failing email must retry one pilot rather than all of them.
 */
export async function suspendZoneAction(
  zoneId: string,
  reasonAr: string,
  reasonEn: string,
): Promise<ActionResult<{ status: string; fanOutQueued: boolean }>> {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.result;

  const ar = reasonAr.slice(0, MAX_TEXT_LENGTH).trim();
  const en = reasonEn.slice(0, MAX_TEXT_LENGTH).trim();

  const outcome = await db.transaction((tx) =>
    suspendZone(tx, {
      zoneId,
      actor: actorFrom(guard.session),
      reasonAr: ar,
      reasonEn: en,
    }),
  );
  if (!outcome.ok) return refuse(outcome.reason);

  /**
   * **The suspension has committed; the fan-out is a separate promise.**
   *
   * `inngest.send` throws `fetch failed` when no dev server is listening — and
   * it threw, in a browser, over a suspension that had already been written.
   * The admin saw a stack trace and had no way to know the zone *was*
   * suspended, which is the worst pair of outcomes available: the status
   * changed and the person who changed it believes it did not.
   *
   * So the send is guarded and its failure is **reported, not swallowed**. The
   * zone is suspended either way — that part is committed and correct — but
   * `fanOutQueued: false` tells the screen to say plainly that the
   * cancellations have not been queued, because a pilot whose booking was not
   * cancelled will turn up to closed airspace.
   */
  let fanOutQueued = true;
  try {
    await inngest.send(
      zoneSuspendedEvent.create({ zoneId, reasonAr: ar, reasonEn: en }),
    );
  } catch {
    fanOutQueued = false;
  }

  revalidateZoneSurfaces();
  return { ok: true, data: { status: outcome.to, fanOutQueued } };
}

/** The end of a zone. Refused while any future booking still stands. */
export async function archiveZoneAction(
  zoneId: string,
): Promise<ActionResult<{ status: string }>> {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.result;

  const outcome = await db.transaction((tx) =>
    archiveZone(tx, { zoneId, actor: actorFrom(guard.session) }),
  );
  if (!outcome.ok) return refuse(outcome.reason);

  revalidateZoneSurfaces();
  return { ok: true, data: { status: outcome.to } };
}

/**
 * **What a moved boundary would do, before it moves.**
 *
 * Called by the editor when the polygon has changed on a zone that is not a
 * draft. It answers with the flights that would be sent back to a reviewer —
 * named, with their times — so the admin confirms against a list of people
 * rather than a number.
 *
 * `shrinks: false` means the new boundary contains the old one and nothing is
 * disturbed; the editor saves straight through. When it is `true` the list is
 * **every approved flight still ahead in the zone**, not a computed subset,
 * because a booking has no launch point (threads 37 and 55) and "was this
 * flight in the part you cut away" is a question the row cannot answer. Saying
 * so on the screen is better than a confident answer that is a guess.
 *
 * Read-only, so it takes no rate-limit token of its own beyond the admin check:
 * it runs on every geometry edit the editor sees.
 */
export async function previewGeometryChangeAction(
  zoneId: string,
  geometry: unknown,
): Promise<
  ActionResult<{
    shrinks: boolean;
    bookings: {
      bookingId: string;
      pilotName: string;
      slotStart: string;
      slotEnd: string;
      status: string;
    }[];
  }>
> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");
  if (!isAdmin(session)) return refuse("not_found");

  const current = await db.query.zone.findFirst({ where: eq(zone.id, zoneId) });
  if (!current) return refuse("not_found");

  const checked = validateGeometry(geometry);
  if (!checked.ok) {
    return {
      ok: false,
      reasons: checked.problems.map((problem) => ({
        code: `geometry_${problem.code}`,
        params: problem.params,
      })),
    };
  }

  const unchanged =
    JSON.stringify(current.geometry) === JSON.stringify(checked.geometry);
  const shrinks =
    !unchanged &&
    current.status !== "draft" &&
    geometryShrinks(current.geometry, checked.geometry);

  if (!shrinks) return { ok: true, data: { shrinks: false, bookings: [] } };

  const rows = await listZoneBookingImpact(session, zoneId);
  return {
    ok: true,
    data: {
      shrinks: true,
      // Only the approved ones are flagged; a `pending` booking is already in
      // the queue the flag would put it in.
      bookings: rows
        .filter((row) => row.status === "approved")
        .map((row) => ({
          bookingId: row.bookingId,
          pilotName: row.pilotName,
          slotStart: row.slotStart.toISOString(),
          slotEnd: row.slotEnd.toISOString(),
          status: row.status,
        })),
    },
  };
}
