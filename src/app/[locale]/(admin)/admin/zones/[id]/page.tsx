import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { HoursGrid } from "@/components/admin/zone/hours-grid";
import { LifecyclePanel } from "@/components/admin/zone/lifecycle-panel";
import { ZoneForm } from "@/components/admin/zone/zone-form";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import {
  getZoneForAdmin,
  getZoneHoursForAdmin,
  listCitiesForAdmin,
  listPublishedNoFlyZones,
  listZoneBookingImpact,
  listZoneContext,
} from "@/lib/data/zone-admin";
import { toLocale } from "@/lib/locale";
import { zonesToGeoJson } from "@/lib/maps/layer-styles";
import type { ZoneDraft } from "@/lib/validation/zone";
import type { Weekday } from "@/lib/validation/zone-hours";
import { publishReadiness } from "@/lib/validation/zone-publish";

/**
 * `/admin/zones/[id]` — one zone: its boundary, its rules, its week, and the
 * button that turns it into airspace.
 *
 * **The publish readiness is computed here, on the server**, by the same pure
 * `publishReadiness` the action runs. The panel is told what is missing rather
 * than being left to work it out — and because both sides call one function,
 * the screen can never say "ready" over an action that then refuses.
 *
 * **Moving a published boundary is confirmed, not forbidden.** The form asks
 * the server what the change would do, shows the flights it would send back to
 * review, and only then saves. Those flights are *flagged*, never cancelled: a
 * boundary tweak must not quietly void somebody's authorised flight.
 */
export default async function EditZonePage({
  params,
}: PageProps<"/[locale]/admin/zones/[id]">) {
  const locale = toLocale(await localeParam());
  const session = await requireAdmin();
  const t = await getTranslations("zoneAdmin");

  const { id } = await params;
  const zone = await getZoneForAdmin(session, id);
  if (!zone) notFound();

  const [cities, context] = await Promise.all([
    listCitiesForAdmin(session),
    listZoneContext(session, id),
  ]);

  const initial: ZoneDraft = {
    code: zone.code,
    cityId: zone.cityId,
    kind: zone.kind,
    nameAr: zone.nameAr,
    nameEn: zone.nameEn,
    districtAr: zone.districtAr ?? "",
    districtEn: zone.districtEn ?? "",
    notesAr: zone.notesAr ?? "",
    notesEn: zone.notesEn ?? "",
    ceilingAglM: zone.ceilingAglM,
    floorAglM: zone.floorAglM,
    capacity: zone.capacity,
    slotDurationMinutes: zone.slotDurationMinutes,
    minLeadMinutes: zone.minLeadMinutes,
    maxAdvanceDays: zone.maxAdvanceDays,
    maxSlotsPerPilotPerDay: zone.maxSlotsPerPilotPerDay,
    autoApprove: zone.autoApprove,
    nightAllowed: zone.nightAllowed,
    maxWeightClass: zone.maxWeightClass,
    permittedBuildTypes: zone.permittedBuildTypes ?? [],
    requiresBroadcastRid: zone.requiresBroadcastRid,
    authorityRef: zone.authorityRef ?? "",
  };

  const [hours, noFly, impact] = await Promise.all([
    getZoneHoursForAdmin(session, id),
    listPublishedNoFlyZones(session, id),
    listZoneBookingImpact(session, id),
  ]);

  const windows = hours.map((hour) => ({
    weekday: hour.weekday as Weekday,
    opensMinute: hour.opensMinute,
    closesMinute: hour.closesMinute,
  }));

  const readiness = publishReadiness(
    {
      kind: zone.kind,
      nameAr: zone.nameAr,
      nameEn: zone.nameEn,
      capacity: zone.capacity,
      geometry: zone.geometry,
    },
    windows,
    noFly,
  );

  /**
   * Sunrise and sunset are a **place**, not a setting, so the preview needs a
   * coordinate. The bbox centre is the cheap one that is already stored and is
   * well inside a city-sized polygon; a proper centroid would move the answer
   * by seconds of time over a zone this size.
   */
  const centre = {
    lat: (zone.minLat + zone.maxLat) / 2,
    lng: (zone.minLng + zone.maxLng) / 2,
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <Link
          href="/admin/zones"
          className="text-muted-foreground text-sm underline"
        >
          {t("backToZones")}
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">
            {locale === "ar" ? zone.nameAr : zone.nameEn}
          </h1>
          <p dir="ltr" className="text-muted-foreground font-mono text-sm">
            {zone.code}
          </p>
        </div>
        <Badge variant={zone.status === "active" ? "default" : "secondary"}>
          {t(`statuses.${zone.status}`)}
        </Badge>
      </header>

      <ZoneForm
        zoneId={zone.id}
        initial={initial}
        initialGeometry={zone.geometry}
        cities={cities}
        contextGeojson={zonesToGeoJson(context, locale)}
        locale={locale}
        status={zone.status}
      />

      <HoursGrid
        zoneId={zone.id}
        initial={windows}
        locale={locale}
        slotDurationMinutes={zone.slotDurationMinutes}
        minLeadMinutes={zone.minLeadMinutes}
        capacity={zone.capacity}
        nightAllowed={zone.nightAllowed}
        centre={centre}
      />

      <LifecyclePanel
        zoneId={zone.id}
        status={zone.status}
        publishedAt={zone.publishedAt?.toISOString() ?? null}
        readiness={readiness.problems}
        overlappingNoFly={readiness.overlappingNoFly}
        impact={impact.map((row) => ({
          bookingId: row.bookingId,
          pilotName: row.pilotName,
          droneNickname: row.droneNickname,
          slotStart: row.slotStart.toISOString(),
          slotEnd: row.slotEnd.toISOString(),
          status: row.status,
        }))}
        locale={locale}
      />
    </main>
  );
}
