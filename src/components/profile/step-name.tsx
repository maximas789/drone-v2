"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Field, type Problems } from "./field";

/**
 * Step 1: the name, in both languages.
 *
 * **`dir` and `lang` are set on the inputs themselves**, not inherited from the
 * page. Under `dir="rtl"` a Latin name typed into an inheriting input has its
 * punctuation and any trailing initial reordered — `Al-Harbi, M.` renders with
 * the comma and the stop on the wrong side — and the reverse happens to an
 * Arabic name inside an English page. `lang` is what tells the browser and a
 * screen reader which language to shape and pronounce the text as; without it an
 * Arabic name is read out by an English voice.
 *
 * Both names are required, and neither is derived from the other. Transliterating
 * automatically would put a spelling in a regulator-facing record that the person
 * never chose, and Arabic names have several accepted Latin spellings — the one
 * on their passport is the one that has to match.
 */
export function StepName({
  values,
  problems,
  disabled,
  onChange,
}: {
  values: { fullNameAr: string; fullNameEn: string };
  problems: Problems;
  disabled: boolean;
  onChange: (patch: Partial<{ fullNameAr: string; fullNameEn: string }>) => void;
}) {
  const t = useTranslations("profile");

  return (
    <div className="flex flex-col gap-4">
      <Field
        label={t("fullNameAr")}
        hint={t("fullNameArHint")}
        codes={["name_ar_required", "name_ar_script"]}
        problems={problems}
      >
        {(field) => (
          <Input
            {...field}
            name="fullNameAr"
            dir="rtl"
            lang="ar"
            autoComplete="name"
            aria-required
            maxLength={100}
            disabled={disabled}
            value={values.fullNameAr}
            onChange={(event) => onChange({ fullNameAr: event.target.value })}
          />
        )}
      </Field>

      <Field
        label={t("fullNameEn")}
        hint={t("fullNameEnHint")}
        codes={["name_en_required", "name_en_script"]}
        problems={problems}
      >
        {(field) => (
          <Input
            {...field}
            name="fullNameEn"
            dir="ltr"
            lang="en"
            // `text-start` keeps the text on the reading edge of the input even
            // though the input's own direction is LTR inside an RTL page.
            className="text-start"
            autoComplete="name"
            aria-required
            maxLength={100}
            disabled={disabled}
            value={values.fullNameEn}
            onChange={(event) => onChange({ fullNameEn: event.target.value })}
          />
        )}
      </Field>
    </div>
  );
}
