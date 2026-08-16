"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { authErrorKey } from "@/lib/auth-errors";
import { toLocale } from "@/lib/locale";

/** Minimum enforced by Better Auth's own default; stated to the reader too. */
const MIN_PASSWORD_LENGTH = 8;

export function SignUpForm() {
  const t = useTranslations("auth");
  const locale = toLocale(useLocale());
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorKey("errorPasswordTooShort");
      return;
    }
    if (password !== String(form.get("confirmPassword") ?? "")) {
      setErrorKey("errorPasswordMismatch");
      return;
    }

    setPending(true);
    setErrorKey(null);

    const { error } = await authClient.signUp.email({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password,
      // The language they signed up in is the language we write to them in.
      // `role` is deliberately absent — it is `input: false`, so sending it
      // here would be rejected rather than honoured.
      preferredLocale: locale,
    });

    if (error) {
      setErrorKey(authErrorKey(error.code, error.status));
      setPending(false);
      return;
    }

    router.refresh();
    router.push("/dashboard");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("fullName")}</Label>
        <Input id="name" name="name" autoComplete="name" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          dir="ltr"
          className="text-start"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          dir="ltr"
          className="text-start"
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-muted-foreground text-sm">
          {t("passwordHint")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          dir="ltr"
          className="text-start"
        />
      </div>

      {errorKey ? (
        <p role="alert" className="text-destructive text-sm">
          {t(errorKey)}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? t("creatingAccount") : t("signUpAction")}
      </Button>
    </form>
  );
}
