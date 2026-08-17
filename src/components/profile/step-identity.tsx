"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Locale } from "@/lib/locale";
import type { IdDocumentType } from "@/lib/validation/saudi-id";
import { DateOfBirthInput } from "./date-of-birth-input";
import { Field, type Problems } from "./field";

/** Mirrors the `id_document_type` enum. Translated at render, never stored. */
const DOCUMENT_TYPES: readonly IdDocumentType[] = [
  "saudi_national_id",
  "iqama",
  "gcc_id",
];

export type IdentityValues = {
  idDocumentType: IdDocumentType;
  idDocumentNumber: string;
  dateOfBirth: string;
};

/**
 * Step 2: the document, its number, and the date of birth.
 *
 * **The type is chosen, not inferred.** A `1` prefix means a national ID and a
 * `2` an Iqama, so the app *could* fill the dropdown in — but then a mistyped
 * first digit would silently rewrite the claim the pilot made about their own
 * document, in a record a regulator reads. `validateIdDocument` checks the two
 * agree and says so when they do not, which is the more useful answer anyway:
 * the mismatch is almost always a typed digit.
 *
 * **The number input is `inputMode="numeric"`, `dir="ltr"`, and not `type="number"`.**
 * A number input drops leading zeros, offers a spinner nobody wants on an ID, and
 * on some browsers accepts `1e5`. `inputMode` gets the phone keypad without any of
 * that. The value is normalised server-side anyway — Arabic-Indic digits included,
 * because an Arabic-first app whose ID field refuses `٠١٢` would be absurd.
 *
 * **The date of birth is not `<input type="date">`** — see `DateOfBirthInput`.
 * The native control renders from the *browser's* locale, ignoring `lang` on the
 * element and on `<html>`, so on a Chrome set to Arabic it prints Arabic-Indic
 * digits into a regulator-facing field whatever this file says.
 */
export function StepIdentity({
  values,
  locale,
  problems,
  disabled,
  onChange,
}: {
  values: IdentityValues;
  locale: Locale;
  problems: Problems;
  disabled: boolean;
  onChange: (patch: Partial<IdentityValues>) => void;
}) {
  const t = useTranslations("profile");
  const isGcc = values.idDocumentType === "gcc_id";

  return (
    <div className="flex flex-col gap-4">
      <Field
        label={t("idDocumentTypeLabel")}
        codes={[]}
        problems={problems}
      >
        {(field) => (
          <Select
            {...field}
            name="idDocumentType"
            aria-required
            disabled={disabled}
            value={values.idDocumentType}
            onChange={(event) =>
              onChange({ idDocumentType: event.target.value as IdDocumentType })
            }
          >
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`idType.${type}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        label={t("idDocumentNumberLabel")}
        hint={isGcc ? t("idDocumentNumberHintGcc") : t("idDocumentNumberHint")}
        codes={[
          "id_format",
          "id_checksum",
          "id_type_mismatch",
          "id_already_registered",
        ]}
        problems={problems}
      >
        {(field) => (
          <Input
            {...field}
            name="idDocumentNumber"
            inputMode="numeric"
            autoComplete="off"
            dir="ltr"
            className="text-start font-mono"
            aria-required
            maxLength={20}
            disabled={disabled}
            value={values.idDocumentNumber}
            onChange={(event) =>
              onChange({ idDocumentNumber: event.target.value })
            }
          />
        )}
      </Field>

      <Field
        label={t("dateOfBirth")}
        hint={t("dateOfBirthHint")}
        codes={["dob_required", "dob_invalid", "dob_underage"]}
        problems={problems}
      >
        {(field) => (
          <DateOfBirthInput
            {...field}
            locale={locale}
            disabled={disabled}
            value={values.dateOfBirth}
            onChange={(dateOfBirth) => onChange({ dateOfBirth })}
          />
        )}
      </Field>
    </div>
  );
}
