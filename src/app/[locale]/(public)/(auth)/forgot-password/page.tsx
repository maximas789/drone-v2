import { getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { emailConfigured } from "@/lib/email/config";
import type { Metadata } from "next";
import { toLocale } from "@/lib/locale";
import { privatePageTitle } from "@/lib/site/metadata";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("forgotPasswordTitle")}</CardTitle>
        <CardDescription>{t("forgotPasswordBody")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/*
          Said plainly rather than left for the reader to discover. F06 wired a
          real sender, so this now appears only when there is no API key — in
          which case the reset link is printed to the server terminal and the
          form still works end to end.
        */}
        {emailConfigured ? null : (
          <p className="text-muted-foreground text-sm">
            {t("emailNotConfigured")}
          </p>
        )}

        <ForgotPasswordForm />

        <Link href="/sign-in" className="text-sm underline">
          {t("backToSignIn")}
        </Link>
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
}: PageProps<"/[locale]/forgot-password">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "auth.forgotPasswordTitle");
}
