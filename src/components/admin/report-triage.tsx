"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { FormProblem } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { triageReportAction } from "@/lib/actions/review";
import { formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * Close a filed report — **thread 35, closed with it.**
 *
 * Since F11 anybody could scan a Remote ID and report the aircraft. The row was
 * written, audited and listed, and then it sat there for ever: no handled
 * state, no assignment, no way to say "dealt with". The columns were left out
 * deliberately until the controls existed, because a state nothing writes is a
 * lie about what the app does.
 *
 * **The note reaches nobody.** Every other reason field in this app is quoted
 * to somebody — a pilot reads their rejection verbatim. A report is usually
 * filed by a member of the public who left no address, so this text is for the
 * next reviewer and for the regulator reading the trail, and the hint says so
 * rather than letting a reviewer write to a correspondent who does not exist.
 *
 * It is therefore **optional**, unlike every other reason: requiring a note
 * nobody will read is how a queue fills with the word "handled".
 */

const KNOWN_CODES = new Set([
  "not_found",
  "not_authenticated",
  "already_applied",
  "invalid_transition",
]);

export function ReportTriage({
  reportId,
  locale,
}: {
  reportId: string;
  locale: Locale;
}) {
  const t = useTranslations("review");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const fieldId = useId();

  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(status: "actioned" | "dismissed") {
    startTransition(async () => {
      setMessage(null);
      const result = await triageReportAction(reportId, status, note.trim());
      if (!result.ok) {
        const reasons = result.reasons ?? [];
        const limited = reasons.find((r) => r.code === "rate_limited");
        setMessage(
          limited
            ? tErrors("rateLimited", {
                duration: formatSeconds(
                  Number(limited.params?.retryAfterSeconds ?? 0),
                  locale,
                ),
              })
            : (() => {
                const known = reasons.find((r) => KNOWN_CODES.has(r.code));
                return known ? t(`errors.${known.code}`) : tErrors("generic");
              })(),
        );
        // Somebody else may have closed it while this was open — show what
        // actually happened rather than leaving a stale form with an error.
        router.refresh();
        return;
      }
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldId}-note`}>{t("reportNote")}</Label>
        <textarea
          id={`${fieldId}-note`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          maxLength={2000}
          aria-describedby={`${fieldId}-hint`}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent p-2.5 text-base outline-none focus-visible:ring-3 md:text-sm"
        />
        <p id={`${fieldId}-hint`} className="text-muted-foreground text-xs">
          {t("reportNoteHint")}
        </p>
      </div>

      <FormProblem>{message}</FormProblem>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => run("actioned")}
        >
          {pending ? t("deciding") : t("reportActioned")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run("dismissed")}
        >
          {t("reportDismissed")}
        </Button>
      </div>
    </div>
  );
}
