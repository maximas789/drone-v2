import { existsSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  assertRingsClosed,
  assertWithinSaudiArabia,
  bboxOverlaps,
  computeBbox,
  countVertices,
} from "@/lib/geo/bbox";
import * as schema from "@/lib/db/schema";
import { CITIES } from "./cities";
import { CLOSURES } from "./closures";
import { STANDARD_HOURS } from "./zone-hours";
import { RIYADH_ZONES } from "./zones-riyadh";

/**
 * Seeds the authored Riyadh airspace. **Idempotent** — every write is
 * conflict-guarded on a natural key, so a second run inserts nothing and
 * touches no `updatedAt`.
 *
 * Builds its own connection rather than importing `@/lib/db`, which is marked
 * `server-only` and belongs to the request path. A seed is a script.
 *
 * The checks below run **before** anything is written. A seed that fails
 * loudly on a reversed coordinate pair is worth far more than one that
 * silently plants a permitted zone in the Indian Ocean.
 */

function preflight() {
  const problems: string[] = [];

  for (const zone of RIYADH_ZONES) {
    try {
      assertRingsClosed(zone.geometry, zone.code);
      assertWithinSaudiArabia(zone.geometry, zone.code);
    } catch (error) {
      problems.push((error as Error).message);
    }

    const bbox = computeBbox(zone.geometry);
    if (bbox.minLat >= bbox.maxLat || bbox.minLng >= bbox.maxLng) {
      problems.push(`${zone.code}: degenerate bbox`);
    }
    if (!zone.nameAr.trim() || !zone.nameEn.trim()) {
      problems.push(`${zone.code}: missing a bilingual name`);
    }
    if (!zone.districtAr.trim() || !zone.districtEn.trim()) {
      problems.push(`${zone.code}: missing a bilingual district`);
    }
  }

  // The fixture F12's precedence tests depend on: no_fly must beat permitted
  // somewhere, or the rule is never exercised.
  const permitted = RIYADH_ZONES.filter((z) => z.kind === "permitted");
  const noFly = RIYADH_ZONES.filter((z) => z.kind === "no_fly");
  const overlaps = noFly.some((n) =>
    permitted.some((p) =>
      bboxOverlaps(computeBbox(n.geometry), computeBbox(p.geometry)),
    ),
  );
  if (!overlaps) {
    problems.push(
      "no no-fly zone overlaps any permitted zone's bbox — F12's precedence rule would have no fixture",
    );
  }

  // The annulus, likewise: without an interior ring the hole-handling path in
  // F12 is dead code.
  const kkia = RIYADH_ZONES.find((z) => z.code === "RUH-NF-KKIA");
  if (!kkia || kkia.geometry.type !== "Polygon" || kkia.geometry.coordinates.length < 2) {
    problems.push("RUH-NF-KKIA must be an annulus — an outer ring plus a hole");
  }

  const autoApprove = permitted.filter((z) => z.autoApprove).length;
  if (autoApprove !== 2) {
    problems.push(
      `expected exactly 2 auto-approving permitted zones so both booking paths are demonstrable, found ${autoApprove}`,
    );
  }

  if (problems.length > 0) {
    throw new Error(`Seed preflight failed:\n  - ${problems.join("\n  - ")}`);
  }
}

async function main() {
  preflight();

  // A seed runs outside Next, so nothing has loaded .env for it.
  if (existsSync(".env")) process.loadEnvFile(".env");

  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("POSTGRES_URL is not set. Run `pnpm db:up` and check .env.");
  }

  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema, casing: "snake_case" });

  const inserted = { cities: 0, zones: 0, hours: 0, closures: 0 };

  try {
    // --- Cities ----------------------------------------------------------
    for (const city of CITIES) {
      const result = await db
        .insert(schema.city)
        .values(city)
        .onConflictDoNothing({ target: schema.city.code })
        .returning({ id: schema.city.id });
      inserted.cities += result.length;
    }

    const riyadh = await db.query.city.findFirst({
      where: eq(schema.city.code, "RUH"),
    });
    if (!riyadh) throw new Error("Riyadh row missing after city seed");

    // --- Zones -----------------------------------------------------------
    for (const zone of RIYADH_ZONES) {
      // bbox and vertexCount are DERIVED, never hand-written — the same helper
      // F23's editor uses, so there is one implementation and no drift.
      const bbox = computeBbox(zone.geometry);

      const result = await db
        .insert(schema.zone)
        .values({
          cityId: riyadh.id,
          code: zone.code,
          kind: zone.kind,
          status: "active",
          nameAr: zone.nameAr,
          nameEn: zone.nameEn,
          districtAr: zone.districtAr,
          districtEn: zone.districtEn,
          notesAr: zone.notesAr,
          notesEn: zone.notesEn,
          geometry: zone.geometry,
          vertexCount: countVertices(zone.geometry),
          ...bbox,
          ceilingAglM: zone.ceilingAglM,
          floorAglM: zone.floorAglM ?? 0,
          capacity: zone.capacity ?? 1,
          slotDurationMinutes: zone.slotDurationMinutes ?? 60,
          minLeadMinutes: zone.minLeadMinutes ?? 60,
          maxAdvanceDays: zone.maxAdvanceDays ?? 14,
          maxSlotsPerPilotPerDay: zone.maxSlotsPerPilotPerDay ?? 2,
          autoApprove: zone.autoApprove ?? false,
          nightAllowed: zone.nightAllowed ?? false,
          maxWeightClass: zone.maxWeightClass,
          permittedBuildTypes: zone.permittedBuildTypes,
          requiresBroadcastRid: zone.requiresBroadcastRid ?? false,
          authorityRef: zone.authorityRef,
          publishedAt: new Date(),
        })
        .onConflictDoNothing({ target: schema.zone.code })
        .returning({ id: schema.zone.id });
      inserted.zones += result.length;
    }

    // --- Opening hours ---------------------------------------------------
    // Only permitted zones have hours. A restricted or no-fly zone is never
    // "open", and giving it opening hours would imply it could be.
    for (const seedZone of RIYADH_ZONES.filter((z) => z.kind === "permitted")) {
      const row = await db.query.zone.findFirst({
        where: eq(schema.zone.code, seedZone.code),
      });
      if (!row) throw new Error(`zone ${seedZone.code} missing after seed`);

      for (const hour of STANDARD_HOURS) {
        const result = await db
          .insert(schema.zoneHour)
          .values({ zoneId: row.id, ...hour })
          .onConflictDoNothing()
          .returning({ id: schema.zoneHour.id });
        inserted.hours += result.length;
      }
    }

    // --- Closures --------------------------------------------------------
    // No natural unique key on zone_closure, so idempotency is a read first.
    for (const closure of CLOSURES) {
      const row = await db.query.zone.findFirst({
        where: eq(schema.zone.code, closure.zoneCode),
      });
      if (!row) throw new Error(`zone ${closure.zoneCode} missing after seed`);

      const existing = await db.query.zoneClosure.findFirst({
        where: and(
          eq(schema.zoneClosure.zoneId, row.id),
          eq(schema.zoneClosure.startsAt, closure.startsAt),
        ),
      });
      if (existing) continue;

      await db.insert(schema.zoneClosure).values({
        zoneId: row.id,
        startsAt: closure.startsAt,
        endsAt: closure.endsAt,
        reasonAr: closure.reasonAr,
        reasonEn: closure.reasonEn,
        authorityRef: closure.authorityRef,
        publishedAt: new Date(),
      });
      inserted.closures += 1;
    }

    console.log(
      `Seed complete. Inserted ${inserted.cities} cities, ${inserted.zones} zones, ` +
        `${inserted.hours} opening-hour rows, ${inserted.closures} closures. ` +
        `(Zeroes on a re-run mean idempotency is holding.)`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
