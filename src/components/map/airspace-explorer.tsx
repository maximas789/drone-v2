"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { checkAirspaceAction } from "@/lib/actions/airspace";
import { evaluateAirspace } from "@/lib/airspace/evaluate";
import { zoneContainsPoint } from "@/lib/airspace/geometry";
import { riyadhYmd } from "@/lib/airspace/time";
import type {
  AircraftContext,
  AirspaceContext,
  AirspaceDecision,
  PilotContext,
  ZoneRule,
} from "@/lib/airspace/types";
import type { Position } from "@/lib/geo";
import type { Locale } from "@/lib/locale";
import {
  DEFAULT_ALTITUDE_M,
  selectionForInstant,
  slotInstants,
} from "@/lib/maps/probe";
import { MapControls, type DroneOption, type TimeSelection } from "./map-controls";
import { MapMount } from "./map-mount";
import { StatusPanel } from "./status-panel";

/**
 * The map, its controls and its answer — one owner of the state all three share.
 *
 * **Two evaluations, and they are the same function.** Every change runs
 * `evaluateAirspace` in the browser against the zones already in hand, so the
 * panel answers on the same frame as the tap; then, debounced, the server
 * action runs the identical function over a context it assembles itself and the
 * result replaces the local one. That is why `evaluate.ts` is pure, and it is
 * the reason **the map can never promise something `createBooking` then
 * refuses** — the two are not two implementations that happen to agree.
 *
 * The local answer is not decoration. A server round trip per tap would make
 * the map feel broken on a phone in a field, which is where this screen is
 * meant to be used.
 *
 * **What the local pass can be short of, and why that is safe.** It has the
 * zones, the aircraft and the pilot; it does not have `availability`,
 * `pilotBusySlots` or `pilotBookingsOnDay`, all of which are facts about *other
 * people's bookings* that no client should hold. Every reason those three
 * produce — `slot_full`, `duplicate_booking`, `max_slots_per_day` — is a
 * refusal, so their absence can only ever make the local answer **more
 * permissive** than the server's, never less. The confirmation is what closes
 * that gap, and it is why a green panel still says it is being checked.
 */

export function AirspaceExplorer({
  initialZones,
  locale,
  labels,
  drones,
  aircraft,
  pilot,
  now,
  signedIn,
}: {
  /** Full rules, not a drawing shape: the browser evaluates against these. */
  initialZones: readonly ZoneRule[];
  locale: Locale;
  labels: { tileFailure: string; loading: string; mapLabel: string };
  drones: readonly DroneOption[];
  /**
   * One `AircraftContext` per drone the reader owns, keyed by id. Assembled on
   * the server so a tap can be answered without a round trip — and it is the
   * reader's own aircraft, never anybody else's.
   */
  aircraft: Readonly<Record<string, AircraftContext>>;
  /** `null` when signed out: eligibility is then simply not part of the question. */
  pilot: PilotContext | null;
  /** The server's clock at render, so the controls and the engine share one "now". */
  now: string;
  /**
   * False when nobody is signed in. The booking control is then not offered —
   * `/bookings/new` would redirect straight to sign-in, and a button whose only
   * effect is a redirect is a button that lied about what it does.
   */
  signedIn: boolean;
}) {
  const [zones, setZones] = useState<readonly ZoneRule[]>(initialZones);
  const [point, setPoint] = useState<Position | null>(null);
  const [altitudeAglM, setAltitude] = useState(DEFAULT_ALTITUDE_M);
  const [droneId, setDroneId] = useState<string | null>(
    () => defaultDroneId(drones),
  );
  const [time, setTime] = useState<TimeSelection>(() => ({
    ymd: riyadhYmd(new Date(now)),
    minuteOfDay: null,
  }));
  /**
   * The server's answer **together with the question it answers.**
   *
   * Not a bare decision plus a `confirming` flag: those two need resetting on
   * every input change, and the reset is exactly what gets forgotten. Keying the
   * answer means a stale reply is *structurally* unusable — it simply does not
   * match — so a slow response for a point the reader has already moved away
   * from can never be shown. `decision: null` records a failed check, which
   * clears the pending state without pretending the server agreed.
   */
  const [serverAnswer, setServerAnswer] = useState<{
    key: string;
    decision: AirspaceDecision | null;
  } | null>(null);

  /**
   * Viewport results keyed by rounded bbox. Panning back to somewhere already
   * visited must not re-fetch — a pilot comparing two sites goes back and forth
   * between them.
   */
  const cacheRef = useRef(new Map<string, ZoneRule[]>());

  const onViewportChange = useCallback(async (bbox: string) => {
    const cached = cacheRef.current.get(bbox);
    if (cached) {
      setZones(cached);
      return;
    }
    try {
      const response = await fetch(
        `/api/zones/geojson?bbox=${encodeURIComponent(bbox)}`,
      );
      if (!response.ok) return;
      const body = (await response.json()) as {
        ok: boolean;
        data?: { zones: ZoneRule[] };
      };
      if (!body.ok || !body.data) return;
      cacheRef.current.set(bbox, body.data.zones);
      setZones(body.data.zones);
    } catch {
      /**
       * Keep whatever is already drawn. A failed refresh must not erase the
       * airspace a pilot is looking at — stale zones are useful, an empty map
       * is not, and the next `moveend` will try again.
       */
    }
  }, []);

  /** The query, in the engine's own vocabulary. One definition, both callers. */
  const slot = useMemo(() => {
    if (time.minuteOfDay === null) {
      return { slotStart: null as string | null, slotEnd: null as string | null };
    }
    return slotInstants(time.ymd, time.minuteOfDay, pendingZoneDuration(zones, point));
  }, [time, zones, point]);

  /**
   * The instant answer. Recomputed on every state change — it is a pure
   * function over data already in memory, so there is nothing to debounce.
   */
  const localDecision = useMemo((): AirspaceDecision | null => {
    if (!point) return null;
    const context: AirspaceContext = {
      zones,
      aircraft: droneId ? (aircraft[droneId] ?? null) : null,
      pilot,
    };
    return evaluateAirspace(
      {
        point,
        altitudeAglM,
        slotStart: slot.slotStart,
        slotEnd: slot.slotEnd,
        // The browser's clock, deliberately: a decision about "now" that used a
        // `now` minted at page render would drift by however long the tab has
        // been open. The server's answer is the authoritative one regardless.
        now: new Date().toISOString(),
      },
      context,
    );
  }, [point, zones, aircraft, droneId, pilot, altitudeAglM, slot]);

  /**
   * Everything the answer depends on, as one comparable value.
   */
  const queryKey = useMemo(
    () => JSON.stringify({ point, altitudeAglM, droneId, slot }),
    [point, altitudeAglM, droneId, slot],
  );

  const serverDecision =
    serverAnswer?.key === queryKey ? serverAnswer.decision : null;
  /** Derived, never stored: pending *is* "the server has not answered this yet". */
  const confirming = point !== null && serverAnswer?.key !== queryKey;

  /**
   * The authoritative answer, debounced.
   *
   * 250 ms, and it is dragging the altitude slider that makes it necessary:
   * without it every intermediate value would be a POST. `airspace.check`'s
   * limit is deliberately generous (F09) because it fires on interaction, but
   * generous is not infinite.
   */
  useEffect(() => {
    if (!point) return;

    let current = true;
    const timer = setTimeout(async () => {
      let decision: AirspaceDecision | null = null;
      try {
        const result = await checkAirspaceAction({
          point,
          altitudeAglM,
          slotStart: slot.slotStart,
          slotEnd: slot.slotEnd,
          droneId,
        });
        decision = result.ok ? result.data : null;
      } catch {
        // Keep the local answer; recording `null` only clears the pending note.
        decision = null;
      }
      if (current) setServerAnswer({ key: queryKey, decision });
    }, CONFIRM_DEBOUNCE_MS);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [point, altitudeAglM, droneId, slot, queryKey]);

  /** The server wins whenever it has spoken about the current question. */
  const decision = serverDecision ?? localDecision;

  const matchedZone = useMemo(
    () => zones.find((zone) => zone.id === decision?.zone?.id) ?? null,
    [zones, decision],
  );

  /**
   * Everything the map has already answered, handed to F21's wizard so it opens
   * on the first unanswered question. Only for a bookable verdict: a denied
   * point has nothing to carry, and a link offered beside a refusal reads as a
   * way around it.
   */
  const bookingHref = useMemo(() => {
    if (!signedIn || !decision || decision.status === "denied") return null;
    if (!decision.zone) return null;

    const params = new URLSearchParams({
      zone: decision.zone.id,
      altitude: String(altitudeAglM),
    });
    if (slot.slotStart) params.set("slot", slot.slotStart);
    if (droneId) params.set("drone", droneId);
    return `/bookings/new?${params.toString()}`;
  }, [signedIn, decision, altitudeAglM, slot, droneId]);

  /** The panel's one action: put the engine's own answer into the controls. */
  const onUseNextOpening = useCallback((iso: string) => {
    setTime(selectionForInstant(iso));
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <MapMount
        zones={zones}
        locale={locale}
        labels={labels}
        probePoint={point}
        probeStatus={decision?.status ?? "denied"}
        onPointSelected={setPoint}
        onViewportChange={onViewportChange}
      />

      <StatusPanel
        decision={decision}
        zone={matchedZone}
        locale={locale}
        altitudeAglM={altitudeAglM}
        confirming={confirming}
        onUseNextOpening={onUseNextOpening}
        bookingHref={bookingHref}
      />

      <MapControls
        locale={locale}
        now={new Date(now)}
        zone={matchedZone}
        altitudeAglM={altitudeAglM}
        onAltitudeChange={setAltitude}
        drones={drones}
        droneId={droneId}
        onDroneChange={setDroneId}
        time={time}
        onTimeChange={setTime}
      />
    </div>
  );
}

const CONFIRM_DEBOUNCE_MS = 250;

/**
 * The pilot's only approved drone, when there is exactly one.
 *
 * **Only when there is exactly one.** Picking the first of several would answer
 * for an aircraft the pilot did not choose, and the answer changes with the
 * airframe — a self-built drone and a commercial one get different verdicts in
 * the same zone. With two or more the selector opens on "no aircraft", which
 * asks about the airspace alone and is an honest question in its own right.
 */
function defaultDroneId(drones: readonly DroneOption[]): string | null {
  const approved = drones.filter((drone) => drone.approved);
  return approved.length === 1 ? approved[0].id : null;
}

/**
 * The slot duration of whichever permitted zone holds the point, or `null`.
 *
 * **`zoneContainsPoint`, not a bbox test.** A rectangle around a polygon is a
 * second, looser answer to "is this point in this zone", and the moment two
 * containment rules exist in one codebase they disagree at the edges — here it
 * would silently take a neighbouring zone's slot length. With no zone the
 * engine supplies the default itself, which keeps that number in one place.
 */
function pendingZoneDuration(
  zones: readonly ZoneRule[],
  point: Position | null,
): number | null {
  if (!point) return null;
  const candidate = zones.find(
    (zone) => zone.kind === "permitted" && zoneContainsPoint(zone, point),
  );
  return candidate?.slotDurationMinutes ?? null;
}
