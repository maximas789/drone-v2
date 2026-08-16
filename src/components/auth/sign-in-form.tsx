"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { authErrorKey } from "@/lib/auth-errors";

/**
 * Sign-in goes through Better Auth's own endpoint rather than a server action:
 * it is the one flow where the framework must set the session cookie itself,
 * and wrapping it in an action would only add a hop that can get the cookie
 * handling subtly wrong.
 */
export function SignInForm({ next }: { next: string | null }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setErrorKey(null);

    const { error } = await authClient.signIn.email({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });

    if (error) {
      setErrorKey(authErrorKey(error.code, error.status));
      setPending(false);
      return;
    }

    // `refresh()` before `push()`: the layout guards read the session on the
    // server, and without it the cached signed-out render is what they'd see.
    router.refresh();
    router.push(next ?? "/dashboard");
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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
        {pending ? t("signingIn") : t("signInAction")}
      </Button>
    </form>
  );
}
