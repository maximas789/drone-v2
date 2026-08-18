"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { FormProblem } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { regenerateQrAction } from "@/lib/actions/remote-id";
import type { Reason } from "@/lib/actions/result";
import { formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * The QR, or an honest account of why it is not here yet.
 *
 * **Never a broken image and never a blank space.** `remote_id.qrPathname` is
 * written by a job that runs after approval, so there is a real window — and a
 * real failure mode — in which an approved aircraft has a code and no picture
 * of it. An `<img>` pointed at nothing renders as a torn-page icon, which reads
 * as "this app is broken" rather than "this has not finished", and gives the
 * pilot nothing to do about it.
 *
 * The bytes come through **`/api/files/…`**, which re-checks ownership on every
 * request, never a storage URL. `next/image` would need that route in
 * `remotePatterns` and would then cache an owner-scoped image at the edge,
 * where the check no longer runs — the same reasoning as the drone photos.
 */
export function QrDisplay({
  droneId,
  code,
  qrUrl,
  locale,
}: {
  droneId: string;
  code: string;
  qrUrl: string | null;
  locale: Locale;
}) {
  const t = useTranslations("remoteId.card");
  const refusalText = useRefusalText(locale);
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (qrUrl) {
    return (
      <div className="flex flex-col items-center gap-2">
        {/**
         * White background and padding, always — **not a themed surface.** A QR
         * needs its quiet zone and its contrast; rendering a dark-mode card
         * behind a transparent PNG is how a code stops scanning. The encoder
         * writes opaque white already, and this guarantees the border around
         * it.
         */}
        <div className="rounded-lg bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt={t("qrAlt", { code })}
            width={224}
            height={224}
            className="size-56 max-w-full"
          />
        </div>
        <p className="text-muted-foreground max-w-xs text-center text-xs">
          {t("qrHint")}
        </p>
      </div>
    );
  }

  return (
    <div
      /**
       * `status`, not `alert`: it is a state the page is in, not an
       * interruption. It is announced when it appears and does not steal focus.
       */
      role="status"
      className="flex w-full flex-col items-center gap-3 rounded-lg border border-dashed p-6"
    >
      <p className="text-center text-sm font-medium">{t("qrPendingTitle")}</p>
      <p className="text-muted-foreground max-w-sm text-center text-xs">
        {t("qrPendingBody")}
      </p>

      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const result = await regenerateQrAction(droneId);
            if (!result.ok) {
              setMessage(refusalText(result.reasons));
              return;
            }
            // The image is a server render off the row this just wrote.
            router.refresh();
          })
        }
      >
        {pending ? t("qrGenerating") : t("qrRetry")}
      </Button>

      <FormProblem>{message}</FormProblem>
    </div>
  );

}

/**
 * Every refusal `regenerateQrAction` can return, translated from its code.
 *
 * An explicit list rather than `t(`errors.${code}`)` on whatever arrives: a
 * code with no key makes next-intl emit the key path itself, and the pilot
 * would be shown `remoteId.card.errors.something` as if it were a sentence.
 * `i18n:check` cannot catch that — it compares the two catalogues to each
 * other, and a key missing from both is missing consistently.
 */
const KNOWN_CODES = new Set([
  "not_authenticated",
  "not_found",
  "not_approved",
  "qr_render_failed",
]);

function useRefusalText(locale: Locale) {
  const t = useTranslations("remoteId.card");
  const tErrors = useTranslations("errors");

  return (reasons: readonly Reason[]): string => {
    const rateLimited = reasons.find((r) => r.code === "rate_limited");
    if (rateLimited) {
      // Through `formatSeconds` before ICU sees it — a bare number reaching a
      // message renders Arabic-Indic digits under `ar` (thread 22).
      return tErrors("rateLimited", {
        duration: formatSeconds(
          Number(rateLimited.params?.retryAfterSeconds ?? 0),
          locale,
        ),
      });
    }

    const known = reasons.find((r) => KNOWN_CODES.has(r.code));
    return known ? t(`errors.${known.code}`) : tErrors("generic");
  };
}
