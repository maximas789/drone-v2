"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/button-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authErrorKey } from "@/lib/auth-errors";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation/password";


export function ResetPasswordForm({ token }: { token: string | null }) {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-destructive text-sm">
          {t("resetTokenMissing")}
        </p>
        <ButtonLink variant="outline" href="/forgot-password">
          {t("forgotPasswordTitle")}
        </ButtonLink>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-sm">
          {t("resetSuccess")}
        </p>
        <ButtonLink href="/sign-in">{t("backToSignIn")}</ButtonLink>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Re-checked rather than relying on the early return above: `onSubmit` is a
    // hoisted function declaration, so the narrowing from that guard doesn't
    // reach in here.
    if (!token) return;

    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorKey("errorPasswordTooShort");
      return;
    }
    if (newPassword !== String(form.get("confirmPassword") ?? "")) {
      setErrorKey("errorPasswordMismatch");
      return;
    }

    setPending(true);
    setErrorKey(null);

    const { error } = await authClient.resetPassword({
      newPassword,
      token,
    });

    setPending(false);
    if (error) {
      setErrorKey(authErrorKey(error.code, error.status));
      return;
    }
    setDone(true);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="newPassword">{t("newPassword")}</Label>
        <Input
          id="newPassword"
          name="newPassword"
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
        {t("resetPasswordAction")}
      </Button>
    </form>
  );
}
