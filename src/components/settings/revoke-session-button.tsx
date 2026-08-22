"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { revokeSessionAction } from "@/lib/actions/settings";

/**
 * Sign one other device out.
 *
 * **Two clicks, because it cannot be undone.** The first turns the button into
 * a confirmation; the second acts. There is no dialog: a single row's
 * destructive action does not need a modal, and a modal here would be a
 * heavier interruption than the act deserves.
 *
 * On success the row disappears because the action revalidates the page —
 * nothing is removed from local state, so what the reader sees is what the
 * server has, not an optimistic guess that could disagree with it.
 */
export function RevokeSessionButton({ token }: { token: string }) {
  const t = useTranslations("settings");
  const tErrors = useTranslations("errors");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setConfirming(true)}
        >
          {t("security.revoke")}
        </Button>
        {error ? (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await revokeSessionAction(token);
            if (!result.ok) {
              setError(tErrors("generic"));
              setConfirming(false);
            }
          })
        }
      >
        {t("security.revokeConfirm")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => setConfirming(false)}
      >
        {t("security.revokeCancel")}
      </Button>
    </div>
  );
}
