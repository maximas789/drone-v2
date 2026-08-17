import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth-guards";
import { getMyProfile } from "@/lib/data/pilot";
import { toLocale } from "@/lib/locale";
import { isReviewer, roleOf } from "@/lib/session";

/**
 * Wave 3 placeholder. F21 replaces this with the real pilot dashboard.
 *
 * It exists now because it is what a signed-in account lands on, and because
 * the redirect from `/dashboard` to sign-in is one of F05's acceptance
 * criteria — that needs somewhere to redirect *from*.
 */
export default async function DashboardPage() {
  const locale = toLocale(await localeParam());
  // The guard runs in the layout too. Repeated here because this page reads the
  // session, and a page that needs a session should say so rather than trust
  // that something above it happened to check.
  const session = await requireUser(locale);
  const t = await getTranslations();
  const role = roleOf(session);
  const profile = await getMyProfile(session);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      {/**
       * No locale switcher and no sign-out button here: **F15 moved both into
       * `(app)/layout.tsx`**, beside the notification bell, because they belong
       * to the shell rather than to one page. Leaving them here as well
       * rendered each control twice — found by opening the page, not by any
       * check this repo runs (open thread 11).
       */}
      <header>
        <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("dashboard.welcome", { name: session.user.name })}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{session.user.email}</CardTitle>
          <CardDescription>
            {t("dashboard.signedInAs", { role: t(`roles.${role}`) })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">{t(`roles.${role}`)}</Badge>
          {/**
           * F17 gave the profile a page, so there is finally somewhere to send
           * a pilot. Incomplete goes to the wizard with a `?next=` back to the
           * details page; complete goes straight to the details.
           */}
          <ButtonLink
            variant="outline"
            href={
              profile?.completedAt
                ? "/settings/profile"
                : "/profile/complete?next=/settings/profile"
            }
          >
            {profile?.completedAt
              ? t("nav.profile")
              : t("profile.completeItNow")}
          </ButtonLink>
          {isReviewer(session) ? (
            <ButtonLink variant="outline" href="/admin">
              {t("nav.admin")}
            </ButtonLink>
          ) : null}
        </CardContent>
      </Card>

      {profile?.completedAt ? null : (
        <p className="border-s-2 ps-3 text-sm">{t("profile.incompleteBanner")}</p>
      )}

      <p className="text-muted-foreground text-sm">
        {t("dashboard.placeholder")}
      </p>
    </main>
  );
}
