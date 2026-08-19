"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { refuse, refuseWith, type ActionResult } from "@/lib/actions/result";
import { audit, type Actor } from "@/lib/audit";
import { getSession } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { city, zone } from "@/lib/db/schema";
import { validateGeometry } from "@/lib/geo/validate";
import { enforceLimit } from "@/lib/rate-limit";
import { isAdmin, roleOf, type Session } from "@/lib/session";
import {
  validateZone,
  type ZoneDraft,
  type ZoneProblem,
} from "@/lib/validation/zone";

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
 * F23a writes **drafts only**. There is no publish here and no status change of
 * any kind: rule 11 puts those in `src/lib/workflow/`, and F23b is what builds
 * them. A draft zone is invisible to pilots and produces no slots, which is
 * exactly why this part is safe to ship on its own.
 */

const MAX_TEXT_LENGTH = 2_000;

export type ZoneSaved = {
  id: string;
  /** Warnings the geometry check repaired — rings closed, winding corrected. */
  warnings: string[];
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
 * F23a edits **drafts and published zones alike at the field level**, but the
 * consequences of moving a *published* boundary — re-evaluating the bookings
 * inside it and showing which now fall outside — are F23b's. Until then this
 * action refuses a geometry change on anything that is not a draft, rather than
 * making it silently and leaving somebody's authorised flight outside the zone
 * it was authorised in.
 */
export async function updateZoneAction(
  zoneId: string,
  draft: ZoneDraft,
  geometry: unknown,
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

  if (geometryChanged && current.status !== "draft") {
    /**
     * Refused rather than done quietly. A published zone's boundary has
     * bookings standing on it; F23b owns showing the admin which of them would
     * fall outside and flagging those for review instead of cancelling them.
     * Until that exists, the honest answer is "not from here".
     */
    return refuse("geometry_locked_until_draft");
  }

  const [clash] = await db
    .select({ id: zone.id })
    .from(zone)
    .where(eq(zone.code, checked.fields.code))
    .limit(1);
  if (clash && clash.id !== zoneId) return refuse("code_taken");

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
  });

  revalidateZoneSurfaces();
  return {
    ok: true,
    data: {
      id: zoneId,
      warnings: checked.geometry.warnings.map((warning) => warning.code),
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
