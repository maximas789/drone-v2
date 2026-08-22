"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { deleteAccountAction } from "@/lib/actions/settings";
import { formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * The confirmation, and the only control in the app that ends an account.
 *
 * **Typing the address, not a checkbox and not an "are you sure".** The point
 * is to make the act deliberate and specific: somebody who has to reproduce
 * their own email has necessarily read which account they are closing, which is
 * the failure a modal cannot prevent — closing the wrong one.
 *
 * The button stays disabled until the text matches, and **the server compares
 * again anyway.** A disabled button is a courtesy.
 *
 * On success the account is gone and so is the session, so this navigates to
 * the public landing page rather than refreshing into a guard's redirect —
 * which would work, and would flash a sign-in page at somebody who has just
 * left.
 */
export function DeleteAccount({
  email,
  locale,
}: {
  email: string;
  locale: Locale;
}) {
  const t = useTranslations("settings");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase();

  return (
    <div className="border-destructive/50 flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-email">
          {t("account.confirmLabel", { email })}
        </Label>
        <Input
          id="confirm-email"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          dir="ltr"
          className="text-start"
          aria-describedby="confirm-hint"
        />
        <p id="confirm-hint" className="text-muted-foreground text-sm">
          {t("account.confirmHint")}
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        variant="destructive"
        className="self-start"
        disabled={!matches || pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await deleteAccountAction(typed);
            if (result.ok) {
              router.replace("/");
              return;
            }
            const first = result.reasons[0];
            setError(
              first?.code === "rate_limited"
                ? tErrors("rateLimited", {
                    duration: formatSeconds(
                      Number(first.params?.retryAfterSeconds ?? 60),
                      locale,
                    ),
                  })
                : first?.code === "confirmation_mismatch"
                  ? t("account.errorMismatch")
                  : first?.code === "last_admin"
                    ? t("account.errorLastAdmin")
                    : first?.code === "approved_bookings"
                      ? t("account.errorApprovedBookings")
                      : tErrors("generic"),
            );
          })
        }
      >
        {pending ? t("account.deleting") : t("account.deleteAction")}
      </Button>
    </div>
  );
}
