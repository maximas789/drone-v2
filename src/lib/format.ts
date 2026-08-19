import { DEFAULT_LOCALE, TIME_ZONE, type Locale } from "@/lib/locale";

/**
 * The single formatting choke point. An ESLint rule bans `Intl` and
 * `toLocale*String` everywhere else in the codebase, and this file is the
 * only exemption.
 *
 * **Why it exists:** `new Date().toLocaleDateString("ar-SA")` returns
 * `١٥‏/٩‏/١٤٤٧ هـ` — a Hijri date in Arabic-Indic digits. For an aviation
 * booking platform, where a slot time is a legal commitment, that is wrong in
 * two separate ways at once. The `-u-ca-gregory-nu-latn` extension forces the
 * Gregorian calendar and Latin numerals while keeping Arabic month names and
 * Arabic word order.
 */
const LOCALE_TAG: Record<Locale, string> = {
  ar: "ar-SA-u-ca-gregory-nu-latn",
  en: "en-GB",
};

/**
 * Riyadh is UTC+3 year-round. Saudi Arabia has never observed DST.
 * `format.test.ts` asserts this against `Intl` in both January and July —
 * that test is what catches it if the assumption ever stops holding.
 */
export const RIYADH_OFFSET_MINUTES = 180;

function tag(locale: Locale): string {
  return LOCALE_TAG[locale] ?? LOCALE_TAG[DEFAULT_LOCALE];
}

/**
 * The same forced tag, for the one caller that hands a locale to somebody
 * else's formatter rather than formatting itself: `createTranslator` in
 * `src/lib/email/i18n.ts` compiles ICU messages, and ICU does its own number
 * formatting for `{n, plural, … #}`. Given a bare `ar` it emits `٣`; given
 * this tag it emits `3` and still picks the Arabic plural category.
 *
 * Exported rather than inlined so there is exactly one place that knows what
 * the extension has to be.
 */
export function intlLocaleTag(locale: Locale): string {
  return tag(locale);
}

function dateTimeFormat(
  locale: Locale,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(tag(locale), {
    timeZone: TIME_ZONE,
    ...options,
  });
}

function numberFormat(
  locale: Locale,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  return new Intl.NumberFormat(tag(locale), options);
}

// --- Dates and times ------------------------------------------------------

/** `15 مارس 2026` / `15 Mar 2026` — Gregorian, Latin numerals in both. */
export function formatDate(date: Date, locale: Locale): string {
  return dateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** 24-hour Riyadh-local time. No AM/PM in either locale — aviation reads 24h. */
export function formatTime(date: Date, locale: Locale): string {
  return dateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDateTime(date: Date, locale: Locale): string {
  return dateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * A booking slot: `15 مارس 2026، 14:00 – 16:00`, collapsing the date when
 * both ends fall on the same Riyadh day.
 */
export function formatDateRange(
  start: Date,
  end: Date,
  locale: Locale,
): string {
  if (riyadhDayKey(start) !== riyadhDayKey(end)) {
    return `${formatDateTime(start, locale)} – ${formatDateTime(end, locale)}`;
  }
  // Arabic uses its own comma (U+060C), which also sits the right way round.
  const comma = locale === "ar" ? "،" : ",";
  return `${formatDate(start, locale)}${comma} ${formatTime(start, locale)} – ${formatTime(end, locale)}`;
}

/** `منذ 3 دقائق` / `3 minutes ago`. Used by the notification list. */
export function formatRelativeTime(
  date: Date,
  locale: Locale,
  now: Date = new Date(),
): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];

  const formatter = new Intl.RelativeTimeFormat(tag(locale), {
    numeric: "auto",
  });

  for (const [unit, secondsPerUnit] of units) {
    if (Math.abs(seconds) >= secondsPerUnit || unit === "second") {
      return formatter.format(Math.round(seconds / secondsPerUnit), unit);
    }
  }
  return formatter.format(0, "second");
}

/**
 * `الأحد` / `Sunday` — a standalone weekday name from its index, **Sunday = 0**.
 *
 * `zone_hour.weekday` is an integer, not an instant, so there is nothing to
 * format until one is built. The reference date is a real Sunday
 * (2024-01-07) advanced by the index and read back in **UTC**, so the +3 civil
 * day cannot roll it into Monday. The year is never rendered.
 *
 * Same reasoning as `formatMonthName`: CLDR already knows both languages'
 * weekday names, so nothing has to be written into the message catalogue and
 * nothing can drift out of step with the calendar the rest of the app uses.
 */
export function formatWeekday(weekday: number, locale: Locale): string {
  const sunday = Date.UTC(2024, 0, 7);
  return dateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(
    new Date(sunday + weekday * 24 * 60 * 60 * 1000),
  );
}

/**
 * `06:00` — an opening time held as minutes from local midnight.
 *
 * **UTC, not `Asia/Riyadh`.** A `zone_hour` is already a Riyadh civil time; it
 * is a time *of day*, not an instant, and running it through the +3 offset
 * again would print 09:00 for a zone that opens at 06:00. The date the minutes
 * are hung on is arbitrary and never rendered.
 *
 * 24-hour in both locales, for the reason `formatTime` gives: aviation reads
 * 24h, and the Latin numerals come from the forced locale tag.
 */
export function formatMinuteOfDay(minutes: number, locale: Locale): string {
  return dateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1) + minutes * 60 * 1000));
}

// --- Riyadh civil calendar ------------------------------------------------

/**
 * `YYYY-MM-DD` for the Riyadh civil day an instant falls on. Not user-facing —
 * this is the key slot derivation and closure lookups group by, so it must not
 * drift with the server's own timezone.
 */
export function riyadhDayKey(date: Date): string {
  // `en-CA` yields ISO-ordered YYYY-MM-DD, which sorts lexicographically.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Day of the week in Riyadh, **Sunday = 0**. The Saudi working week starts on
 * Sunday, so every recurring-availability rule in F13 is indexed this way.
 * Deliberately not `Date#getDay()`, which reads the *server's* timezone.
 */
export function riyadhWeekday(date: Date): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
  }).format(date);

  const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
  return index as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

// --- Numbers and units ----------------------------------------------------

/**
 * `مارس` / `March` — a standalone month name.
 *
 * For a date assembled from three separate controls, where there is no instant
 * to format yet because the person has only chosen the month so far. F17's date
 * of birth needs it: a native `type="date"` input renders from the **browser's**
 * locale, not the page's, so on a Chrome set to Arabic it prints `٠٤/٠٥/٢٠١٢`
 * whatever the markup says — Arabic-Indic digits in a field that becomes part of
 * a regulator-facing record. Building the control ourselves is the only way the
 * rule this module exists to enforce reaches it.
 *
 * The year is arbitrary and never rendered; only the month is read out of it.
 * Noon UTC so the +3 civil day cannot slip to the previous month.
 */
export function formatMonthName(month: number, locale: Locale): string {
  return dateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, month - 1, 15, 12)),
  );
}

/**
 * `1995`, never `1,995`.
 *
 * A year is a label, not a quantity, so it takes no thousands separator —
 * `formatNumber` would group it. Separate from `formatNumber` rather than a flag
 * on it, because "is this a year" is a question the call site can answer and the
 * formatter cannot.
 */
export function formatYear(year: number, locale: Locale): string {
  return numberFormat(locale, { useGrouping: false }).format(year);
}

export function formatNumber(value: number, locale: Locale): string {
  return numberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

/**
 * `٨ ميغابايت` / `8 MB` — a file-size ceiling, unit included.
 *
 * Binary megabytes, because that is what the limit is expressed in, and CLDR's
 * `megabyte` unit is the closest thing it has a translation for. Same reasoning
 * as `formatSeconds`: the unit is formatted here rather than as an ICU plural,
 * so Arabic's six plural categories come from CLDR and `i18n:check` never sees
 * a plural branch it would report as drift.
 */
export function formatBytes(bytes: number, locale: Locale): string {
  const megabytes = bytes / (1024 * 1024);
  return numberFormat(locale, {
    style: "unit",
    unit: "megabyte",
    maximumFractionDigits: megabytes < 10 ? 1 : 0,
  }).format(megabytes);
}

/** Metres below 1 km, kilometres above. Distances to a zone boundary. */
export function formatDistance(metres: number, locale: Locale): string {
  return metres < 1000
    ? numberFormat(locale, {
        style: "unit",
        unit: "meter",
        maximumFractionDigits: 0,
      }).format(metres)
    : numberFormat(locale, {
        style: "unit",
        unit: "kilometer",
        maximumFractionDigits: 1,
      }).format(metres / 1000);
}

/**
 * `45 ثانية` / `45 seconds` — a countdown, unit included.
 *
 * The unit is formatted **here** rather than as an ICU plural in the message
 * catalogue, for two reasons. CLDR already knows Arabic's six plural
 * categories and English's two, so nobody has to write them out; and
 * `scripts/i18n-check.mts` cannot tell a plural branch body (`one {second}`)
 * from a placeholder (`{second}`) and reports the first as drift.
 */
export function formatSeconds(seconds: number, locale: Locale): string {
  return numberFormat(locale, {
    style: "unit",
    unit: "second",
    unitDisplay: "long",
    maximumFractionDigits: 0,
  }).format(seconds);
}

/**
 * `3 أيام` / `3 days` — how long a submission has been waiting.
 *
 * The unit is formatted **here** rather than as an ICU plural in the message
 * catalogue, for the two reasons `formatSeconds` gives: CLDR already knows
 * Arabic's six plural categories and English's two, so nobody writes them out;
 * and `scripts/i18n-check.mts` cannot tell a plural branch body (`one {day}`)
 * from a placeholder (`{day}`) and reports the first as drift (thread 23).
 *
 * It is also the route around thread 22 — a bare `{days}` reaching an ICU
 * message is formatted by next-intl under the page locale and renders `٣`.
 */
export function formatDays(days: number, locale: Locale): string {
  return numberFormat(locale, {
    style: "unit",
    unit: "day",
    unitDisplay: "long",
    maximumFractionDigits: 0,
  }).format(days);
}

/**
 * `24 ساعة` / `24 hours` — the width of a window, not a clock time.
 *
 * The sibling of `formatDays`, for the same three reasons, and used where a
 * *threshold* is being explained rather than an instant: "a slot starting
 * within 24 hours is flagged". An instant goes through `formatTime`.
 */
export function formatHours(hours: number, locale: Locale): string {
  return numberFormat(locale, {
    style: "unit",
    unit: "hour",
    unitDisplay: "long",
    maximumFractionDigits: 0,
  }).format(hours);
}

/** Altitude is always metres AGL in this app — never feet. */
export function formatAltitude(metres: number, locale: Locale): string {
  return numberFormat(locale, {
    style: "unit",
    unit: "meter",
    maximumFractionDigits: 0,
  }).format(metres);
}

/** Zone area. Square kilometres, one decimal. */
export function formatArea(squareMetres: number, locale: Locale): string {
  return `${numberFormat(locale, { maximumFractionDigits: 1 }).format(
    squareMetres / 1_000_000,
  )} ${locale === "ar" ? "كم²" : "km²"}`;
}
