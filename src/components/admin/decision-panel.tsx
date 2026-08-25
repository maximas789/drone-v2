"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { FormProblem } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { approveDroneAction, rejectDroneAction } from "@/lib/actions/drone";
import type { Reason } from "@/lib/actions/result";
import { formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * Approve, or refuse with a written reason. The whole point of the screen.
 *
 * **The reason floor is 20 characters and it is the workflow's number, not
 * this component's.** `transitions.ts` carries `reasonMinLength: 20` on every
 * edge that needs one, `applyTransition` checks it against the locked row, and
 * `rejectDroneAction` answers `reason_required` when it fails. What this panel
 * adds is the same floor *before* the round trip, so a reviewer is not told
 * after the fact — never *instead* of it. A control that is merely disabled is
 * not a check.
 *
 * **Approval says what it will do before it does it.** Issuing a Remote ID,
 * starting a three-year registration and emailing the pilot are three
 * consequences a reviewer cannot undo from this screen, and a button labelled
 * "Approve" says none of them.
 *
 * **The templates pre-fill an editable field and nothing else.** They are a
 * starting point for a sentence a reviewer then writes; the submitted text is
 * what the pilot receives verbatim, so a template left untouched is a decision
 * nobody actually explained. They therefore fill the field and hand back focus
 * rather than submitting, and the panel does not remember which one was used —
 * there is no "template" column, because what the pilot gets is the text.
 */

/** The refusals this panel can receive and has a sentence for. */
const KNOWN_CODES = new Set([
  "not_found",
  "not_authenticated",
  "reason_required",
  "invalid_transition",
  "already_applied",
]);

/**
 * The four openings a reviewer reaches for most.
 *
 * Codes, not sentences — the label and the pre-filled text both come from the
 * catalogue, so a reviewer working in English writes English into a field an
 * Arabic-reading pilot will see translated by nobody. That is deliberate and it
 * is why the text is editable: the reviewer is writing to a person, and the app
 * must not pretend it can translate a human sentence it never saw.
 */
const TEMPLATES = [
  "photos_unclear",
  "specs_inconsistent",
  "identity_unreadable",
  "weight_mismatch",
] as const;

export const REASON_MIN_LENGTH = 20;

export function DecisionPanel({
  droneId,
  locale,
}: {
  droneId: string;
  locale: Locale;
}) {
  const t = useTranslations("review");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const fieldId = useId();

  const [mode, setMode] = useState<"idle" | "rejecting">("idle");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  /**
   * The approval committed but the QR job could not be queued.
   *
   * Not a refusal — the registration is granted and the Remote ID is minted —
   * so it must not be rendered as one, and it must not be silent either: the
   * sticker does not exist and the pilot has not been emailed.
   */
  const [stickerFailed, setStickerFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const written = reason.trim();
  const tooShort = written.length < REASON_MIN_LENGTH;

  function refusalText(reasons: readonly Reason[]): string {
    const limited = reasons.find((r) => r.code === "rate_limited");
    if (limited) {
      // Through `formatSeconds` before ICU sees it — a bare number renders
      // Arabic-Indic digits under `ar` (thread 22).
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

  /**
   * The union, not a widened object: `rejectDroneAction` carries no
   * `stickerQueued` and must not be made to look as though it might. Same shape
   * `closure-list.tsx` settled on for `fanOutQueued`.
   */
  function run(
    work: () => Promise<
      | { ok: false; reasons?: Reason[] }
      | { ok: true; data: { stickerQueued?: boolean } | Record<string, unknown> }
    >,
  ) {
    startTransition(async () => {
      setMessage(null);
      setStickerFailed(false);
      const result = await work();
      if (result.ok && result.data?.stickerQueued === false) {
        setStickerFailed(true);
      }
      if (!result.ok) {
        setMessage(refusalText(result.reasons ?? []));
        /*
         * **Refresh even on a refusal.** `already_applied` and
         * `invalid_transition` both mean somebody else decided this while the
         * page was open, and the useful thing then is to show what actually
         * happened rather than to leave a stale screen with an error on it.
         */
        router.refresh();
        return;
      }
      router.refresh();
    });
  }

  if (mode === "idle") {
    return (
      <div className="flex flex-col gap-4 rounded-lg border p-4">
        <div>
          <h2 className="font-medium">{t("decisionTitle")}</h2>
          <p className="text-muted-foreground text-sm">{t("decisionIntro")}</p>
        </div>

        {/*
          Stated before the button is pressed, not after. Three consequences
          a reviewer cannot take back from this screen.
        */}
        <ul className="text-muted-foreground flex list-disc flex-col gap-1 ps-5 text-sm">
          <li>{t("approveEffectRemoteId")}</li>
          <li>{t("approveEffectValidity")}</li>
          <li>{t("approveEffectEmail")}</li>
        </ul>

        {stickerFailed ? (
          <p
            role="status"
            className="border-destructive rounded-lg border border-s-4 p-3 text-sm"
          >
            {t("stickerFailed")}
          </p>
        ) : null}

        <FormProblem>{message}</FormProblem>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={pending}
            onClick={() => run(() => approveDroneAction(droneId))}
          >
            {pending ? t("deciding") : t("approve")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setMessage(null);
              setMode("rejecting");
            }}
          >
            {t("reject")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-destructive flex flex-col gap-4 rounded-lg border p-4">
      <div>
        <h2 className="font-medium">{t("rejectTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("rejectIntro")}</p>
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
              onClick={() => setReason(t(`templates.${template}`))}
            >
              {t(`templateLabels.${template}`)}
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
          /*
           * `aria-required`, never the native `required` — the native one
           * cancels the submit and speaks the *browser's* language, so the
           * app's own bilingual refusal never runs. Standing rule since F17.
           */
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
        {message ?? (tooShort && written.length > 0 ? t("reasonTooShort") : null)}
      </FormProblem>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="destructive"
          disabled={pending || tooShort}
          onClick={() => run(() => rejectDroneAction(droneId, written))}
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
