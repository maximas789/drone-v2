import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import type { BookableDrone } from "@/components/booking/drone-select";
import { NewBooking } from "@/components/booking/new-booking";
import type { BookableZone } from "@/components/booking/wizard";
import { zonesForViewport } from "@/lib/airspace/query";
import { requirePilotProfile } from "@/lib/auth-guards";
import { getRemoteIdForDrone, listMyDrones } from "@/lib/data/drone";
import { SAUDI_BOUNDS } from "@/lib/geo/bbox";
import { toLocale } from "@/lib/locale";
import type { Metadata } from "next";
import { privatePageTitle } from "@/lib/site/metadata";

/**
 * `/bookings/new` — the booking wizard.
 *
 * **`requirePilotProfile`, with a `next`.** A pilot with no complete profile is
 * sent to F17's wizard and returned here. The submission gate still refuses
 * `pilot_profile_incomplete` on its own, because the action is reachable
 * without this page ever rendering — but a pilot should never reach step six
 * only to be told the problem was on a screen they have not seen.
 *
 * **The pre-fill comes from the query string, not from client state.** The map
 * links here with the zone, the slot, the altitude and the aircraft it already
 * knows; a refresh, a shared link or a back button therefore lands on the same
 * question rather than a blank form. Nothing here is trusted: `createBooking`
 * re-runs the full evaluation over rows it reads itself.
 *
 * **Only permitted zones are offered.** A restricted or no-fly zone has no slot
 * grid — there is nothing to book — and listing one so it can refuse would be
 * offering a control that exists to say no.
 */

/** A month, matching `/api/zones/geojson` and `/zones`. */
const CLOSURE_HORIZON_DAYS = 30;

export default async function NewBookingPage({
  searchParams,
}: PageProps<"/[locale]/bookings/new">) {
  const locale = toLocale(await localeParam());
  const { session } = await requirePilotProfile(locale, "/bookings/new");
  const t = await getTranslations("booking");

  const params = await searchParams;
  const now = new Date();

  const rules = await zonesForViewport(session, SAUDI_BOUNDS, {
    from: now,
    to: new Date(now.getTime() + CLOSURE_HORIZON_DAYS * 24 * 60 * 60_000),
  });

  const zones: BookableZone[] = rules
    .filter((zone) => zone.kind === "permitted" && zone.status === "active")
    .map((zone) => ({
      id: zone.id,
      nameAr: zone.nameAr,
      nameEn: zone.nameEn,
      ceilingAglM: zone.ceilingAglM,
      maxAdvanceDays: zone.maxAdvanceDays,
      nightAllowed: zone.nightAllowed,
      autoApprove: zone.autoApprove,
      hours: zone.hours,
    }));

  const drones = await bookableDrones(session);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("newTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("newIntro")}</p>
      </header>

      {zones.length === 0 ? (
        <p className="text-muted-foreground">{t("noZones")}</p>
      ) : (
        <NewBooking
          zones={zones}
          drones={drones}
          locale={locale}
          prefill={{
            zoneId: single(params.zone),
            droneId: single(params.drone),
            slotStart: single(params.slot),
            altitudeAglM: numberOrNull(single(params.altitude)),
          }}
        />
      )}
    </main>
  );
}

/** A repeated query parameter is a hand-made URL; take the first and move on. */
function single(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function numberOrNull(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * The pilot's aircraft, each carrying **why** it cannot be booked rather than
 * being dropped from the list.
 *
 * `remote_id` is read per drone because `booking.remoteIdId` is `NOT NULL` — an
 * approved aircraft that somehow has no Remote ID row cannot be booked, and
 * saying so here is better than a refusal at step six from a rule the pilot
 * cannot see.
 */
async function bookableDrones(
  session: Parameters<typeof listMyDrones>[0],
): Promise<BookableDrone[]> {
  const rows = await listMyDrones(session);
  const out: BookableDrone[] = [];

  for (const row of rows) {
    const remoteId = await getRemoteIdForDrone(session, row.id);

    const blockedReason =
      row.status === "revoked"
        ? "droneBlockedRevoked"
        : row.status === "expired"
          ? "droneBlockedExpired"
          : row.status !== "approved"
            ? "droneBlockedNotApproved"
            : !remoteId
              ? "droneBlockedNoRemoteId"
              : remoteId.status !== "active"
                ? "droneBlockedRemoteIdInactive"
                : null;

    out.push({
      id: row.id,
      nickname: row.nickname,
      remoteIdCode: remoteId?.code ?? null,
      blockedReason,
      expiresAt: row.registrationExpiresAt
        ? row.registrationExpiresAt.toISOString()
        : null,
    });
  }

  // Bookable first: the list is a control, and its first row should be one the
  // pilot can actually choose.
  return out.sort((a, b) => Number(a.blockedReason !== null) - Number(b.blockedReason !== null));
}

/**
 * Its own tab title, from the same string this page renders as its heading.
 * `robots` comes from the route group's layout — see `PRIVATE_ROBOTS`.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/bookings/new">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "booking.newTitle");
}
