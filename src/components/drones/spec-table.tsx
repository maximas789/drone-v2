import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { serialRequiredFor, type BuildType } from "@/lib/validation/drone";

/**
 * What the pilot declared about this aircraft.
 *
 * **The serial row is absent, not empty, for a self-built or FPV airframe** —
 * the same rule as the wizard's step 2 and its review pane. A row reading
 * "Serial number: —" reintroduces, on the aircraft's own record, the sense that
 * something is missing. Nothing is missing: `serialRequiredFor` says this
 * airframe does not have one, and the Remote ID is what it has instead.
 *
 * Every number goes through `format.ts` before ICU sees it. A bare `{weight}`
 * in a message renders `١٬٤٥٠` under `ar` (thread 22).
 */
export function DroneSpecTable({
  drone,
  locale,
}: {
  drone: {
    nickname: string;
    buildType: string;
    manufacturer: string | null;
    model: string | null;
    propulsion: string | null;
    weightGrams: number;
    weightClass: string;
    hasCamera: boolean;
    serialNumber: string | null;
  };
  locale: Locale;
}) {
  const t = useTranslations("drones");
  const tCommon = useTranslations("common");

  const rows: Array<[string, string]> = [
    [t("nickname"), drone.nickname],
    [t("buildType"), t(`buildTypes.${drone.buildType}`)],
  ];
  if (drone.manufacturer) rows.push([t("manufacturer"), drone.manufacturer]);
  if (drone.model) rows.push([t("model"), drone.model]);
  if (drone.propulsion) rows.push([t("propulsion"), drone.propulsion]);
  rows.push([
    t("weightGrams"),
    t("weightValue", { weight: formatNumber(drone.weightGrams, locale) }),
  ]);
  rows.push([t("weightClass"), t(`weightClasses.${drone.weightClass}`)]);
  rows.push([t("hasCamera"), drone.hasCamera ? tCommon("yes") : tCommon("no")]);

  if (serialRequiredFor(drone.buildType as BuildType) && drone.serialNumber) {
    rows.push([t("serialNumber"), drone.serialNumber]);
  }

  return (
    <dl className="flex flex-col gap-3 rounded-lg border p-4">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-wrap justify-between gap-2">
          <dt className="text-muted-foreground text-xs">{label}</dt>
          <dd className="text-sm">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
