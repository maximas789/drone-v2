import { getTranslations } from "next-intl/server";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { AcceptanceLine } from "@/components/legal/acceptance-line";
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

        {/**
         * Directly under the button, because that is the moment it describes.
         * It sits in the page rather than in `SignUpForm` so it stays a Server
         * Component: `SignUpForm` is `"use client"`, and pulling the links into
         * that bundle would buy nothing.
         */}
        <AcceptanceLine />

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
