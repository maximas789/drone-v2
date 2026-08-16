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
          Said plainly rather than left for the reader to discover: this build
          has no email sender until F06, so the form works and nothing arrives.
        */}
        <p className="text-muted-foreground text-sm">
          {t("emailNotConfigured")}
        </p>

        <ForgotPasswordForm />

        <Link href="/sign-in" className="text-sm underline">
          {t("backToSignIn")}
        </Link>
      </CardContent>
    </Card>
  );
}
