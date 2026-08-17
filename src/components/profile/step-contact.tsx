"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, type Problems } from "./field";

export type CityOption = { id: string; nameAr: string; nameEn: string };

export type ContactValues = {
  mobileE164: string;
  addressCityId: string;
  addressLine: string;
  emergencyContact: string;
};

/**
 * Step 3: how the app reaches this pilot.
 *
 * **Nothing here is a verification channel, and the page says so out loud.** The
 * notice under the mobile field is not boilerplate — it is the honest answer to
 * what a pilot expects next after typing a phone number into a government-shaped
 * form, which is a text message. There is no SMS provider in this app, there is
 * no `mobileVerifiedAt` column, and identity is confirmed by a person reading a
 * document. Saying "we will send you a code" would be a lie; saying nothing lets
 * the reader assume one.
 *
 * The number is still worth collecting: it is how a reviewer, or an authority
 * looking at a Remote ID scan for an aircraft currently in the air, reaches the
 * operator.
 */
export function StepContact({
  values,
  cities,
  locale,
  problems,
  disabled,
  onChange,
}: {
  values: ContactValues;
  cities: readonly CityOption[];
  locale: "ar" | "en";
  problems: Problems;
  disabled: boolean;
  onChange: (patch: Partial<ContactValues>) => void;
}) {
  const t = useTranslations("profile");
  // `common.optional` already exists and is already translated. A second
  // "optional" under `profile` would be the same word in the catalogue twice,
  // free to drift.
  const tCommon = useTranslations("common");

  return (
    <div className="flex flex-col gap-4">
      <Field
        label={t("mobile")}
        hint={t("mobileHint")}
        codes={["mobile_format"]}
        problems={problems}
      >
        {(field) => (
          <Input
            {...field}
            name="mobileE164"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            className="text-start font-mono"
            aria-required
            maxLength={20}
            disabled={disabled}
            value={values.mobileE164}
            onChange={(event) => onChange({ mobileE164: event.target.value })}
          />
        )}
      </Field>

      <p className="text-muted-foreground border-s-2 ps-3 text-xs">
        {t("mobileContactOnlyNotice")}
      </p>

      <Field
        label={t("cityLabel")}
        codes={["city_required"]}
        problems={problems}
      >
        {(field) => (
          <Select
            {...field}
            name="addressCityId"
            aria-required
            disabled={disabled}
            value={values.addressCityId}
            onChange={(event) => onChange({ addressCityId: event.target.value })}
          >
            <option value="">{t("cityPlaceholder")}</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {/* A city name is human-authored content, so it lives as a
                    paired `*_ar`/`*_en` column and the reader's language picks
                    one. Never a code translated in the catalogue. */}
                {locale === "ar" ? city.nameAr : city.nameEn}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        label={`${t("addressLine")} — ${tCommon("optional")}`}
        codes={["address_too_long"]}
        problems={problems}
      >
        {(field) => (
          <Input
            {...field}
            name="addressLine"
            autoComplete="street-address"
            maxLength={200}
            disabled={disabled}
            value={values.addressLine}
            onChange={(event) => onChange({ addressLine: event.target.value })}
          />
        )}
      </Field>

      <Field
        label={`${t("emergencyContact")} — ${tCommon("optional")}`}
        hint={t("emergencyContactHint")}
        codes={["emergency_contact_format"]}
        problems={problems}
      >
        {(field) => (
          <Input
            {...field}
            name="emergencyContact"
            type="tel"
            inputMode="tel"
            dir="ltr"
            className="text-start font-mono"
            maxLength={20}
            disabled={disabled}
            value={values.emergencyContact}
            onChange={(event) =>
              onChange({ emergencyContact: event.target.value })
            }
          />
        )}
      </Field>
    </div>
  );
}
