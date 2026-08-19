import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { ZoneForm } from "@/components/admin/zone/zone-form";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { getZoneForAdmin, listCitiesForAdmin, listZoneContext } from "@/lib/data/zone-admin";
import { toLocale } from "@/lib/locale";
import { zonesToGeoJson } from "@/lib/maps/layer-styles";
import type { ZoneDraft } from "@/lib/validation/zone";

/**
 * `/admin/zones/[id]` — one zone, its boundary and its rules.
 *
 * **A published boundary cannot be moved from here, and the form says so.**
 * Editing a live polygon has consequences — every future booking inside it has
 * to be re-evaluated, and the ones that would fall outside shown to the admin
 * *before* saving and then flagged rather than cancelled. That is F23b's, and
 * until it exists `updateZoneAction` refuses a geometry change on anything that
 * is not a draft. Refusing is the honest answer; doing it quietly would leave
 * somebody's authorised flight outside the zone that authorised it.
 *
 * Publish, suspend and archive are absent for the same reason — rule 11 puts
 * every status change in `src/lib/workflow/`, and F23b builds them there.
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
    </main>
  );
}
