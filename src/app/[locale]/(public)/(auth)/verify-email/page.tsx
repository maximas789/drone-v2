import { getTranslations } from "next-intl/server";
import { VerifyEmailState } from "@/components/auth/verify-email-state";
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
        <CardDescription>{t("emailNotConfigured")}</CardDescription>
      </CardHeader>
      <CardContent>
        <VerifyEmailState token={typeof token === "string" ? token : null} />
      </CardContent>
    </Card>
  );
}
