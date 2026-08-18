import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ButtonLink } from "@/components/ui/button-link";
import { Link } from "@/i18n/navigation";

/**
 * The public front door's header.
 *
 * **Not a layout.** The signed-in shell has its own bar, the auth pages have
 * their own frame, and F11's scan page is a field inspector's surface rather
 * than a marketing one — putting this in `(public)/layout.tsx` would push a
 * product header onto all three. The public pages compose it instead.
 *
 * The actions change with the session, because "Sign in" shown to somebody
 * already signed in is the front door telling them they are a stranger.
 */
export async function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const t = await getTranslations("landing");
  const tNav = await getTranslations("nav");

  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 p-4">
        <Link href="/" className="flex flex-col">
          {/* The product's own name, in Arabic, in both locales — a name, not a
              word to translate. */}
          <span className="text-lg font-semibold">أجنحة</span>
          <span className="text-muted-foreground text-xs">{t("wordmarkLatin")}</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <LocaleSwitcher />
          {signedIn ? (
            <ButtonLink href="/dashboard">{tNav("dashboard")}</ButtonLink>
          ) : (
            <>
              <ButtonLink variant="outline" href="/sign-in">
                {tNav("signIn")}
              </ButtonLink>
              <ButtonLink href="/sign-up">{t("ctaRegister")}</ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
