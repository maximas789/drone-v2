"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  revealIdentityAction,
  type RevealedIdentity,
} from "@/lib/actions/remote-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * The reveal control, rendered only on the reviewer/admin branch of
 * `redactRemoteId` — and guarded again inside the action, because a control
 * that is merely absent from the page is not a control at all.
 *
 * The reason field is **required and visible before anything is revealed**: the
 * reviewer types why, the audit event is written with it, and only then does
 * the identity come back. A reveal that is not logged did not happen.
 */
export function IdentityReveal({
  code,
  locale,
}: {
  code: string;
  locale: Locale;
}) {
  const t = useTranslations("remoteId");
  const tErrors = useTranslations("errors");
  const tCommon = useTranslations("common");
  const fieldId = useId();

  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<RevealedIdentity | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    setBusy(true);
    setError(null);

    const result = await revealIdentityAction(
      code,
      String(form.get("reason") ?? ""),
    );
    setBusy(false);

    if (result.ok) {
      setRevealed(result.data);
      return;
    }

    const reason = result.reasons[0];
    setError(
      reason?.code === "rate_limited"
        ? tErrors("rateLimited", {
            duration: formatSeconds(
              Number(reason.params?.retryAfterSeconds ?? 60),
              locale,
            ),
          })
        : reason?.code === "reveal_reason_required"
          ? tErrors("revealReasonRequired")
          : reason?.code === "reveal_not_logged"
            ? tErrors("revealNotLogged")
            : tErrors("generic"),
    );
  }

  if (revealed) {
    return (
      <div className="border-border flex flex-col gap-2 rounded-lg border p-4">
        <h2 className="font-medium">{t("revealResult")}</h2>
        <dl className="grid gap-1 text-sm">
          <Row label={t("ownerName")} value={revealed.ownerNameAr} />
          <Row label={t("ownerName")} value={revealed.ownerNameEn} ltr />
          <Row label={t("ownerMobile")} value={revealed.ownerMobile} ltr />
          <Row label={t("idDocument")} value={revealed.ownerIdDocumentNumber} ltr />
        </dl>
        {/* Past tense, deliberately: by the time this renders the audit event
            has already committed — it is what allowed the value to be shown. */}
        <p className="text-muted-foreground text-xs">{t("revealLoggedDone")}</p>
      </div>
    );
  }

  return (
    <form
      action={submit}
      className="border-border flex flex-col gap-3 rounded-lg border p-4"
    >
      <div>
        <h2 className="font-medium">{t("revealTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("revealReasonHint")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldId}-reason`}>{t("revealReason")}</Label>
        <Input
          id={`${fieldId}-reason`}
          name="reason"
          required
          minLength={10}
          maxLength={2000}
          autoComplete="off"
        />
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="destructive" disabled={busy}>
        {busy ? tCommon("loading") : t("revealSubmit")}
      </Button>
    </form>
  );
}

function Row({
  label,
  value,
  ltr = false,
}: {
  label: string;
  value: string | null;
  ltr?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-muted-foreground">{label}</dt>
      {/* A Latin run — a mobile number or an ID — inside an Arabic sentence
          reverses without its own direction. */}
      <dd dir={ltr ? "ltr" : undefined} className="font-medium">
        {value}
      </dd>
    </div>
  );
}
