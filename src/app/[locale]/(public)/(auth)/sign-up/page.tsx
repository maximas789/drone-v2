import { getTranslations } from "next-intl/server";
import { SignUpForm } from "@/components/auth/sign-up-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

export default async function SignUpPage() {
  const t = await getTranslations("auth");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("signUpTitle")}</CardTitle>
        <CardDescription>{t("signUpSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SignUpForm />

        <p className="text-muted-foreground text-sm">
          {t("haveAccount")}{" "}
          <Link href="/sign-in" className="underline">
            {t("signInAction")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
