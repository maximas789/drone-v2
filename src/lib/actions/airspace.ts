"use server";

import { headers } from "next/headers";
import { refuse, refuseWith, type ActionResult } from "@/lib/actions/result";
import { evaluateAirspace } from "@/lib/airspace/evaluate";
import { buildPointContext } from "@/lib/airspace/query";
import type { AirspaceDecision } from "@/lib/airspace/types";
import { getSession } from "@/lib/auth-guards";
import type { Position } from "@/lib/geo";
import { clientIpFrom, hashIp } from "@/lib/ip-hash";
import { enforceLimit } from "@/lib/rate-limit";

/**
 * "May I fly here?" — the authoritative answer.
 *
 * The map already knows: it holds the same zones and calls the same
 * `evaluateAirspace` locally on every click, which is why the answer appears
 * instantly. This action exists so the answer the *server* gives is on record
 * and so a caller who never loaded the map gets the same one. Both run the same
 * function over the same context, so they cannot disagree — that is the whole
 * reason the engine is pure.
 *
 * **Signed out is allowed.** Where you may fly is public information; only the
 * eligibility half needs an account, and without one it is simply not
 * evaluated. The refusal a signed-out caller gets is about the airspace, never
 * about them.
 */

export type CheckAirspaceInput = {
  /** `[lng, lat]`, GeoJSON order. */
  point: Position;
  altitudeAglM?: number | null;
  /** ISO instants. Optional: a map probe asks about a place, not a time. */
  slotStart?: string | null;
  slotEnd?: string | null;
  droneId?: string | null;
};

const MAX_ALTITUDE_M = 10_000;

export async function checkAirspaceAction(
  input: CheckAirspaceInput,
): Promise<ActionResult<AirspaceDecision>> {
  const session = await getSession();

  /**
   * Keyed on the account where there is one and on the hashed IP otherwise.
   * The limit is deliberately generous — this fires on map interaction, and a
   * tight limit would make a working map feel broken.
   */
  const ip = clientIpFrom(await headers());
  const ipHash = ip ? hashIp(ip) : null;
  const limit = session
    ? await enforceLimit("airspace.check", "user", session.user.id)
    : ipHash
      ? await enforceLimit("airspace.check", "ip", ipHash)
      : { ok: true as const };
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const point = validPoint(input.point);
  if (!point) return refuse("invalid_point");

  const altitude =
    typeof input.altitudeAglM === "number" &&
    Number.isFinite(input.altitudeAglM) &&
    input.altitudeAglM >= 0 &&
    input.altitudeAglM <= MAX_ALTITUDE_M
      ? input.altitudeAglM
      : null;

  const slotStart = validInstant(input.slotStart);
  const slotEnd = validInstant(input.slotEnd);

  const now = new Date();
  const context = await buildPointContext(session, {
    point,
    droneId: session ? (input.droneId ?? null) : null,
    slotStart,
    slotEnd,
  });

  return {
    ok: true,
    data: evaluateAirspace(
      {
        point,
        altitudeAglM: altitude,
        slotStart: slotStart?.toISOString() ?? null,
        slotEnd: slotEnd?.toISOString() ?? null,
        now: now.toISOString(),
      },
      context,
    ),
  };
}

/**
 * `[lng, lat]`, and finite. A `[lat, lng]` pair is a type error at every
 * internal boundary, but this input crosses the wire from a browser and arrives
 * as whatever was posted.
 */
function validPoint(value: unknown): Position | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [lng, lat] = value;
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lng, lat];
}

function validInstant(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
