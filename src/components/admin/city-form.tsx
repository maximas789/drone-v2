"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { createCityAction } from "@/lib/actions/admin";
import type { Reason } from "@/lib/actions/result";
import { formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import {
  emptyCityDraft,
  validateCity,
  type CityDraft,
} from "@/lib/validation/city";

/**
 * Adding a city — **the thing that makes a new place drawable.**
 *
 * A zone belongs to a city, so nothing can be drawn anywhere this list does not
 * name. That is the whole of this form's purpose, and it is why it is a plain
 * five-field panel rather than a map: the centroid is where a map opens, not a
 * boundary, and asking somebody to draw a point would imply a precision that
 * has no consequence.
 *
 * **Latitude and longitude are two labelled fields, not one `[lng, lat]` pair.**
 * The reversal is the classic bug in this project — the geometry validator
 * refuses a whole polygon for it — and two labels in the reader's own language
 * are what stop it here.
 *
 * `isModelled` is **not** on the form. It claims a city has authored airspace,
 * and creating a row does not make that true.
 */
export function CityForm({ locale }: { locale: Locale }) {
  const t = useTranslations("cityAdmin");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const fieldId = useId();

  const [draft, setDraft] = useState<CityDraft>(emptyCityDraft);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const checked = validateCity(draft);
  const problems = checked.ok ? [] : checked.problems;

  function set<K extends keyof CityDraft>(key: K, value: CityDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      setReasons([]);
      const result = await createCityAction(draft);
      if (!result.ok) {
        setReasons(result.reasons);
        return;
      }
      setDraft(emptyCityDraft());
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{t("newHeading")}</h2>
        <p className="text-muted-foreground text-sm">{t("newIntro")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-code`}>{t("code")}</Label>
          <Input
            id={`${fieldId}-code`}
            dir="ltr"
            className="w-28 font-mono"
            maxLength={3}
            value={draft.code}
            onChange={(event) => set("code", event.target.value.toUpperCase())}
          />
          <p className="text-muted-foreground text-sm">{t("codeHint")}</p>
        </div>
        <div />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-name-ar`}>{t("nameAr")}</Label>
          <Input
            id={`${fieldId}-name-ar`}
            dir="rtl"
            lang="ar"
            value={draft.nameAr}
            onChange={(event) => set("nameAr", event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-name-en`}>{t("nameEn")}</Label>
          <Input
            id={`${fieldId}-name-en`}
            dir="ltr"
            lang="en"
            value={draft.nameEn}
            onChange={(event) => set("nameEn", event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-lat`}>{t("centroidLat")}</Label>
          <Input
            id={`${fieldId}-lat`}
            dir="ltr"
            inputMode="decimal"
            placeholder="24.7136"
            value={draft.centroidLat}
            onChange={(event) => set("centroidLat", event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-lng`}>{t("centroidLng")}</Label>
          <Input
            id={`${fieldId}-lng`}
            dir="ltr"
            inputMode="decimal"
            placeholder="46.6753"
            value={draft.centroidLng}
            onChange={(event) => set("centroidLng", event.target.value)}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-sm">{t("centroidHint")}</p>

      {problems.length > 0 ? (
        <ul className="text-muted-foreground ms-4 list-disc text-sm">
          {problems.map((code) => (
            <li key={code}>{t(`problems.${code}`)}</li>
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
                  ? t(`problems.${reason.code}`)
                  : tErrors("generic")}
            </p>
          ))}
        </div>
      ) : null}

      {saved ? <p className="text-sm">{t("saved")}</p> : null}

      <div>
        <Button type="button" disabled={pending || !checked.ok} onClick={save}>
          {t("create")}
        </Button>
      </div>
    </section>
  );
}
