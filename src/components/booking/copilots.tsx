"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_COPILOTS } from "@/lib/validation/booking";

/**
 * The crew, up to three.
 *
 * **Both names are asked for, and both are required per co-pilot.**
 * `booking_copilot.full_name_ar` and `full_name_en` are both `NOT NULL` — the
 * paired-column convention for human-authored content — and the alternative,
 * copying whichever was given into the other column, would put Latin letters
 * into an Arabic field and make the pair a lie the moment a reviewer read it.
 *
 * **Rows are added on request, not rendered three deep.** Most flights have no
 * crew at all; opening with six empty fields tells every solo pilot that they
 * have left something blank.
 */

export type CopilotDraft = {
  fullNameAr: string;
  fullNameEn: string;
  mobileE164: string;
};

export const EMPTY_COPILOT: CopilotDraft = {
  fullNameAr: "",
  fullNameEn: "",
  mobileE164: "",
};

export function Copilots({
  copilots,
  onChange,
  problems,
}: {
  copilots: readonly CopilotDraft[];
  onChange: (next: CopilotDraft[]) => void;
  problems: ReadonlySet<string>;
}) {
  const t = useTranslations("booking");
  const groupId = useId();

  function patch(index: number, changes: Partial<CopilotDraft>) {
    onChange(
      copilots.map((copilot, i) =>
        i === index ? { ...copilot, ...changes } : copilot,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">{t("copilotsHint")}</p>

      {problems.has("copilot_name_required") ? (
        <p className="text-destructive text-sm">{t("copilotNameRequired")}</p>
      ) : null}
      {problems.has("copilot_mobile_format") ? (
        <p className="text-destructive text-sm">{t("copilotMobileFormat")}</p>
      ) : null}

      {copilots.map((copilot, index) => (
        <fieldset
          key={`${groupId}-${index}`}
          className="flex flex-col gap-3 rounded-lg border p-3"
        >
          <legend className="px-1 text-sm font-medium">
            {t("copilotN", { n: index + 1 })}
          </legend>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${groupId}-ar-${index}`}>
                {t("copilotNameAr")}
              </Label>
              {/**
               * `dir="rtl"` and `lang="ar"` on the Arabic field regardless of
               * the page's locale: an English-reading pilot typing a colleague's
               * Arabic name still needs the caret to start on the right.
               */}
              <Input
                id={`${groupId}-ar-${index}`}
                dir="rtl"
                lang="ar"
                value={copilot.fullNameAr}
                onChange={(event) =>
                  patch(index, { fullNameAr: event.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${groupId}-en-${index}`}>
                {t("copilotNameEn")}
              </Label>
              <Input
                id={`${groupId}-en-${index}`}
                dir="ltr"
                lang="en"
                value={copilot.fullNameEn}
                onChange={(event) =>
                  patch(index, { fullNameEn: event.target.value })
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${groupId}-mobile-${index}`}>
              {t("copilotMobile")}
            </Label>
            <Input
              id={`${groupId}-mobile-${index}`}
              // `tel`, not `number`: a leading zero matters and a spinner does
              // not belong on a phone number.
              type="tel"
              inputMode="tel"
              dir="ltr"
              placeholder="05XXXXXXXX"
              value={copilot.mobileE164}
              onChange={(event) =>
                patch(index, { mobileE164: event.target.value })
              }
            />
          </div>

          <button
            type="button"
            className="text-muted-foreground hover:text-foreground self-start text-sm underline underline-offset-4"
            onClick={() => onChange(copilots.filter((_, i) => i !== index))}
          >
            {t("copilotRemove")}
          </button>
        </fieldset>
      ))}

      {copilots.length < MAX_COPILOTS ? (
        <button
          type="button"
          className="self-start text-sm underline underline-offset-4"
          onClick={() => onChange([...copilots, { ...EMPTY_COPILOT }])}
        >
          {t("copilotAdd")}
        </button>
      ) : (
        /**
         * The ceiling is stated rather than the control silently vanishing —
         * a button that disappears reads as a bug, a sentence reads as a rule.
         */
        <p className="text-muted-foreground text-sm">{t("copilotMax")}</p>
      )}
    </div>
  );
}
