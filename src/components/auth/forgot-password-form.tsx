"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authErrorKey } from "@/lib/auth-errors";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setErrorKey(null);

    const { error } = await authClient.requestPasswordReset({
      email: String(form.get("email") ?? ""),
      // Better Auth appends `?token=` on success, `?error=INVALID_TOKEN`
      // otherwise. The locale is baked in because the link is followed later,
      // possibly from an email client, with no request context to infer from.
      redirectTo: `/${locale}/reset-password`,
    });

    setPending(false);
    if (error) {
      setErrorKey(authErrorKey(error.code));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <p role="status" className="text-sm">
        {t("resetLinkSent")}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
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

      {errorKey ? (
        <p role="alert" className="text-destructive text-sm">
          {t(errorKey)}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {t("sendResetLink")}
      </Button>
    </form>
  );
}
