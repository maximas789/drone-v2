"use client";

import { useState } from "react";
import { DateSelect, type DateSelectLabels } from "@/components/form/date-select";
import type { Locale } from "@/lib/locale";

/**
 * One end of the audit browser's date range, as `DateSelect` behind a hidden
 * field.
 *
 * **Not `<input type="date">` — thread 46.** The first version of this filter
 * used the native control, and the Arabic page drew its placeholder as
 * `ةنس/رهش/موي`: `يوم/شهر/سنة` with every word reversed and unjoined. Chrome
 * renders a date input from the *browser's* locale and ignores `dir` and `lang`
 * on the element, on the field, and on `<html>` alike — all three were tried,
 * and `getComputedStyle` reported `direction: rtl` over an inline
 * `direction: ltr`, because the UA sheet's rule carries `!important` and beats
 * author styles including inline ones. A chosen date then prints as
 * `٠٤/٠٥/٢٠١٢`: Arabic-Indic digits in a regulator-facing filter. That is rule
 * 6 broken through a surface `format.ts` cannot reach, which is precisely why
 * the rule against the native control exists and why `DateSelect` does.
 *
 * **The hidden input is what keeps the form a plain GET.** The rest of the
 * filter bar is server-rendered and ships no JavaScript; only this control is a
 * client component, and it exists to write `yyyy-mm-dd` into a field the
 * browser submits normally. The filtered log stays a link.
 *
 * A **partial** date submits as the empty string — `DateSelect` reports one
 * that way, and `parseAuditFilters` reads an empty value as no filter. Somebody
 * who picks a month and stops has not asked a question yet, and guessing which
 * day they meant would silently narrow their log.
 */
export function DateFilter({
  id,
  name,
  value,
  years,
  labels,
  locale,
}: {
  id: string;
  name: string;
  value: string;
  years: readonly number[];
  labels: DateSelectLabels;
  locale: Locale;
}) {
  const [current, setCurrent] = useState(value);

  return (
    <>
      <input type="hidden" name={name} value={current} />
      <DateSelect
        id={id}
        value={current}
        years={years}
        labels={labels}
        locale={locale}
        onChange={setCurrent}
      />
    </>
  );
}
