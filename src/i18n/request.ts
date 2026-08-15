import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { routing } from "./routing";
import { TIME_ZONE } from "@/lib/locale";

/**
 * The locale comes from `next/root-params`, not the deprecated `requestLocale`.
 *
 * **Trap for later waves:** `next/root-params` does not work inside Server
 * Actions or Route Handlers. Neither does it need to — a server action that
 * wants translated text must pass the locale explicitly:
 *
 *     const t = await getTranslations({ locale, namespace: "drones" });
 *
 * which arrives below as `params.locale` and short-circuits the root-params
 * lookup. Actions in this codebase mostly return machine-readable reason codes
 * and translate at render, so this is the exception rather than the rule.
 */
export default getRequestConfig(async ({ locale: explicitLocale }) => {
  const locale = explicitLocale ?? (await rootParams.locale());

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,

    // Every instant the app renders is Riyadh civil time. Fixed +180.
    timeZone: TIME_ZONE,

    // Shared presets so a date looks the same on every surface. The Gregorian
    // calendar and Latin numerals are forced in src/lib/format.ts, which is
    // where anything user-facing should go through.
    formats: {
      dateTime: {
        short: { day: "numeric", month: "short", year: "numeric" },
        long: { day: "numeric", month: "long", year: "numeric" },
        time: { hour: "2-digit", minute: "2-digit", hour12: false },
      },
      number: {
        integer: { maximumFractionDigits: 0 },
      },
    },
  };
});
