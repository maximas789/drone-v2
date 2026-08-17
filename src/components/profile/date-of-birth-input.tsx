"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Select } from "@/components/ui/select";
import { formatMonthName, formatNumber, formatYear } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * A date of birth, as three selects rather than `<input type="date">`.
 *
 * **Why not the native control.** Chrome renders a date input from the
 * *browser's* locale, not the page's — and it ignores `lang` on the element and
 * on `<html>` alike. On a Chrome set to Arabic it draws the placeholder as the
 * reversed `ةنس/رهش/موي` and a chosen date as `٠٤/٠٥/٢٠١٢`: Arabic-Indic digits,
 * inside the one field that becomes part of a regulator-facing identity record.
 * That is precisely the defect rule 6 exists to prevent, arriving through a
 * route neither the ESLint rule nor `format.ts` can reach — because the app is
 * not the thing doing the rendering. Both were found by opening the page; no
 * check in this repo sees either.
 *
 * So the control is ours. Every numeral goes through `formatNumber` and every
 * month name through `formatMonthName`, which is to say through the forced
 * `ar-SA-u-ca-gregory-nu-latn` tag — Gregorian, Latin numerals, Arabic month
 * names, in both locales.
 *
 * **Three selects also suit the task better than a calendar.** Nobody picks
 * their birth year by paging a month grid back thirty years, and three native
 * selects are a wheel or a sheet on a phone, keyboard-navigable, and correct
 * under RTL with no work.
 *
 * The value is `YYYY-MM-DD`, which is what the `date` column stores and what
 * `validateDateOfBirth` reads. **Impossible days cannot be chosen** — the day
 * list is the real length of the selected month — but the validator still checks
 * it, because the action is reachable without this component ever rendering.
 */

/** Nobody alive is older than this; the validator agrees. */
const MAX_AGE_YEARS = 120;

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one, and it knows about
  // leap years without anybody writing the rule down.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

type Parts = { year: string; month: string; day: string };

function parse(value: string): Parts {
  const [year = "", month = "", day = ""] = value.split("-");
  return { year, month, day };
}

/**
 * `YYYY-MM-DD`, with the day clamped to the month's real length — somebody who
 * picks 31 January and then switches the month to February meant the end of
 * February, not an error.
 */
function compose(parts: Parts): string {
  const clamped = Math.min(
    Number(parts.day),
    daysInMonth(Number(parts.year), Number(parts.month)),
  );
  return `${parts.year}-${parts.month.padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
}

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
  /**
   * **The three parts are held here, not derived from `value`.**
   *
   * A partial date has no `YYYY-MM-DD` to be, so this component reports one as
   * the empty string — and the first version then read its own selects back out
   * of that empty string. Choosing a day cleared it, choosing a month cleared it
   * again, and the year select could never complete a date because the other two
   * had already been forgotten. The selects looked filled and the form insisted
   * the field was empty.
   *
   * Found by filling the form in a browser. Nothing in `typecheck`, `lint`,
   * `build` or the suite sees it — open thread 11 again, third time.
   */
  const [parts, setParts] = useState(() => parse(value));

  // A value set from outside (a reset, or a row loaded into an edit form) wins
  // over what is held here — but only when it actually differs, or every
  // keystroke would fight the parent.
  const composed = parts.year && parts.month && parts.day ? compose(parts) : "";
  if (value !== composed && value !== "") {
    setParts(parse(value));
  }

  const thisYear = new Date().getUTCFullYear();

  const years = Array.from(
    { length: MAX_AGE_YEARS + 1 },
    (_, index) => thisYear - index,
  );
  const months = Array.from({ length: 12 }, (_, index) => index + 1);
  /**
   * Until both a year and a month are chosen, offer 31 — a shorter list would
   * silently drop a valid answer for anyone who fills the fields out of order.
   * Once both are known, the list is the month's real length.
   */
  const dayCount =
    parts.year && parts.month
      ? daysInMonth(Number(parts.year), Number(parts.month))
      : 31;
  const days = Array.from({ length: dayCount }, (_, index) => index + 1);

  function emit(next: { year?: string; month?: string; day?: string }) {
    const merged = { ...parts, ...next };

    if (merged.year && merged.month && merged.day) {
      // Clamp the *held* day too, not only the composed string. Otherwise the
      // day select keeps the value 31 after a switch to February, the shortened
      // option list no longer contains it, and the control renders blank.
      const composedNext = compose(merged);
      setParts(parse(composedNext));
      onChange(composedNext);
      return;
    }

    // Partial is reported as empty rather than as a malformed date: the
    // validator would call `1995--` invalid, and "that date is not valid" is the
    // wrong thing to say to somebody halfway through answering. The parts
    // survive in state; only the *composed* value is empty.
    setParts(merged);
    onChange("");
  }

  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-describedby={describedBy}
    >
      <Select
        id={id}
        aria-label={t("dobDay")}
        aria-invalid={invalid}
        className="w-auto grow"
        disabled={disabled}
        value={parts.day}
        onChange={(event) => emit({ day: event.target.value })}
      >
        <option value="">{t("dobDay")}</option>
        {days.map((day) => (
          <option key={day} value={String(day)}>
            {formatNumber(day, locale)}
          </option>
        ))}
      </Select>

      <Select
        aria-label={t("dobMonth")}
        aria-invalid={invalid}
        className="w-auto grow-[2]"
        disabled={disabled}
        value={parts.month ? String(Number(parts.month)) : ""}
        onChange={(event) => emit({ month: event.target.value })}
      >
        <option value="">{t("dobMonth")}</option>
        {months.map((month) => (
          <option key={month} value={String(month)}>
            {formatMonthName(month, locale)}
          </option>
        ))}
      </Select>

      <Select
        aria-label={t("dobYear")}
        aria-invalid={invalid}
        className="w-auto grow"
        disabled={disabled}
        value={parts.year}
        onChange={(event) => emit({ year: event.target.value })}
      >
        <option value="">{t("dobYear")}</option>
        {years.map((year) => (
          <option key={year} value={String(year)}>
            {formatYear(year, locale)}
          </option>
        ))}
      </Select>
    </div>
  );
}
