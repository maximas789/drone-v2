import { getTranslations } from "next-intl/server";
import { SignInForm } from "@/components/auth/sign-in-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { safeNextPath } from "@/lib/auth-errors";
import type { Metadata } from "next";
import { toLocale } from "@/lib/locale";
import { privatePageTitle } from "@/lib/site/metadata";

export default async function SignInPage({
  searchParams,
}: PageProps<"/[locale]/sign-in">) {
  const t = await getTranslations("auth");
  const { next } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("signInTitle")}</CardTitle>
        <CardDescription>{t("signInSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SignInForm next={safeNextPath(typeof next === "string" ? next : null)} />

        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <Link href="/forgot-password" className="underline">
            {t("forgotPassword")}
          </Link>
          <span className="text-muted-foreground">
            {t("noAccount")}{" "}
            <Link href="/sign-up" className="underline">
              {t("signUpAction")}
            </Link>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Its own tab title, from the same string this page renders as its heading.
 * `robots` comes from the route group's layout — see `PRIVATE_ROBOTS`.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-in">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "auth.signInTitle");
}
