"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authErrorKey } from "@/lib/auth-errors";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation/password";

/**
 * Change password.
 *
 * **Better Auth's own endpoint, not a server action of ours.** It is the thing
 * that already knows how to verify the current password against the stored
 * hash, and re-implementing that in an action would mean a second password
 * comparison in this codebase — the one place a second implementation is
 * unambiguously worse than none. Its rate limit is declared in `src/lib/auth.ts`
 * (`/change-password`, 5 per minute) rather than in `src/lib/rate-limit`, which
 * is why this form does not call `enforceLimit`: the limiter is on the endpoint
 * being called, not on a wrapper around it.
 *
 * **`revokeOtherSessions: true`, always, and not a checkbox.** A password
 * change is what somebody does when they think a password is compromised, and
 * offering to *leave the other sessions signed in* would offer to leave the
 * intruder signed in. The form says plainly that it happens instead of asking.
 *
 * Errors go through `authErrorKey`, so `INVALID_PASSWORD` and a 429 both read
 * as sentences in the right language — and a wrong current password reads as
 * exactly that rather than as "something went wrong".
 */
export function PasswordForm() {
  const t = useTranslations("settings");
  const tAuth = useTranslations("auth");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit(form: FormData) {
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirm = String(form.get("confirmPassword") ?? "");

    setError(null);
    setDone(false);

    // Checked here because the two fields never leave the browser together in
    // any request — the endpoint takes one new password and has no second one
    // to compare it against.
    if (newPassword !== confirm) {
      setError(tAuth("errorPasswordMismatch"));
      return;
    }

    startTransition(async () => {
      const { error: failure } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (failure) {
        setError(tAuth(authErrorKey(failure.code, failure.status)));
        return;
      }
      setDone(true);
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="currentPassword">{t("security.currentPassword")}</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          dir="ltr"
          className="text-start"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="newPassword">{t("security.newPassword")}</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          dir="ltr"
          className="text-start"
          aria-describedby="new-password-hint"
        />
        <p id="new-password-hint" className="text-muted-foreground text-sm">
          {tAuth("passwordHint")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">{t("security.confirmPassword")}</Label>
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

      <p className="text-muted-foreground text-sm">
        {t("security.revokesOthers")}
      </p>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="text-sm font-medium">
          {t("security.passwordChanged")}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("security.changing") : t("security.changePassword")}
      </Button>
    </form>
  );
}
