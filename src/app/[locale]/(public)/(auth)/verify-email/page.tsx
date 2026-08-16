import { getTranslations } from "next-intl/server";
import { VerifyEmailState } from "@/components/auth/verify-email-state";
import { emailConfigured } from "@/lib/email/config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function VerifyEmailPage({
  searchParams,
}: PageProps<"/[locale]/verify-email">) {
  const t = await getTranslations("auth");
  const { token } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("verifyEmailTitle")}</CardTitle>
        {/* F06 wired a real sender, so the flat "nothing will be sent" is no
            longer true — but it still is when there's no API key. The notice
            follows the env rather than the wave. */}
        <CardDescription>
          {emailConfigured
            ? t("verifyEmailCheckInbox")
            : t("emailNotConfigured")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <VerifyEmailState token={typeof token === "string" ? token : null} />
      </CardContent>
    </Card>
  );
}
