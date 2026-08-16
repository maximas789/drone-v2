"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button-link";
import { authClient } from "@/lib/auth-client";

type State = "pending" | "success" | "failed" | "missing";

/**
 * The landing page for a verification link. The token arrives in the URL, so
 * the check has to run on mount rather than behind a button.
 */
export function VerifyEmailState({ token }: { token: string | null }) {
  const t = useTranslations("auth");
  const [state, setState] = useState<State>(token ? "pending" : "missing");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    authClient
      .verifyEmail({ query: { token } })
      .then(({ error }) => {
        if (!cancelled) setState(error ? "failed" : "success");
      })
      .catch(() => {
        if (!cancelled) setState("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const messageKey = {
    pending: "verifyEmailPending",
    success: "verifyEmailSuccess",
    failed: "verifyEmailFailed",
    missing: "verifyEmailMissingToken",
  }[state];

  return (
    <div className="flex flex-col gap-4">
      <p
        role={state === "pending" ? "status" : "alert"}
        className={state === "failed" || state === "missing" ? "text-destructive text-sm" : "text-sm"}
      >
        {t(messageKey)}
      </p>

      {state === "success" ? (
        <ButtonLink href="/dashboard">{t("signInAction")}</ButtonLink>
      ) : null}
      {state === "failed" || state === "missing" ? (
        <ButtonLink variant="outline" href="/sign-in">
          {t("backToSignIn")}
        </ButtonLink>
      ) : null}
    </div>
  );
}
