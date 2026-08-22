"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { regenerateAllQrAction } from "@/lib/actions/ops";
import { formatNumber, formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * The repair the `APP_URL` check offers.
 *
 * **Behind a confirmation, because it rewrites every sticker's image.** It is
 * safe — the pathname is deterministic and overwritten in place, so a sticker
 * already on an airframe keeps resolving — but "safe" and "should happen
 * because somebody's cursor slipped" are different things, and on a page full
 * of read-only panels a button that silently touches every aircraft is the one
 * worth a second click.
 *
 * The result reports **rendered and failed separately**. A single "done" would
 * hide the case the operator most needs to see: it ran, and eleven of them did
 * not write.
 */
export function RegenerateQr({ locale }: { locale: Locale }) {
  const t = useTranslations("ops");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      setError(null);
      setResult(null);
      const outcome = await regenerateAllQrAction();
      setConfirming(false);

      if (!outcome.ok) {
        const first = outcome.reasons[0];
        setError(
          first?.code === "rate_limited"
            ? tErrors("rateLimited", {
                duration: formatSeconds(
                  Number(first.params?.retryAfterSeconds ?? 60),
                  locale,
                ),
              })
            : tErrors("generic"),
        );
        return;
      }

      setResult(
        t("qr.done", {
          rendered: formatNumber(outcome.data.rendered, locale),
          failed: formatNumber(outcome.data.failed, locale),
        }),
      );
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-sm">{t("qr.confirm")}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={run}>
              {pending ? t("qr.running") : t("qr.confirmAction")}
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
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => setConfirming(true)}
        >
          {t("qr.action")}
        </Button>
      )}

      {result ? (
        <p role="status" className="text-sm font-medium">
          {result}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
