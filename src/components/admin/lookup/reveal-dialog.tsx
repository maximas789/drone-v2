"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  revealIdentityAction,
  type RevealedIdentity,
} from "@/lib/actions/remote-id";
import { formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * Reveal the owner behind a Remote ID, from the lookup screen.
 *
 * **It calls F11's action, unchanged.** `revealIdentityAction` already keys on
 * a code, already refuses without a written reason, already writes the audit
 * event *before* it returns anything, and already flips
 * `remote_id_scan.revealedIdentity`. A second reveal path would be a second
 * place that discipline has to be right, and the entire value of it is that it
 * lives in one function. This component is a form around it.
 *
 * **The dialog says the act is logged, before it is performed.** Not as a
 * warning to deter a reviewer — revealing an identity is their job — but
 * because a power exercised in the belief that nobody is watching is a
 * different power from one exercised knowing an administrator will read the
 * reason. The sentence is the accountability, and hiding it would quietly
 * remove it.
 *
 * A minimum of ten characters, checked here *and* at the action. The control
 * being absent or disabled is never the check: an action is an ordinary POST.
 */

const MIN_REASON_LENGTH = 10;

export function RevealDialog({
  code,
  locale,
}: {
  code: string;
  locale: Locale;
}) {
  const t = useTranslations("lookup");
  const tRemote = useTranslations("remoteId");
  const tProfile = useTranslations("profile");
  const tErrors = useTranslations("errors");
  const fieldId = useId();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [revealed, setRevealed] = useState<RevealedIdentity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tooShort = reason.trim().length < MIN_REASON_LENGTH;

  if (revealed) {
    return (
      <div className="border-destructive flex flex-col gap-2 rounded-lg border p-4">
        <h3 className="font-medium">{tRemote("revealResult")}</h3>
        <dl className="grid gap-1 text-sm">
          <Row label={tRemote("ownerName")} value={revealed.ownerNameAr} />
          <Row label={tRemote("ownerName")} value={revealed.ownerNameEn} ltr />
          <Row label={tRemote("ownerMobile")} value={revealed.ownerMobile} ltr />
          <Row
            label={
              revealed.ownerIdDocumentType
                ? tProfile(`idType.${revealed.ownerIdDocumentType}`)
                : tRemote("idDocument")
            }
            value={revealed.ownerIdDocumentNumber}
            ltr
          />
        </dl>
        {/* Past tense: by the time this renders, the audit event has already
            committed — it is what allowed the value to be shown at all. */}
        <p className="text-muted-foreground text-xs">
          {tRemote("revealLoggedDone")}
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="min-h-12 w-full sm:w-fit"
        onClick={() => setOpen(true)}
      >
        {tRemote("revealIdentity")}
      </Button>
    );
  }

  return (
    <div className="border-destructive flex flex-col gap-3 rounded-lg border p-4">
      <div>
        <h3 className="font-medium">{tRemote("revealTitle")}</h3>
        <p className="text-muted-foreground text-sm">{t("revealLoggedNotice")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldId}-reason`}>{tRemote("revealReason")}</Label>
        <Input
          id={`${fieldId}-reason`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={2000}
          autoComplete="off"
          className="min-h-12"
          /* `aria-required`, never native `required` — the native validation
             bubble speaks the browser's language, not the page's, and it
             cancels the submit. Standing rule since F17's date input. */
          aria-required
          aria-describedby={`${fieldId}-hint`}
        />
        <p id={`${fieldId}-hint`} className="text-muted-foreground text-xs">
          {tRemote("revealReasonHint")}
        </p>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="destructive"
          className="min-h-12"
          disabled={pending || tooShort}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await revealIdentityAction(code, reason.trim());
              if (result.ok) {
                setRevealed(result.data);
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
                  : first?.code === "reveal_reason_required"
                    ? tErrors("revealReasonRequired")
                    : first?.code === "reveal_not_logged"
                      ? tErrors("revealNotLogged")
                      : tErrors("generic"),
              );
            })
          }
        >
          {tRemote("revealSubmit")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-12"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          {t("cancel")}
        </Button>
      </div>
    </div>
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
      {/* A Latin run — a mobile number or a document — inside an Arabic
          sentence reverses without its own direction. No formatted date here,
          so `dir` is safe; a date would need `<bdi>` instead. */}
      <dd dir={ltr ? "ltr" : undefined} className="font-medium">
        {value}
      </dd>
    </div>
  );
}
