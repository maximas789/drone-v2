"use client";

import { useTranslations } from "next-intl";
import { DateSelect } from "@/components/form/date-select";
import type { Locale } from "@/lib/locale";

/**
 * A date of birth.
 *
 * **The control itself is `DateSelect`** — three selects rather than
 * `<input type="date">`, for the reason that component's own note gives at
 * length: Chrome renders a native date input from the *browser's* locale, not
 * the page's, and ignores `lang` everywhere it is set. On an Arabic Chrome it
 * prints `٠٤/٠٥/٢٠١٢` into what becomes a regulator-facing identity record,
 * which is rule 6 broken through a surface `format.ts` cannot reach.
 *
 * What is left here is the two things that are specific to a *birth* date: the
 * year list counts **backwards** from this year, and the labels come from the
 * `profile` namespace. F22 needed the same control for a Remote ID module's
 * validity window, which counts forwards — so the logic moved down and this
 * became the wrapper rather than being copied.
 *
 * **Three selects also suit the task better than a calendar.** Nobody picks
 * their birth year by paging a month grid back thirty years, and three native
 * selects are a wheel or a sheet on a phone, keyboard-navigable, and correct
 * under RTL with no work.
 */

/** Nobody alive is older than this; the validator agrees. */
const MAX_AGE_YEARS = 120;

export function DateOfBirthInput({
  value,
  locale,
  disabled,
  onChange,
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: {
  value: string;
  locale: Locale;
  disabled: boolean;
  onChange: (value: string) => void;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const t = useTranslations("profile");
  const thisYear = new Date().getUTCFullYear();
  const years = Array.from(
    { length: MAX_AGE_YEARS + 1 },
    (_, index) => thisYear - index,
  );

  return (
    <DateSelect
      value={value}
      years={years}
      labels={{ day: t("dobDay"), month: t("dobMonth"), year: t("dobYear") }}
      locale={locale}
      disabled={disabled}
      onChange={onChange}
      id={id}
      aria-describedby={describedBy}
      aria-invalid={invalid}
    />
  );
}
