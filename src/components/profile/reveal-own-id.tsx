"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { revealOwnIdentityAction } from "@/lib/actions/settings";
import { formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * Show me my own document number — behind a confirmation, and logged.
 *
 * **Three states, and the middle one is the point.** Idle offers the control;
 * confirming says plainly that the reveal will be recorded; revealed shows the
 * number. Going straight from a button to the number would make it a display
 * toggle, and the audit row would then be recording a UI state change rather
 * than a decision somebody took.
 *
 * The warning is not a dark pattern in reverse — it is true, and it is the same
 * thing a reviewer is told. The person is entitled to their own number; they
 * are also entitled to know that asking for it leaves a trace.
 *
 * **The number lives in component state and nowhere else.** No `revalidate`, no
 * URL, no storage: it is gone on the next navigation, which is the correct
 * lifetime for a value the rest of the app takes care never to render.
 *
 * `dir="ltr"` on the value, as `MaskedId` does — the digits are one
 * left-to-right token and an RTL paragraph would reorder them.
 */
export function RevealOwnId({ locale }: { locale: Locale }) {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [confirming, setConfirming] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (revealed) {
    return (
      <div className="flex flex-col gap-1">
        <span dir="ltr" className="font-mono text-sm">
          {revealed}
        </span>
        <p className="text-muted-foreground text-xs">{t("revealOwnLogged")}</p>
      </div>
    );
  }

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => setConfirming(true)}
        >
          {t("revealOwnAction")}
        </Button>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <p className="text-sm">{t("revealOwnConfirm")}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await revealOwnIdentityAction();
              if (result.ok) {
                setRevealed(result.data.idDocumentNumber);
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
                  : first?.code === "reveal_not_logged"
                    ? tErrors("revealNotLogged")
                    : tErrors("generic"),
              );
              setConfirming(false);
            })
          }
        >
          {pending ? tCommon("loading") : t("revealOwnSubmit")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          {tCommon("cancel")}
        </Button>
      </div>
    </div>
  );
}
