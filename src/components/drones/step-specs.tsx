"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Field, type Problems } from "@/components/form/field";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import {
  mayBeExempt,
  serialRequiredFor,
  weightClassFor,
  type BuildType,
} from "@/lib/validation/drone";

export type SpecsValues = {
  weightGrams: string;
  hasCamera: boolean;
  serialNumber: string;
};

/**
 * Step 2: weight, camera, and — **only for a commercial airframe** — the serial
 * number.
 *
 * **The serial field is not rendered at all for `self_built` and `fpv`.** Not
 * disabled, not marked optional, not shown with "leave blank if…": absent. A
 * greyed-out field that does not apply to you still reads as something you are
 * missing, and this is the exact population GACA's serial requirement locks
 * out. The server agrees — `validateDroneSpecs` refuses a serial sent for an
 * airframe that has no serial field, rather than quietly dropping it.
 *
 * **The class is shown live and never chosen.** A pilot who picks their own
 * weight class picks the flattering one, and the class is what the airspace
 * engine compares a zone's ceiling against.
 *
 * The weight is a text input with `inputMode="numeric"`, not `type="number"`:
 * a number input accepts `1e5`, offers a spinner, and its stepper is a way to
 * change a legal figure by leaning on an arrow key.
 */
export function StepSpecs({
  buildType,
  values,
  locale,
  problems,
  disabled,
  onChange,
}: {
  buildType: BuildType;
  values: SpecsValues;
  locale: Locale;
  problems: Problems;
  disabled: boolean;
  onChange: (patch: Partial<SpecsValues>) => void;
}) {
  const t = useTranslations("drones");
  const cameraId = useId();

  const typed = values.weightGrams.trim();
  const grams = /^\d+$/.test(typed) ? Number(typed) : null;
  const showsSerial = serialRequiredFor(buildType);

  return (
    <div className="flex flex-col gap-4">
      <Field
        namespace="drones"
        label={t("weightGrams")}
        hint={t("weightGramsHint")}
        codes={["weight_required", "weight_out_of_range"]}
        problems={problems}
      >
        {(field) => (
          <Input
            {...field}
            name="weightGrams"
            inputMode="numeric"
            dir="ltr"
            className="text-start font-mono"
            aria-required
            maxLength={7}
            disabled={disabled}
            value={values.weightGrams}
            onChange={(event) => onChange({ weightGrams: event.target.value })}
          />
        )}
      </Field>

      {grams !== null && grams > 0 ? (
        <div
          // `role="status"` so the class is announced as it changes, rather than
          // being a visual-only consequence of typing.
          role="status"
          className="flex flex-col gap-1 rounded-lg border p-3"
        >
          <p className="text-sm">
            {t("weightClassLive", {
              weightClass: t(`weightClasses.${weightClassFor(grams)}`),
            })}
          </p>
          {mayBeExempt(grams) ? (
            /**
             * Stated as *may*, and attributed. An exemption is the regulator's
             * to grant and this app is a proposal, not an authority — but
             * somebody registering a 200 g toy should know the rule exists
             * rather than discover it afterwards.
             */
            <p className="text-muted-foreground text-xs">{t("exemptNote")}</p>
          ) : null}
        </div>
      ) : null}

      <span className="flex items-center gap-2">
        <input
          id={cameraId}
          type="checkbox"
          className="size-4 accent-current"
          disabled={disabled}
          checked={values.hasCamera}
          onChange={(event) => onChange({ hasCamera: event.target.checked })}
        />
        <label htmlFor={cameraId} className="text-sm">
          {t("hasCamera")}
        </label>
      </span>

      {showsSerial ? (
        <Field
          namespace="drones"
          label={t("serialNumber")}
          hint={t("serialNumberRequired")}
          codes={["serial_required", "serial_format", "serial_not_applicable"]}
          problems={problems}
        >
          {(field) => (
            <Input
              {...field}
              name="serialNumber"
              dir="ltr"
              className="text-start font-mono"
              autoComplete="off"
              aria-required
              maxLength={64}
              disabled={disabled}
              value={values.serialNumber}
              onChange={(event) =>
                onChange({ serialNumber: event.target.value })
              }
            />
          )}
        </Field>
      ) : null}

      {/* A weight already typed is echoed back formatted, so the pilot sees the
          same Latin numerals the rest of the app uses — thread 22. */}
      {grams !== null && grams > 0 ? (
        <p className="text-muted-foreground text-xs">
          {t("weightValue", { weight: formatNumber(grams, locale) })}
        </p>
      ) : null}
    </div>
  );
}
