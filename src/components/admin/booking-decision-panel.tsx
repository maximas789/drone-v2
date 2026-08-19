"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { DecisionReasons } from "@/components/airspace/decision-reasons";
import { FormProblem } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import {
  approveBookingAction,
  cancelBookingByAuthorityAction,
  rejectBookingAction,
} from "@/lib/actions/booking";
import type { Reason } from "@/lib/actions/result";
import { REASON_CODES, type Reason as AirspaceReason } from "@/lib/airspace/types";
import { formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * Approve, refuse, or take the slot away — the booking half of the decision.
 *
 * **Approval can be refused by the app itself, and that is the feature.**
 * `approveBooking` re-runs `evaluateAirspace` inside the approving transaction
 * and answers `no_longer_authorised` when the airspace has moved since the
 * pilot asked — a closure published yesterday, a registration that lapsed last
 * week. The refusal comes back as the engine's **own reason codes**, so this
 * panel renders them through `DecisionReasons`, the same component the map and
 * the booking wizard use. A reviewer is told what changed, not that "something
 * went wrong".
 *
 * That is also why there is no "approve anyway". The screen has just shown the
 * re-run above; if it says denied, approval is not a decision the reviewer is
 * being asked to override, it is one the app will not make.
 *
 * **The reason floor is 20 characters and it is the workflow's number**, as in
 * `DecisionPanel`: `transitions.ts` carries `reasonMinLength: 20`,
 * `applyTransition` checks it against the locked row, and the check here is
 * *before* the round trip rather than instead of it.
 *
 * **Cancel-by-authority is a different act from rejection and is drawn as
 * one.** Rejection answers a request; cancellation takes back a flight the app
 * already approved, and the pilot may already have driven to the site. It is
 * offered only on an `approved` booking, and never beside "Approve".
 */

/** The refusals this panel can receive and has a sentence for. */
const KNOWN_CODES = new Set([
  "not_found",
  "not_authenticated",
  "reason_required",
  "invalid_transition",
  "already_applied",
  "cancel_too_late",
  "no_longer_authorised",
]);

const AIRSPACE_CODES = new Set<string>(REASON_CODES);

/**
 * A refusal the engine raised, rather than one the action did. Same predicate
 * as F21a's wizard: only the engine's codes have an `airspace.reasons.*` entry,
 * and a form code rendered through that catalogue would print its own path.
 */
function isAirspaceReason(reason: Reason): reason is AirspaceReason {
  return AIRSPACE_CODES.has(reason.code);
}

/**
 * The four refusals a booking reviewer reaches for most.
 *
 * Codes, not sentences — the label and the pre-filled text both come from the
 * catalogue. Editable, and never submitted unedited by design: the pilot reads
 * what the reviewer actually wrote.
 */
const TEMPLATES = [
  "zone_closed",
  "registration_expiring",
  "slot_congested",
  "purpose_unclear",
] as const;

const REASON_MIN_LENGTH = 20;

type Mode = "idle" | "rejecting" | "cancelling";

export function BookingDecisionPanel({
  bookingId,
  status,
  locale,
}: {
  bookingId: string;
  /** `pending` offers the decision; `approved` offers the cancellation. */
  status: string;
  locale: Locale;
}) {
  const t = useTranslations("review");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const fieldId = useId();

  const [mode, setMode] = useState<Mode>("idle");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [airspace, setAirspace] = useState<AirspaceReason[]>([]);
  const [pending, startTransition] = useTransition();

  const written = reason.trim();
  const tooShort = written.length < REASON_MIN_LENGTH;

  function refusalText(reasons: readonly Reason[]): string | null {
    const limited = reasons.find((r) => r.code === "rate_limited");
    if (limited) {
      // Through `formatSeconds` before ICU sees it — thread 22.
      return tErrors("rateLimited", {
        duration: formatSeconds(
          Number(limited.params?.retryAfterSeconds ?? 0),
          locale,
        ),
      });
    }
    const known = reasons.find((r) => KNOWN_CODES.has(r.code));
    if (known) return t(`errors.${known.code}`);
    /*
      An airspace refusal needs no sentence of its own: `DecisionReasons` says
      what was refused *and* what would fix it, right below. A generic "that
      could not be done" above it would be noise contradicting a specific
      answer.
    */
    return reasons.some(isAirspaceReason) ? null : tErrors("generic");
  }

  function run(work: () => Promise<{ ok: boolean; reasons?: Reason[] }>) {
    startTransition(async () => {
      setMessage(null);
      setAirspace([]);
      const result = await work();
      if (!result.ok) {
        const reasons = result.reasons ?? [];
        setMessage(refusalText(reasons));
        setAirspace(reasons.filter(isAirspaceReason));
        /*
          **Refresh even on a refusal.** `already_applied` and
          `invalid_transition` both mean somebody decided this while the page
          was open; `no_longer_authorised` means the airspace moved. In every
          case the useful thing is to re-read the screen — the re-run at the
          top is what changed.
        */
        router.refresh();
        return;
      }
      setMode("idle");
      setReason("");
      router.refresh();
    });
  }

  const refusal = (
    <>
      <FormProblem>
        {message ??
          (mode !== "idle" && tooShort && written.length > 0
            ? t("reasonTooShort")
            : null)}
      </FormProblem>
      {airspace.length > 0 ? (
        <DecisionReasons reasons={airspace} locale={locale} />
      ) : null}
    </>
  );

  if (mode === "rejecting" || mode === "cancelling") {
    const cancelling = mode === "cancelling";
    return (
      <div className="border-destructive flex flex-col gap-4 rounded-lg border p-4">
        <div>
          <h2 className="font-medium">
            {cancelling ? t("cancelByAuthority") : t("rejectBooking")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {cancelling ? t("cancelByAuthorityIntro") : t("rejectIntro")}
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
                onClick={() => setReason(t(`bookingTemplates.${template}`))}
              >
                {t(`bookingTemplateLabels.${template}`)}
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
              `aria-required`, never the native `required` — the native one
              cancels the submit and speaks the *browser's* language, so the
              app's own bilingual refusal never runs. Standing rule since F17.
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

        {refusal}

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="destructive"
            disabled={pending || tooShort}
            onClick={() =>
              run(() =>
                cancelling
                  ? cancelBookingByAuthorityAction(bookingId, written)
                  : rejectBookingAction(bookingId, written),
              )
            }
          >
            {pending
              ? t("deciding")
              : cancelling
                ? t("cancelByAuthorityConfirm")
                : t("rejectConfirm")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setMode("idle");
              setMessage(null);
              setAirspace([]);
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
        <h2 className="font-medium">{t("bookingDecisionTitle")}</h2>
        <p className="text-muted-foreground text-sm">
          {status === "approved"
            ? t("cancelByAuthorityIntro")
            : t("bookingDecisionIntro")}
        </p>
      </div>

      {refusal}

      <div className="flex flex-wrap gap-3">
        {status === "pending" ? (
          <>
            <Button
              type="button"
              disabled={pending}
              onClick={() => run(() => approveBookingAction(bookingId))}
            >
              {pending ? t("deciding") : t("approveBooking")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setMessage(null);
                setAirspace([]);
                setMode("rejecting");
              }}
            >
              {t("rejectBooking")}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setMessage(null);
              setAirspace([]);
              setMode("cancelling");
            }}
          >
            {t("cancelByAuthority")}
          </Button>
        )}
      </div>
    </div>
  );
}
