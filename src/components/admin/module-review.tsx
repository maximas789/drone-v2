"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { DateSelect } from "@/components/form/date-select";
import { FormProblem } from "@/components/form/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import {
  rejectDeclarationAction,
  verifyDeclarationAction,
} from "@/lib/actions/review";
import type { Reason } from "@/lib/actions/result";
import { inclusiveEndOf } from "@/lib/admin/validity";
import { formatDate, formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * The declared Remote ID modules, and the reviewer's decision on each.
 *
 * **This is what closes thread 49.** `validFrom`, `validUntil`, `verifiedAt`
 * and `rejectedAt` had been written by nobody since F19b — the pilot's
 * declaration form deliberately does not collect a validity window, because a
 * pilot typing a certificate's dates before anyone has read the certificate
 * puts an unchecked claim on the ID card beside the verified ones. The reviewer
 * holding the document is who fills them in, and this is the control.
 *
 * **Both dates are optional and blank means unbounded**, which is exactly how
 * `broadcastCapableAt` reads a null. A module whose certificate carries no
 * expiry is verified without one rather than given an invented date that would
 * ground the aircraft on an arbitrary day.
 *
 * **The document is a link, not an inline viewer.** `docPath` is a PDF served
 * through `/api/files/…`, which re-checks access on every request; embedding it
 * in an `<iframe>` would put a second renderer's chrome — in the browser's
 * language, with its own print button — inside an Arabic page, and would make
 * the one control that matters here compete with it for the screen.
 *
 * A **superseded** row shows its history and no controls: the pilot has already
 * replaced it, and the action refuses it independently.
 */

const KNOWN_CODES = new Set([
  "not_found",
  "not_authenticated",
  "reason_required",
  "invalid_transition",
  "already_applied",
  "invalid_validity",
]);

const REASON_MIN_LENGTH = 20;
/** A certificate's validity is not open-ended in practice; ten years is ample. */
const VALIDITY_YEARS_AHEAD = 10;

export type ReviewableDeclaration = {
  id: string;
  kind: string;
  manufacturer: string | null;
  moduleSerial: string | null;
  docReference: string | null;
  docUrl: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
  verifiedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  supersededAt: Date | null;
  createdAt: Date;
};

export function ModuleReview({
  declarations,
  locale,
}: {
  declarations: readonly ReviewableDeclaration[];
  locale: Locale;
}) {
  const t = useTranslations("review");

  if (declarations.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("noModules")}</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {declarations.map((declaration) => (
        <li key={declaration.id}>
          <ModuleCard declaration={declaration} locale={locale} />
        </li>
      ))}
    </ul>
  );
}

function ModuleCard({
  declaration,
  locale,
}: {
  declaration: ReviewableDeclaration;
  locale: Locale;
}) {
  const t = useTranslations("review");
  const tCard = useTranslations("remoteId.card");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const fieldId = useId();

  const [mode, setMode] = useState<"idle" | "verifying" | "rejecting">("idle");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const thisYear = new Date().getUTCFullYear();
  const years = Array.from(
    { length: VALIDITY_YEARS_AHEAD + 11 },
    // Ten years back and ten forward: a certificate can have started before
    // today, and a reviewer recording one that did must be able to say so.
    (_, index) => thisYear - 10 + index,
  );

  const written = reason.trim();
  const tooShort = written.length < REASON_MIN_LENGTH;
  const decided =
    declaration.verifiedAt !== null || declaration.rejectedAt !== null;
  const superseded = declaration.supersededAt !== null;

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
        // Refresh anyway: `already_applied` means somebody else decided this
        // while the page was open, and the useful answer is the current state.
        router.refresh();
        return;
      }
      setMode("idle");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-medium">
            {tCard(`moduleKinds.${declaration.kind}`)}
          </span>
          {declaration.manufacturer ? (
            <span className="text-muted-foreground text-sm">
              {declaration.manufacturer}
            </span>
          ) : null}
          {declaration.moduleSerial ? (
            <span dir="ltr" className="font-mono text-xs">
              {declaration.moduleSerial}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {superseded ? <Badge variant="outline">{t("superseded")}</Badge> : null}
          {declaration.verifiedAt ? (
            <Badge>{t("moduleVerified")}</Badge>
          ) : declaration.rejectedAt ? (
            <Badge variant="destructive">{t("moduleRejected")}</Badge>
          ) : (
            <Badge variant="secondary">{t("moduleUnverified")}</Badge>
          )}
        </div>
      </div>

      {declaration.validFrom || declaration.validUntil ? (
        <p className="text-muted-foreground text-sm">
          {t("moduleValidity", {
            from: declaration.validFrom
              ? formatDate(declaration.validFrom, locale)
              : t("noStatedStart"),
            /*
              `validUntil` is stored as an **exclusive** bound — midnight at
              the start of the following day, which is how `broadcastCapableAt`
              reads it. Rendering it raw printed "until 1 January 2030" to a
              reviewer who had typed 31 December 2029. `inclusiveEndOf` is the
              one place that conversion is written down.
            */
            until: declaration.validUntil
              ? formatDate(inclusiveEndOf(declaration.validUntil), locale)
              : t("noStatedExpiry"),
          })}
        </p>
      ) : null}

      {declaration.rejectionReason ? (
        <p className="text-destructive text-sm whitespace-pre-wrap">
          {declaration.rejectionReason}
        </p>
      ) : null}

      {declaration.docUrl ? (
        <a
          href={declaration.docUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline"
        >
          {t("openDocument")}
        </a>
      ) : declaration.docReference ? (
        <p className="text-muted-foreground text-sm">
          {t("documentReferenceOnly", { reference: declaration.docReference })}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">{t("noDocument")}</p>
      )}

      <FormProblem>{message}</FormProblem>

      {superseded ? (
        <p className="text-muted-foreground text-xs">{t("supersededHint")}</p>
      ) : mode === "verifying" ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">{t("validityIntro")}</p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-from`}>{t("validFrom")}</Label>
            <DateSelect
              id={`${fieldId}-from`}
              value={validFrom}
              years={years}
              labels={{ day: t("dateDay"), month: t("dateMonth"), year: t("dateYear") }}
              locale={locale}
              disabled={pending}
              onChange={setValidFrom}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-until`}>{t("validUntil")}</Label>
            <DateSelect
              id={`${fieldId}-until`}
              value={validUntil}
              years={years}
              labels={{ day: t("dateDay"), month: t("dateMonth"), year: t("dateYear") }}
              locale={locale}
              disabled={pending}
              onChange={setValidUntil}
            />
            <p className="text-muted-foreground text-xs">{t("validityHint")}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  verifyDeclarationAction(declaration.id, {
                    validFrom,
                    validUntil,
                  }),
                )
              }
            >
              {pending ? t("deciding") : t("verifyConfirm")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setMode("idle")}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : mode === "rejecting" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-reason`}>{t("rejectReason")}</Label>
            <textarea
              id={`${fieldId}-reason`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              maxLength={2000}
              aria-required
              aria-invalid={tooShort && written.length > 0 ? true : undefined}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent p-2.5 text-base outline-none focus-visible:ring-3 md:text-sm"
            />
            <p className="text-muted-foreground text-xs">
              {t("rejectReasonHint")}
            </p>
          </div>

          {tooShort && written.length > 0 ? (
            <FormProblem>{t("reasonTooShort")}</FormProblem>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="destructive"
              disabled={pending || tooShort}
              onClick={() =>
                run(() => rejectDeclarationAction(declaration.id, written))
              }
            >
              {pending ? t("deciding") : t("rejectConfirm")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setMode("idle")}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            size="sm"
            disabled={pending || declaration.verifiedAt !== null}
            onClick={() => setMode("verifying")}
          >
            {t("verifyModule")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || declaration.rejectedAt !== null}
            onClick={() => setMode("rejecting")}
          >
            {t("rejectModule")}
          </Button>
          {decided ? (
            <span className="text-muted-foreground self-center text-xs">
              {t("moduleDecidedHint")}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
