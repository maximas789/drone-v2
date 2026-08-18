"use client";

import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { serialRequiredFor, weightClassFor, type BuildType } from "@/lib/validation/drone";

/**
 * Step 5: everything on one screen, and an honest statement of what pressing
 * the button does.
 *
 * **The notice is not decoration.** A government-shaped form that answers
 * instantly trains people to expect an instant answer; this one says a human
 * reviewer decides it and approval is not immediate, before they submit rather
 * than after they start waiting.
 *
 * The serial row is **absent** for a self-built or FPV airframe, exactly as the
 * field was on step 2 — a review screen listing "Serial number: —" would
 * reintroduce, at the last moment, the sense of something missing.
 */
export function StepReview({
  values,
  photoCount,
  locale,
}: {
  values: {
    nickname: string;
    buildType: BuildType;
    manufacturer: string;
    model: string;
    propulsion: string;
    weightGrams: string;
    hasCamera: boolean;
    serialNumber: string;
  };
  photoCount: number;
  locale: Locale;
}) {
  const t = useTranslations("drones");
  const tCommon = useTranslations("common");

  const grams = /^\d+$/.test(values.weightGrams.trim())
    ? Number(values.weightGrams.trim())
    : null;

  const rows: Array<[string, string]> = [
    [t("nickname"), values.nickname],
    [t("buildType"), t(`buildTypes.${values.buildType}`)],
  ];
  if (values.manufacturer) rows.push([t("manufacturer"), values.manufacturer]);
  if (values.model) rows.push([t("model"), values.model]);
  if (values.propulsion) rows.push([t("propulsion"), values.propulsion]);
  if (grams !== null) {
    // Formatted, not interpolated raw — a bare number reaching ICU renders
    // Arabic-Indic digits (thread 22).
    rows.push([t("weightGrams"), t("weightValue", { weight: formatNumber(grams, locale) })]);
    rows.push([t("weightClass"), t(`weightClasses.${weightClassFor(grams)}`)]);
  }
  rows.push([t("hasCamera"), values.hasCamera ? tCommon("yes") : tCommon("no")]);
  if (serialRequiredFor(values.buildType)) {
    rows.push([t("serialNumber"), values.serialNumber]);
  }
  rows.push([t("photo"), formatNumber(photoCount, locale)]);
  rows.push([t("remoteIdLabel"), t("remoteIdPending")]);

  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col gap-3 rounded-lg border p-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="text-sm">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="border-s-2 ps-3 text-sm">{t("reviewSubmitNotice")}</p>
    </div>
  );
}
