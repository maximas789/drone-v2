import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LocaleSwitcher } from "@/components/locale-switcher";
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

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("dashboard.welcome", { name: session.user.name })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <SignOutButton />
        </div>
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
          {isReviewer(session) ? (
            <ButtonLink variant="outline" href="/admin">
              {t("nav.admin")}
            </ButtonLink>
          ) : null}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-sm">
        {t("dashboard.placeholder")}
      </p>
    </main>
  );
}
