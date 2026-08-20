"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { ImpactTable, type ImpactRow } from "@/components/admin/zone/impact-table";
import { DateSelect } from "@/components/form/date-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import {
  createZoneClosureAction,
  previewClosureImpactAction,
} from "@/lib/actions/admin";
import type { Reason } from "@/lib/actions/result";
import { formatDateTime, formatNumber, formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import {
  MAX_REASON_LENGTH,
  MIN_REASON_LENGTH,
  emptyClosureDraft,
  validateClosure,
  type ClosureDraft,
} from "@/lib/validation/zone-closure";

/**
 * Declaring a closure — **the NOTAM analogue.**
 *
 * A closure is written in two acts, and this component is the first: it drafts
 * a row that refuses nothing. The engine reads only published closures, so an
 * unpublished one is a plan an admin can look at, check against the flights it
 * covers, and think better of. `ClosureList` performs the second act.
 *
 * **The window is a Riyadh civil date and a typed `HH:mm`** — three selects and
 * a text field, never `<input type="date">` or `<input type="time">`. Thread 46:
 * Chrome renders both native controls from the *browser's* locale and ignores
 * `lang` on the element and on `<html>`, so under an Arabic Chrome they print
 * Arabic-Indic digits and an AM/PM marker. That is rule 6 broken through a
 * surface `format.ts` cannot reach, on a field that becomes part of a
 * regulator-facing record.
 *
 * **The check button asks the server, not this file.** The same
 * `validateClosure` runs here for live feedback, but *which flights* a window
 * covers is a database question, and the answer shown must be the one the
 * fan-out will act on rather than a client-side guess about it.
 */
export function ClosureForm({
  zoneId,
  locale,
}: {
  zoneId: string;
  locale: Locale;
}) {
  const t = useTranslations("zoneAdmin");
  const tErrors = useTranslations("errors");
  const tReview = useTranslations("review");
  const router = useRouter();
  const fieldId = useId();

  const [draft, setDraft] = useState<ClosureDraft>(emptyClosureDraft);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [preview, setPreview] = useState<{
    startsAt: string;
    endsAt: string;
    bookings: ImpactRow[];
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const checked = validateClosure(draft);
  const problems = checked.ok ? [] : checked.problems;
  /** Thread 22: a number reaching an ICU message arrives already formatted. */
  const minLabel = formatNumber(MIN_REASON_LENGTH, locale);

  function set<K extends keyof ClosureDraft>(key: K, value: ClosureDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    // The preview belongs to the window that produced it. Leaving it on screen
    // after an edit would show yesterday's answer beside today's dates.
    setPreview(null);
  }

  function check() {
    startTransition(async () => {
      setReasons([]);
      const result = await previewClosureImpactAction(zoneId, draft);
      if (!result.ok) {
        setReasons(result.reasons);
        return;
      }
      setPreview(result.data);
    });
  }

  function create() {
    startTransition(async () => {
      setReasons([]);
      const result = await createZoneClosureAction(zoneId, draft);
      if (!result.ok) {
        setReasons(result.reasons);
        return;
      }
      setDraft(emptyClosureDraft());
      setPreview(null);
      router.refresh();
    });
  }

  /** The years a closure can fall in: this one and the next. It is temporary. */
  const thisYear = new Date().getUTCFullYear();
  const years = [thisYear, thisYear + 1];
  /**
   * The three part labels come from `review`, where F22 wrote them for the
   * module validity window. Three one-word labels copied into `zoneAdmin` would
   * be two catalogues to keep in step for no gain — the words are the same
   * words.
   */
  const dateLabels = {
    day: tReview("dateDay"),
    month: tReview("dateMonth"),
    year: tReview("dateYear"),
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{t("closureNewHeading")}</h2>
        <p className="text-muted-foreground text-sm">{t("closureNewIntro")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-sm font-medium">
            {t("closureStarts")}
          </legend>
          <DateSelect
            value={draft.startYmd}
            years={years}
            labels={dateLabels}
            locale={locale}
            onChange={(value) => set("startYmd", value)}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-start-time`}>{t("closureTime")}</Label>
            <Input
              id={`${fieldId}-start-time`}
              dir="ltr"
              inputMode="numeric"
              placeholder="18:00"
              className="w-28"
              value={draft.startHhMm}
              onChange={(event) => set("startHhMm", event.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-sm font-medium">
            {t("closureEnds")}
          </legend>
          <DateSelect
            value={draft.endYmd}
            years={years}
            labels={dateLabels}
            locale={locale}
            onChange={(value) => set("endYmd", value)}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-end-time`}>{t("closureTime")}</Label>
            <Input
              id={`${fieldId}-end-time`}
              dir="ltr"
              inputMode="numeric"
              placeholder="06:00"
              className="w-28"
              value={draft.endHhMm}
              onChange={(event) => set("endHhMm", event.target.value)}
            />
          </div>
        </fieldset>
      </div>

      <p className="text-muted-foreground text-sm">{t("closureTimeHint")}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-reason-ar`}>{t("closureReasonAr")}</Label>
          <textarea
            id={`${fieldId}-reason-ar`}
            dir="rtl"
            lang="ar"
            rows={3}
            maxLength={MAX_REASON_LENGTH}
            value={draft.reasonAr}
            onChange={(event) => set("reasonAr", event.target.value)}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent p-2.5 text-base outline-none focus-visible:ring-3 md:text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-reason-en`}>{t("closureReasonEn")}</Label>
          <textarea
            id={`${fieldId}-reason-en`}
            dir="ltr"
            lang="en"
            rows={3}
            maxLength={MAX_REASON_LENGTH}
            value={draft.reasonEn}
            onChange={(event) => set("reasonEn", event.target.value)}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent p-2.5 text-base outline-none focus-visible:ring-3 md:text-sm"
          />
        </div>
      </div>
      {/*
        **`{min}` is not optional.** next-intl throws a FORMATTING_ERROR for a
        message whose argument was not supplied and renders the raw key path —
        `zoneAdmin.closureReasonHint` appeared under the two reason boxes with
        `typecheck`, `lint`, `i18n:check` and the suite all green. Thread 60's
        shape, found by opening the page. The floor is stated once, from the
        constant the validator uses, so the sentence cannot claim a number the
        refusal does not enforce.
      */}
      <p className="text-muted-foreground text-sm">
        {t("closureReasonHint", { min: minLabel })}
      </p>

      <div className="flex max-w-md flex-col gap-1.5">
        <Label htmlFor={`${fieldId}-ref`}>{t("closureAuthorityRef")}</Label>
        <Input
          id={`${fieldId}-ref`}
          value={draft.authorityRef}
          onChange={(event) => set("authorityRef", event.target.value)}
        />
        <p className="text-muted-foreground text-sm">
          {t("closureAuthorityRefHint")}
        </p>
      </div>

      {/* --- What is wrong with the window, as it is typed ------------------- */}
      {problems.length > 0 ? (
        <ul className="text-muted-foreground ms-4 list-disc text-sm">
          {problems.map((code) => (
            <li key={code}>
              {t(`problems.${code}`, { min: minLabel })}
            </li>
          ))}
        </ul>
      ) : null}

      {reasons.length > 0 ? (
        <div className="border-destructive flex flex-col gap-1 rounded-lg border border-s-4 p-3 text-sm">
          {reasons.map((reason, index) => (
            <p key={`${reason.code}-${index}`}>
              {reason.code === "rate_limited"
                ? tErrors("rateLimited", {
                    duration: formatSeconds(
                      Number(reason.params?.retryAfterSeconds ?? 0),
                      locale,
                    ),
                  })
                : t.has(`problems.${reason.code}`)
                  ? t(`problems.${reason.code}`, { min: minLabel })
                  : tErrors("generic")}
            </p>
          ))}
        </div>
      ) : null}

      {/* --- Whose flights this window covers -------------------------------- */}
      {preview ? (
        <div className="flex flex-col gap-2 rounded-lg border border-s-4 p-3">
          <h3 className="text-sm font-medium">{t("closurePreviewHeading")}</h3>
          <p className="text-sm">
            <bdi>
              {t("closureWindow", {
                start: formatDateTime(new Date(preview.startsAt), locale),
                end: formatDateTime(new Date(preview.endsAt), locale),
              })}
            </bdi>
          </p>
          <ImpactTable
            rows={preview.bookings}
            locale={locale}
            emptyLabel={t("closurePreviewNone")}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending || !checked.ok}
          onClick={check}
        >
          {t("closureCheck")}
        </Button>
        <Button type="button" disabled={pending || !checked.ok} onClick={create}>
          {t("closureCreate")}
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">{t("closureCreateHint")}</p>
    </section>
  );
}
