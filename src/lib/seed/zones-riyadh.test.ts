import { describe, expect, it } from "vitest";
import {
  assertRingsClosed,
  assertWithinSaudiArabia,
  bboxOverlaps,
  computeBbox,
} from "@/lib/geo/bbox";
import { CITIES } from "./cities";
import { CLOSURES, SEED_EPOCH } from "./closures";
import { STANDARD_HOURS } from "./zone-hours";
import { RIYADH_ZONES } from "./zones-riyadh";

/**
 * These are the same checks the seed's preflight runs, kept in the suite so a
 * bad coordinate fails `pnpm test` rather than waiting for someone to re-seed.
 * The seed keeps its own copy because it must refuse to write, not merely
 * report.
 */

const permitted = RIYADH_ZONES.filter((z) => z.kind === "permitted");
const noFly = RIYADH_ZONES.filter((z) => z.kind === "no_fly");

describe("the authored Riyadh airspace", () => {
  it("is 1 restricted base, 7 permitted carve-outs and 4 no-fly overlays", () => {
    expect(RIYADH_ZONES.filter((z) => z.kind === "restricted")).toHaveLength(1);
    expect(permitted).toHaveLength(7);
    expect(noFly).toHaveLength(4);
  });

  it("has 6 cities, exactly one of them modelled", () => {
    expect(CITIES).toHaveLength(6);
    expect(CITIES.filter((c) => c.isModelled).map((c) => c.code)).toEqual([
      "RUH",
    ]);
  });

  it.each(RIYADH_ZONES.map((z) => [z.code, z] as const))(
    "%s has closed rings, sits inside Saudi Arabia, and is bilingual throughout",
    (_code, zone) => {
      expect(() => assertRingsClosed(zone.geometry, zone.code)).not.toThrow();
      expect(() =>
        assertWithinSaudiArabia(zone.geometry, zone.code),
      ).not.toThrow();

      for (const field of [
        zone.nameAr,
        zone.nameEn,
        zone.districtAr,
        zone.districtEn,
        zone.notesAr,
        zone.notesEn,
      ]) {
        expect(field.trim().length).toBeGreaterThan(0);
        expect(field).not.toMatch(/lorem|placeholder|TODO|Zone \d/i);
      }
    },
  );

  it.each(RIYADH_ZONES.map((z) => [z.code, z] as const))(
    "%s has a non-degenerate bbox around Riyadh",
    (_code, zone) => {
      const bbox = computeBbox(zone.geometry);
      expect(bbox.maxLat).toBeGreaterThan(bbox.minLat);
      expect(bbox.maxLng).toBeGreaterThan(bbox.minLng);
      // Greater Riyadh, generously.
      expect(bbox.minLat).toBeGreaterThan(24);
      expect(bbox.maxLat).toBeLessThan(26);
      expect(bbox.minLng).toBeGreaterThan(46);
      expect(bbox.maxLng).toBeLessThan(48);
    },
  );

  /**
   * F12's precedence rule — no_fly beats permitted — needs a place where the
   * two actually meet, or the rule is never exercised by real data.
   */
  it("has a no-fly zone overlapping a permitted zone", () => {
    const pairs = noFly.flatMap((n) =>
      permitted
        .filter((p) =>
          bboxOverlaps(computeBbox(n.geometry), computeBbox(p.geometry)),
        )
        .map((p) => `${n.code} × ${p.code}`),
    );
    expect(pairs.length).toBeGreaterThan(0);
    // The King Khalid CTR reaching into Thumamah is the intended fixture.
    expect(pairs).toContain("RUH-NF-KKIA × RUH-P-01");
  });

  /**
   * The one genuinely annular shape. Without it, F12's interior-ring handling
   * would be code no data ever reaches.
   */
  it("models RUH-NF-KKIA as an annulus, hole inside the outer ring's box", () => {
    const kkia = RIYADH_ZONES.find((z) => z.code === "RUH-NF-KKIA");
    expect(kkia).toBeDefined();

    const geometry = kkia!.geometry;
    if (geometry.type !== "Polygon") throw new Error("KKIA must be a Polygon");
    expect(geometry.coordinates).toHaveLength(2);

    const [outerRing, innerRing] = geometry.coordinates;
    const outer = computeBbox({ type: "Polygon", coordinates: [outerRing] });
    const inner = computeBbox({ type: "Polygon", coordinates: [innerRing] });
    expect(inner.minLat).toBeGreaterThan(outer.minLat);
    expect(inner.maxLat).toBeLessThan(outer.maxLat);
    expect(inner.minLng).toBeGreaterThan(outer.minLng);
    expect(inner.maxLng).toBeLessThan(outer.maxLng);
  });

  it("auto-approves exactly two permitted zones, so both booking paths exist", () => {
    expect(permitted.filter((z) => z.autoApprove)).toHaveLength(2);
  });

  it("gives the restricted base no ceiling — nothing is permitted there", () => {
    const base = RIYADH_ZONES.find((z) => z.code === "RUH-R-CITY");
    expect(base?.ceilingAglM).toBeNull();
  });

  it("gives every no-fly overlay a ceiling of zero", () => {
    for (const zone of noFly) expect(zone.ceilingAglM).toBe(0);
  });
});

describe("opening hours", () => {
  it("covers all seven days with two windows each", () => {
    for (let weekday = 0; weekday < 7; weekday++) {
      const windows = STANDARD_HOURS.filter((h) => h.weekday === weekday);
      expect(windows, `weekday ${weekday}`).toHaveLength(2);
    }
  });

  /**
   * Weekday 5 is Friday, because 0 is Sunday. The morning window closes at
   * 10:00 and the afternoon opens at 15:30, leaving Jumu'ah clear.
   */
  it("splits Friday around Jumu'ah", () => {
    const friday = STANDARD_HOURS.filter((h) => h.weekday === 5);
    expect(friday[0].closesMinute).toBe(10 * 60);
    expect(friday[1].opensMinute).toBe(15 * 60 + 30);
  });

  it("never lets a window cross midnight or invert", () => {
    for (const hour of STANDARD_HOURS) {
      expect(hour.closesMinute).toBeGreaterThan(hour.opensMinute);
      expect(hour.closesMinute).toBeLessThanOrEqual(24 * 60);
    }
  });
});

describe("closures", () => {
  it("seeds two on the events zone, one already over and one still ahead", () => {
    expect(CLOSURES).toHaveLength(2);
    expect(CLOSURES.every((c) => c.zoneCode === "RUH-P-07")).toBe(true);

    const [past, future] = CLOSURES;
    expect(past.endsAt.getTime()).toBeLessThan(SEED_EPOCH.getTime() + 60 * 86400000);
    expect(future.startsAt.getTime()).toBeGreaterThan(past.endsAt.getTime());
  });

  it("ends after it starts, and is bilingual", () => {
    for (const closure of CLOSURES) {
      expect(closure.endsAt.getTime()).toBeGreaterThan(closure.startsAt.getTime());
      expect(closure.reasonAr.trim().length).toBeGreaterThan(0);
      expect(closure.reasonEn.trim().length).toBeGreaterThan(0);
    }
  });
});
