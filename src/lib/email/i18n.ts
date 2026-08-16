import { createTranslator } from "next-intl";
import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { intlLocaleTag } from "@/lib/format";
import { TIME_ZONE, type Locale } from "@/lib/locale";

/**
 * Translation for email, **independent of the request**.
 *
 * `getTranslations()` cannot be used here. Emails are sent from three places
 * that have no next-intl request context to read: Better Auth's callbacks
 * inside a Route Handler (where `next/root-params` throws — Open Thread 4), an
 * Inngest function (F08, which has no request at all), and the preview page.
 * `createTranslator` is next-intl's own request-free core and takes the
 * catalogue directly.
 *
 * The catalogues are imported statically rather than with `await import()` so
 * that a missing key is a build failure and not a runtime one.
 */
const catalogues = { ar, en } satisfies Record<Locale, typeof ar>;

export type EmailTranslator = ReturnType<typeof emailTranslator>;

export function emailTranslator(locale: Locale) {
  return createTranslator({
    // Not the bare locale. ICU formats `{n, plural, … #}` itself, and `ar`
    // alone would put Arabic-Indic digits into a slot time. See
    // `intlLocaleTag` in src/lib/format.ts.
    locale: intlLocaleTag(locale),
    timeZone: TIME_ZONE,
    messages: catalogues[locale],
    namespace: "email",
  });
}
