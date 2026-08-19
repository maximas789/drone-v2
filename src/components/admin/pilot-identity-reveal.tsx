"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { FormProblem } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  revealPilotIdentityAction,
  type RevealedPilotIdentity,
} from "@/lib/actions/review";
import { formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * Reveal the pilot's identity document, from a **profile** rather than from a
 * Remote ID code.
 *
 * **This is thread 45's other half.** F11's `IdentityReveal` keys on the code a
 * field inspector has just scanned — which is the right shape for that page and
 * useless here, because a `pending` registration has no Remote ID at all: the
 * code is issued at approval. A reviewer deciding whether to approve is exactly
 * the person who may need to check the identity document, and until now they
 * had nothing to call.
 *
 * The discipline is F11's, unchanged, because it is the part that matters: the
 * reason is **required and typed before anything is revealed**, the audit event
 * is written with it, and only then does the identity come back. A reveal that
 * is not logged did not happen — and the action refuses independently, because
 * the absence of this control on a page is not a check.
 *
 * The mask itself is `MaskedId`, rendered by the page. This component never
 * shows a masked value, so there is still exactly one projection of a document
 * number in the codebase (F11's grep criterion).
 */
export function PilotIdentityReveal({
  userId,
  locale,
}: {
  userId: string;
  locale: Locale;
}) {
  const t = useTranslations("review");
  const tProfile = useTranslations("profile");
  const tRemote = useTranslations("remoteId");
  const tErrors = useTranslations("errors");
  const fieldId = useId();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [revealed, setRevealed] = useState<RevealedPilotIdentity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tooShort = reason.trim().length < 10;

  if (revealed) {
    return (
      <div className="border-destructive flex flex-col gap-2 rounded-lg border p-4">
        <h3 className="font-medium">{tRemote("revealResult")}</h3>
        <dl className="grid gap-1 text-sm">
          <Row label={tRemote("ownerName")} value={revealed.fullNameAr} />
          <Row label={tRemote("ownerName")} value={revealed.fullNameEn} ltr />
          <Row label={tRemote("ownerMobile")} value={revealed.mobile} ltr />
          <Row
            label={tProfile(`idType.${revealed.idDocumentType}`)}
            value={revealed.idDocumentNumber}
            ltr
          />
        </dl>
        {/* Past tense, deliberately: by the time this renders the audit event
            has already committed — it is what allowed the value to be shown. */}
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
        size="sm"
        onClick={() => setOpen(true)}
      >
        {t("revealIdentity")}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div>
        <h3 className="font-medium">{tRemote("revealTitle")}</h3>
        <p className="text-muted-foreground text-sm">
          {tRemote("revealReasonHint")}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldId}-reason`}>{tRemote("revealReason")}</Label>
        <Input
          id={`${fieldId}-reason`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={2000}
          autoComplete="off"
          /* `aria-required`, never native `required` — the native one speaks
             the browser's language and cancels the submit. Standing rule. */
          aria-required
        />
      </div>

      <FormProblem>{error}</FormProblem>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="destructive"
          disabled={pending || tooShort}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await revealPilotIdentityAction(
                userId,
                reason.trim(),
              );
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
          {pending ? t("deciding") : tRemote("revealSubmit")}
        </Button>
        <Button
          type="button"
          variant="ghost"
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
      {/* A Latin run — a mobile number or an ID — inside an Arabic sentence
          reverses without its own direction. It carries no formatted date, so
          `dir` is safe here; see the note on `slot-time.tsx`. */}
      <dd dir={ltr ? "ltr" : undefined} className="font-medium">
        {value}
      </dd>
    </div>
  );
}
