import { getTranslations } from "next-intl/server";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Metadata } from "next";
import { toLocale } from "@/lib/locale";
import { privatePageTitle } from "@/lib/site/metadata";

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/[locale]/reset-password">) {
  const t = await getTranslations("auth");
  // Better Auth's `/reset-password/:token` callback redirects here with either
  // `?token=` or `?error=INVALID_TOKEN`.
  const { token } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("resetPassword")}</CardTitle>
        <CardDescription>{t("resetPasswordBody")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm token={typeof token === "string" ? token : null} />
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
}: PageProps<"/[locale]/reset-password">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "auth.resetPassword");
}
