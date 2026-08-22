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
 *
 * **`localeCookie: false` — added by F27, and it is a privacy fix.**
 * next-intl's middleware writes a `NEXT_LOCALE` cookie on every response by
 * default, and that is orthogonal to `localeDetection`: turning detection off
 * stops the cookie being *read* and leaves it being *written*. Measured against
 * a production serve, `/` redirected to `/ar` identically with the cookie set
 * to `en`, with `Accept-Language: en`, and with neither — so the cookie
 * decided nothing.
 *
 * A cookie nothing reads is the one kind this app must not set. F27 states in
 * the privacy policy that the session cookie is the only cookie and that there
 * is therefore nothing to consent to; a second cookie doing nothing would make
 * that either a false statement or an awkward footnote, and the honest fix is
 * to stop setting it rather than to describe it. The locale lives in the URL,
 * where `localePrefix: "always"` already puts it, and a signed-in user's
 * preference lives in `user.preferredLocale`.
 */
export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "always",
  localeDetection: false,
  localeCookie: false,
});
