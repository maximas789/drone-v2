"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { reportDroneAction } from "@/lib/actions/remote-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * "Report this drone" — the one action an anonymous viewer gets.
 *
 * **An inline panel, not a modal**, despite the filename the plan gave it.
 * There is no dialog primitive installed, and a hand-rolled modal without a
 * focus trap and an inert background is worse for a screen reader than no modal
 * at all — on a page whose whole point is that a stranger can use it on a phone
 * at the roadside.
 *
 * Nothing about the owner is on this component, because nothing about the owner
 * is on the anonymous page: filing a report teaches the reporter nothing.
 */
export function ReportDialog({
  code,
  locale,
  openLabel,
}: {
  /** Whatever was scanned, including a code that resolved to nothing. */
  code: string;
  locale: Locale;
  /**
   * The label on the closed control. Added by F24, which files through this
   * same action from `/admin/lookup` — where the honest label is *"report an
   * unregistered drone"*, because the reviewer has just been told nothing
   * resolved. A second component would have meant a second call site for an
   * action whose "the code need not resolve" behaviour is the subtle part.
   */
  openLabel?: string;
}) {
  const t = useTranslations("remoteId");
  const tErrors = useTranslations("errors");
  const tCommon = useTranslations("common");
  const fieldId = useId();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filed, setFiled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    setBusy(true);
    setError(null);

    const result = await reportDroneAction({
      code,
      description: String(form.get("description") ?? ""),
      locationNote: String(form.get("locationNote") ?? ""),
    });

    setBusy(false);

    if (result.ok) {
      setFiled(true);
      setOpen(false);
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
        : reason?.code === "report_description_required"
          ? tErrors("reportDescriptionRequired")
          : tErrors("generic"),
    );
  }

  if (filed) {
    return (
      <p className="border-border bg-muted/40 rounded-lg border p-4 text-sm">
        {t("reportFiled")}
      </p>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        {openLabel ?? t("reportOpen")}
      </Button>
    );
  }

  return (
    <form
      action={submit}
      className="border-border flex flex-col gap-3 rounded-lg border p-4"
    >
      <div>
        <h2 className="font-medium">{t("reportTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("reportIntro")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldId}-description`}>{t("reportDescription")}</Label>
        <textarea
          id={`${fieldId}-description`}
          name="description"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent p-2.5 text-base outline-none focus-visible:ring-3 md:text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${fieldId}-location`}>{t("reportLocation")}</Label>
        <Input
          id={`${fieldId}-location`}
          name="locationNote"
          maxLength={200}
          autoComplete="off"
        />
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? tCommon("loading") : t("reportSubmit")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {tCommon("cancel")}
        </Button>
      </div>
    </form>
  );
}
