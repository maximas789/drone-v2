import { routing } from "@/i18n/routing";

export type Locale = (typeof routing.locales)[number];

export const LOCALES = routing.locales;
export const DEFAULT_LOCALE: Locale = routing.defaultLocale;

/** Riyadh. Fixed +180 — Saudi Arabia has never observed DST. */
export const TIME_ZONE = "Asia/Riyadh";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Narrows an unknown segment value to a locale, falling back to Arabic.
 * Used where a value must resolve to *something* (formatting helpers), never
 * for routing — routing 404s on an unknown locale instead.
 */
export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function direction(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** The name of each locale in its own language, for the switcher. */
export const LOCALE_LABELS: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
};
