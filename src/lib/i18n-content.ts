import { DEFAULT_LOCALE, type Locale } from "@/lib/locale";

/**
 * Bilingual **data** — zone names, closure reasons, anything a human typed
 * into an admin form. Stored as paired `*_ar` / `*_en` columns, because they
 * index, sort, and map 1:1 onto the two fields of the form that wrote them.
 *
 * UI chrome does not come through here. That lives in `messages/{ar,en}.json`
 * and is read with `useTranslations`.
 */
export type Localized = {
  ar: string;
  en: string;
};

/**
 * Falls back to Arabic, never to an empty string: Arabic is authored first, so
 * a missing English translation means the row predates its translation — and a
 * zone with a blank name on the map is worse than one named in Arabic.
 */
export function pick(content: Localized, locale: Locale): string {
  const preferred = content[locale];
  if (preferred && preferred.trim().length > 0) return preferred;
  return content[DEFAULT_LOCALE];
}

/**
 * Builds a `Localized` from a row carrying the paired-column convention, e.g.
 * `pickColumns(zone, "name", locale)` reads `zone.nameAr` / `zone.nameEn`.
 */
export function pickColumns<
  Field extends string,
  Row extends Record<`${Field}Ar` | `${Field}En`, string>,
>(row: Row, field: Field, locale: Locale): string {
  return pick(
    { ar: row[`${field}Ar` as keyof Row] as string, en: row[`${field}En` as keyof Row] as string },
    locale,
  );
}
