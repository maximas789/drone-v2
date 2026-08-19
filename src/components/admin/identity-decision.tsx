"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { FormProblem } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import {
  rejectIdentityAction,
  verifyIdentityAction,
} from "@/lib/actions/review";
import type { Reason } from "@/lib/actions/result";
import { formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * Verify or refuse a pilot's identity — **the human check the product rests
 * on.**
 *
 * The honesty rules make this the only verification path there is: no SMS, no
 * document scanner, no score, and nothing on any screen may imply otherwise.
 * A person reveals the document through the audited control above, reads it,
 * and presses one of these two buttons.
 *
 * The refusal text reaches the pilot **verbatim** on their own profile screen,
 * where F17 already renders it as a banner inviting them to correct their
 * details — the banner existed before anything could set the column, and this
 * is what finally sets it. Same twenty-character floor as every other refusal,
 * checked here *before* the round trip and again in the action.
 */

const KNOWN_CODES = new Set([
  "not_found",
  "not_authenticated",
  "reason_required",
  "already_applied",
  "own_submission",
]);

/**
 * The four refusals a reviewer meets most, as codes rather than sentences —
 * so a reviewer working in English pre-fills English into a field an
 * Arabic-reading pilot will see. That is exactly why the field is editable:
 * the app must not pretend it can translate a human sentence it never saw.
 */
const TEMPLATES = [
  "document_unreadable",
  "name_mismatch",
  "document_expired",
  "details_mismatch",
] as const;

const REASON_MIN_LENGTH = 20;

export function IdentityDecision({
  userId,
  verified,
  locale,
}: {
  userId: string;
  /** An already-verified identity offers a refusal, never a second verification. */
  verified: boolean;
  locale: Locale;
}) {
  const t = useTranslations("review");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const fieldId = useId();

  const [mode, setMode] = useState<"idle" | "rejecting">("idle");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const written = reason.trim();
  const tooShort = written.length < REASON_MIN_LENGTH;

  function refusalText(reasons: readonly Reason[]): string {
    const limited = reasons.find((r) => r.code === "rate_limited");
    if (limited) {
      return tErrors("rateLimited", {
        duration: formatSeconds(
          Number(limited.params?.retryAfterSeconds ?? 0),
          locale,
        ),
      });
    }
    const known = reasons.find((r) => KNOWN_CODES.has(r.code));
    return known ? t(`errors.${known.code}`) : tErrors("generic");
  }

  function run(work: () => Promise<{ ok: boolean; reasons?: Reason[] }>) {
    startTransition(async () => {
      setMessage(null);
      const result = await work();
      if (!result.ok) {
        setMessage(refusalText(result.reasons ?? []));
        // Refresh on a refusal too: `already_applied` means somebody decided
        // this while the page was open, and the useful thing then is to show
        // what actually happened.
        router.refresh();
        return;
      }
      setMode("idle");
      setReason("");
      router.refresh();
    });
  }

  if (mode === "rejecting") {
    return (
      <div className="border-destructive flex flex-col gap-4 rounded-lg border p-4">
        <div>
          <h2 className="font-medium">{t("rejectIdentity")}</h2>
          <p className="text-muted-foreground text-sm">
            {t("rejectIdentityIntro")}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs">
            {t("templatesLabel")}
          </span>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((template) => (
              <Button
                key={template}
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setReason(t(`identityTemplates.${template}`))}
              >
                {t(`identityTemplateLabels.${template}`)}
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">{t("templatesHint")}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-reason`}>{t("rejectReason")}</Label>
          <textarea
            id={`${fieldId}-reason`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={5}
            maxLength={2000}
            /* `aria-required`, never the native one — standing rule since F17. */
            aria-required
            aria-invalid={tooShort && written.length > 0 ? true : undefined}
            aria-describedby={`${fieldId}-hint`}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent p-2.5 text-base outline-none focus-visible:ring-3 md:text-sm"
          />
          <p id={`${fieldId}-hint`} className="text-muted-foreground text-xs">
            {t("rejectReasonHint")}
          </p>
        </div>

        <FormProblem>
          {message ??
            (tooShort && written.length > 0 ? t("reasonTooShort") : null)}
        </FormProblem>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="destructive"
            disabled={pending || tooShort}
            onClick={() => run(() => rejectIdentityAction(userId, written))}
          >
            {pending ? t("deciding") : t("rejectConfirm")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setMode("idle");
              setMessage(null);
            }}
          >
            {t("cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div>
        <h2 className="font-medium">{t("identityDecisionTitle")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("identityDecisionIntro")}
        </p>
      </div>

      <FormProblem>{message}</FormProblem>

      <div className="flex flex-wrap gap-3">
        {/*
          An identity already verified offers no second verification — the
          action answers `already_applied` and a button whose only outcome is a
          refusal is a button that should not be drawn. Refusing it is still
          offered: a reviewer who vouched for the wrong person must be able to
          take it back.
        */}
        {verified ? (
          <p className="text-muted-foreground text-sm">
            {t("identityAlreadyVerified")}
          </p>
        ) : (
          <Button
            type="button"
            disabled={pending}
            onClick={() => run(() => verifyIdentityAction(userId))}
          >
            {pending ? t("deciding") : t("verifyIdentity")}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setMessage(null);
            setMode("rejecting");
          }}
        >
          {t("rejectIdentity")}
        </Button>
      </div>
    </div>
  );
}
