import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ButtonLink } from "@/components/ui/button-link";
import { Link } from "@/i18n/navigation";
import { PRIVATE_ROBOTS } from "@/lib/site/metadata";
import { requireUser } from "@/lib/auth-guards";
import { toLocale } from "@/lib/locale";

/**
 * The signed-in boundary.
 *
 * `src/proxy.ts` may have redirected already, but that check reads only whether
 * a cookie exists. **This** is what actually decides — and every server action
 * under here calls a guard of its own, because an action is reachable without
 * this layout ever rendering.
 *
 * The bar exists because F15 needs somewhere to hang the bell: an unread count
 * that only appears on one page is not a notification system. The locale
 * switcher and sign-out moved up here from the dashboard for the same reason —
 * they belong to the shell, not to one page.
 */
/**
 * **Never indexed**, set once for the whole route group rather than once per
 * page: metadata merges field by field, so a page underneath that sets only its
 * own `title` still inherits this. Fifteen pages each repeating a `robots` block is
 * fifteen places for one to go missing, and the one that went missing would be
 * indexed with nothing failing.
 *
 * `robots.txt` disallows these paths as well. Neither control is sufficient
 * alone — a disallowed page is never fetched, so its `noindex` is never read,
 * and a URL a search engine already knows can sit in an index behind a
 * `Disallow` indefinitely.
 *
 * **This is not the security boundary.** The guard below is. This stops the app
 * appearing in a search result; it stops nobody from typing the URL.
 */
export const metadata: Metadata = { robots: PRIVATE_ROBOTS };

export default async function AppLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = toLocale(await localeParam());
  const session = await requireUser(locale);
  const tSettings = await getTranslations("settings");

  return (
    <div className="flex flex-1 flex-col">
      {/**
       * **`flex-wrap`, because at 375 px the nav does not fit and never could.**
       * Measured: the content box is 351 px and the nav alone is 354 px in
       * Arabic (`الإعدادات` 70 + the switcher 123 + `تسجيل الخروج` 101 + gaps),
       * 332 in English. Unwrapped, both locales overflowed — the page scrolled
       * sideways and **the sign-out button sat at `left: -36`, off the screen**.
       * Wrapping drops the nav to its own line rather than hiding a control:
       * a header that is one row taller on a phone is not a defect, and a
       * sign-out nobody can reach is. Open Thread 20, measured at last.
       */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
        <Link href="/dashboard" className="text-sm font-semibold">
          {/* The product's own name, in Arabic, in both locales — it is a name,
              not a word to translate. */}
          أجنحة
        </Link>
        <nav className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <NotificationBell session={session} locale={locale} />
          {/**
           * **F28a adds the way in.** The settings pages existed from F17 with
           * no link to them: `/settings/profile` was reachable only by typing
           * it. A section of the app nothing navigates to is a section nobody
           * has.
           */}
          <ButtonLink href="/settings" size="sm" variant="ghost">
            {tSettings("title")}
          </ButtonLink>
          <LocaleSwitcher />
          <SignOutButton />
        </nav>
      </header>

      {children}
    </div>
  );
}
