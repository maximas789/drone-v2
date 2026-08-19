"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Field, type Problems } from "@/components/form/field";
import { BUILD_TYPES, type TypeDraft } from "@/lib/validation/drone";

/**
 * Step 1: what this aircraft is, and who built it.
 *
 * **The build type comes first because it decides everything after it** — most
 * importantly whether a serial number field exists at all on step 2.
 *
 * It is three radio cards, not a dropdown. A dropdown hides two of the three
 * answers behind a click, and the two it hides are `self_built` and `fpv` —
 * the aircraft this product exists for. They must be as visible as the
 * commercial option, and read as first-class rather than as an "other".
 */

export function StepType({
  values,
  problems,
  disabled,
  onChange,
}: {
  values: TypeDraft;
  problems: Problems;
  disabled: boolean;
  onChange: (patch: Partial<TypeDraft>) => void;
}) {
  const t = useTranslations("drones");
  const tCommon = useTranslations("common");
  const isCommercial = values.buildType === "commercial";

  return (
    <div className="flex flex-col gap-4">
      <Field
        namespace="drones"
        label={t("nickname")}
        hint={t("nicknameHint")}
        codes={["nickname_required", "text_too_long"]}
        problems={problems}
      >
        {(field) => (
          <Input
            {...field}
            name="nickname"
            aria-required
            maxLength={60}
            disabled={disabled}
            value={values.nickname}
            onChange={(event) => onChange({ nickname: event.target.value })}
          />
        )}
      </Field>

      <fieldset
        className="flex flex-col gap-2"
        aria-invalid={problems.has("build_type_required") || undefined}
      >
        <legend className="text-sm font-medium">{t("buildType")}</legend>

        {BUILD_TYPES.map((type) => (
          <label
            key={type}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-checked:border-ring"
          >
            <input
              type="radio"
              name="buildType"
              value={type}
              className="mt-1 size-4 accent-current"
              disabled={disabled}
              checked={values.buildType === type}
              onChange={() => onChange({ buildType: type })}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                {t(`buildTypes.${type}`)}
              </span>
              <span className="text-muted-foreground text-xs">
                {type === "commercial"
                  ? t("buildTypeCommercialHint")
                  : type === "self_built"
                    ? t("buildTypeSelfBuiltHint")
                    : t("buildTypeFpvHint")}
              </span>
            </span>
          </label>
        ))}

        {problems.has("build_type_required") ? (
          <p className="text-destructive text-xs">
            {t("errors.build_type_required")}
          </p>
        ) : null}
      </fieldset>

      <Field
        namespace="drones"
        label={
          isCommercial
            ? t("manufacturer")
            : `${t("manufacturer")} — ${tCommon("optional")}`
        }
        /**
         * The hint changes with the build type, and that is the point: a
         * self-builder told to "write your own name" understands the field is
         * for them, not a box they are failing to fill.
         */
        hint={
          isCommercial
            ? t("manufacturerHintCommercial")
            : t("manufacturerHintSelfBuilt")
        }
        codes={["manufacturer_required", "text_too_long"]}
        problems={problems}
      >
        {(field) => (
          <Input
            {...field}
            name="manufacturer"
            maxLength={120}
            disabled={disabled}
            value={values.manufacturer}
            onChange={(event) => onChange({ manufacturer: event.target.value })}
          />
        )}
      </Field>

      <Field
        namespace="drones"
        label={`${t("model")} — ${tCommon("optional")}`}
        hint={t("modelHint")}
        codes={["text_too_long"]}
        problems={problems}
      >
        {(field) => (
          <Input
            {...field}
            name="model"
            maxLength={120}
            disabled={disabled}
            value={values.model}
            onChange={(event) => onChange({ model: event.target.value })}
          />
        )}
      </Field>

      <Field
        namespace="drones"
        label={`${t("propulsion")} — ${tCommon("optional")}`}
        hint={t("propulsionHint")}
        codes={["text_too_long"]}
        problems={problems}
      >
        {(field) => (
          <Input
            {...field}
            name="propulsion"
            maxLength={120}
            disabled={disabled}
            value={values.propulsion}
            onChange={(event) => onChange({ propulsion: event.target.value })}
          />
        )}
      </Field>
    </div>
  );
}
