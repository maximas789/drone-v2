import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ButtonLink } from "@/components/ui/button-link";
import { Link } from "@/i18n/navigation";
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
export default async function AppLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = toLocale(await localeParam());
  const session = await requireUser(locale);
  const tSettings = await getTranslations("settings");

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b p-3">
        <Link href="/dashboard" className="text-sm font-semibold">
          {/* The product's own name, in Arabic, in both locales — it is a name,
              not a word to translate. */}
          أجنحة
        </Link>
        <nav className="flex items-center gap-2">
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
