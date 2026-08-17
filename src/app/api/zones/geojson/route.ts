import { NextResponse } from "next/server";
import { zonesForViewport } from "@/lib/airspace/query";
import { getSession } from "@/lib/auth-guards";

/**
 * `GET /api/zones/geojson?bbox=minLng,minLat,maxLng,maxLat`
 *
 * What the map fetches on every viewport change — and it returns the **exact**
 * structure `evaluateAirspace` consumes, not a thinner drawing-only shape. That
 * is the point: the map evaluates locally on every click using the same
 * function the booking transaction runs, so it cannot show green where the
 * server says red.
 *
 * Zones are public information. Signed in or not, the answer is the same, which
 * is why this can be cached at all.
 */

const MAX_SPAN_DEGREES = 5;
/** Closures the map should already be drawing. A month is the booking horizon. */
const CLOSURE_HORIZON_DAYS = 30;

export async function GET(request: Request) {
  const bbox = parseBbox(new URL(request.url).searchParams.get("bbox"));
  if (!bbox) {
    return NextResponse.json(
      { ok: false, reasons: [{ code: "invalid_bbox" }] },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const session = await getSession();
  const now = new Date();
  const zones = await zonesForViewport(session, bbox, {
    from: now,
    to: new Date(now.getTime() + CLOSURE_HORIZON_DAYS * 24 * 60 * 60_000),
  });

  return NextResponse.json(
    {
      ok: true,
      data: {
        zones,
        /**
         * **The zones here are authored for this proposal — they are not
         * official GACA airspace.** The disclaimer rides on the payload as well
         * as on every map surface, so a client that renders this data without
         * our UI still carries it.
         */
        disclaimer: "authored-proposal",
        fetchedAt: now.toISOString(),
      },
    },
    {
      /**
       * Public and short. A zone edit must reach a pilot's map in about a
       * minute, and `stale-while-revalidate` means the redraw never blocks on
       * the round trip. Nothing user-specific is in this response, so a shared
       * cache is safe — which would not be true if eligibility were folded in.
       */
      headers: {
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}

/**
 * `minLng,minLat,maxLng,maxLat` — **`[lng, lat]` order**, as everywhere else in
 * this codebase. A span ceiling keeps one request from asking for the whole
 * country's geometry.
 */
function parseBbox(
  raw: string | null,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } | null {
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
    return null;
  }
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLat > maxLat || minLng > maxLng) return null;
  if (Math.abs(maxLat) > 90 || Math.abs(maxLng) > 180) return null;
  if (
    maxLat - minLat > MAX_SPAN_DEGREES ||
    maxLng - minLng > MAX_SPAN_DEGREES
  ) {
    return null;
  }
  return { minLat, maxLat, minLng, maxLng };
}
