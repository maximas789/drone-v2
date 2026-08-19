import { locale as localeParam } from "next/root-params";
import { getTranslations } from "next-intl/server";
import { ZoneList } from "@/components/airspace/zone-list";
import { Disclaimer } from "@/components/layout/disclaimer";
import { PublicPage } from "@/components/layout/public-page";
import { AirspaceExplorer } from "@/components/map/airspace-explorer";
import type { DroneOption } from "@/components/map/map-controls";
import { ZoneLegend } from "@/components/map/zone-legend";
import { ButtonLink } from "@/components/ui/button-link";
import {
  aircraftContextFor,
  pilotContextFor,
  zonesForViewport,
} from "@/lib/airspace/query";
import type { AircraftContext, DroneStatusValue } from "@/lib/airspace/types";
import { getSession } from "@/lib/auth-guards";
import { listMyDrones } from "@/lib/data/drone";
import { listActiveZones, listHoursForZones } from "@/lib/data/zone";
import { SAUDI_BOUNDS } from "@/lib/geo/bbox";
import { toLocale, type Locale } from "@/lib/locale";
import type { Session } from "@/lib/session";

/**
 * The published airspace, and the question you can ask it.
 *
 * **The interactive map, as of F20.** F16b shipped this page with a
 * server-rendered SVG because MapLibre would not draw (thread 53, since
 * closed); F20a mounted the map; F20b made it answer. The map replaces the
 * *picture* and nothing else — `listActiveZones` still feeds the list below, so
 * there is no second answer about where a zone is. The landing page keeps the
 * SVG: ~800 kB of map engine for a non-interactive image is the wrong trade on
 * the page that has to load fast, and `zone-palette.ts` stops the two drifting.
 *
 * **The zones are read twice, deliberately, and not by two different rules.**
 * `zonesForViewport` returns full `ZoneRule`s — hours, closures, capacity, the
 * lot — because the browser evaluates against them; `listActiveZones` returns
 * the display rows the list has always used, which also carry the district and
 * the notes. Same table, same filter, two projections. Collapsing them would
 * mean either pushing the list's prose into the engine's context or dropping it
 * from the page.
 *
 * **Signed out is a first-class case.** Where you may fly is public, so the map
 * answers without an account; only the *eligibility* half of the question needs
 * one, and without a session it is simply not asked. A signed-out reader gets
 * refusals about the airspace, never about themselves.
 *
 * **No booking here — F21 does not exist yet.** The allowed panel names the next
 * step in words rather than offering a button to a route that 404s. Same call
 * F16a's footer made about Docs and Privacy.
 *
 * Nothing in `<head>` is set here. F30 owns the title.
 */

/** A month, matching `/api/zones/geojson` — the booking horizon. */
const CLOSURE_HORIZON_DAYS = 30;

export default async function ZonesPage() {
  const locale = toLocale(await localeParam());
  const t = await getTranslations("zones");
  /**
   * The map's own namespace, not `zones`. The MapLibre wrapper takes its few
   * strings pre-translated, and F20b's panel and controls read the same
   * namespace, so all of the map's copy has one home.
   */
  const tMap = await getTranslations("map");
  const session = await getSession();
  const signedIn = Boolean(session);

  const now = new Date();
  const zones = await listActiveZones(session);
  const hours = await listHoursForZones(
    session,
    zones.map((zone) => zone.id),
  );

  const rules = await zonesForViewport(session, SAUDI_BOUNDS, {
    from: now,
    to: new Date(now.getTime() + CLOSURE_HORIZON_DAYS * 24 * 60 * 60_000),
  });

  const { drones, aircraft } = await pilotAircraft(session, locale);
  const pilot = session ? await pilotContextFor(session) : null;

  return (
    <PublicPage signedIn={signedIn}>
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold text-balance sm:text-4xl">
          {t("pageTitle")}
        </h1>
        <p className="text-muted-foreground text-lg">{t("pageLead")}</p>
        <Disclaimer locale={locale} />
      </header>

      {zones.length > 0 ? (
        <>
          <div className="flex flex-col gap-4">
            <AirspaceExplorer
              initialZones={rules}
              locale={locale}
              labels={{
                loading: tMap("loadingZones"),
                tileFailure: tMap("tileFailure"),
                mapLabel: tMap("ariaLabel"),
              }}
              drones={drones}
              aircraft={aircraft}
              pilot={pilot}
              now={now.toISOString()}
              signedIn={signedIn}
            />
            <ZoneLegend />
          </div>
          <ZoneList zones={zones} hours={hours} locale={locale} />
        </>
      ) : (
        /**
         * The seed has not been run. Saying so beats an empty page that looks
         * like a country with no airspace in it.
         */
        <p className="text-muted-foreground">{t("noZones")}</p>
      )}

      <section className="bg-card flex flex-col gap-3 rounded-lg border p-5">
        <h2 className="text-lg font-medium">{t("bookingTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("bookingBody")}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={signedIn ? "/drones/new" : "/sign-up"}>
            {t("bookingCta")}
          </ButtonLink>
          <ButtonLink variant="outline" href="/how-it-works">
            {t("howItWorksCta")}
          </ButtonLink>
        </div>
      </section>
    </PublicPage>
  );
}

/** `drone.status` → its catalogue key, exhaustively. */
const STATUS_KEY: Record<DroneStatusValue, string> = {
  draft: "statusDraft",
  pending: "statusPending",
  approved: "statusApproved",
  rejected: "statusRejected",
  expired: "statusExpired",
  revoked: "statusRevoked",
};

/**
 * The reader's own aircraft, in the two shapes the map needs: a label for the
 * selector, and an `AircraftContext` for the engine.
 *
 * **Every drone, not only the approved ones.** Choosing a rejected airframe is
 * how a pilot discovers that `drone_not_approved` — rather than the airspace —
 * is what stands between them and a flight. Filtering the list would replace a
 * specific, fixable answer with a mystery.
 *
 * Assembled on the server so a tap is answered without a round trip.
 * `aircraftContextFor` reads through `getDroneById`, which is session-scoped, so
 * nothing here can reach an aircraft that is not the reader's.
 */
async function pilotAircraft(
  session: Session | null,
  locale: Locale,
): Promise<{
  drones: DroneOption[];
  aircraft: Record<string, AircraftContext>;
}> {
  if (!session) return { drones: [], aircraft: {} };

  const t = await getTranslations({ locale, namespace: "drones" });
  const rows = await listMyDrones(session);

  const drones: DroneOption[] = [];
  const aircraft: Record<string, AircraftContext> = {};

  for (const row of rows) {
    const context = await aircraftContextFor(session, row.id);
    if (!context) continue;

    drones.push({
      id: row.id,
      /**
       * The status rides in the label because a native `<option>` holds text and
       * nothing else — and "which of my drones may actually fly" is the question
       * a pilot is asking the moment they open this select.
       */
      label: `${row.nickname} — ${t(STATUS_KEY[row.status])}`,
      approved: row.status === "approved",
    });
    aircraft[row.id] = context;
  }

  return { drones, aircraft };
}
