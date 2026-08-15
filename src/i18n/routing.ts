import { defineRouting } from "next-intl/routing";

/**
 * Arabic is the app's native language, not a translation of the English.
 *
 * `localePrefix: "always"` means there is never a bare `/zones` — every URL
 * carries its locale, so a link pasted into a WhatsApp group opens in the
 * language the sender was reading.
 *
 * `localeDetection: false` makes the entry point deterministic: a fresh
 * visitor lands on `/ar` regardless of their browser's Accept-Language. A
 * Saudi regulator demoing this must not be silently handed the English UI
 * because their laptop is configured in English.
 */
export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "always",
  localeDetection: false,
});
