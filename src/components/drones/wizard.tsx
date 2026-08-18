"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormProblem } from "@/components/form/field";
import type { PhotoRow } from "@/components/upload/photo-grid";
import { useRouter } from "@/i18n/navigation";
import { saveDroneDraftAction, submitDroneAction } from "@/lib/actions/drone";
import type { Reason } from "@/lib/actions/result";
import { formatNumber, formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import {
  validateDroneSpecs,
  validateDroneType,
  type BuildType,
} from "@/lib/validation/drone";
import { StepPhotos } from "./step-photos";
import { StepRemoteId } from "./step-remote-id";
import { StepReview } from "./step-review";
import { StepSpecs } from "./step-specs";
import { StepType } from "./step-type";

/**
 * `/drones/new` — the flow the whole product exists for.
 *
 * **Five panes, and the first write lands on pane 2.** `drone.nickname`,
 * `buildType`, `weightGrams` and `weightClass` are all NOT NULL, so there is no
 * row to save after pane 1 alone — the same shape F17 hit with `pilot_profile`,
 * resolved the same way rather than by loosening the columns for a form. From
 * pane 2 onwards the draft id lives in the URL, so a closed tab loses nothing
 * and pane 4 has a drone to attach photographs to.
 *
 * **The client validates with the same pure functions the server runs.** The
 * client is the same check, earlier — never the check. `saveDroneDraftAction`
 * re-runs both, and takes the build type from the validated pane-1 payload so a
 * direct POST cannot claim `self_built` on one pane and `commercial` on the
 * other to slip past the serial rule in whichever direction suits it.
 */

const TOTAL_STEPS = 5;

type Step = 1 | 2 | 3 | 4 | 5;

/** Which pane owns which refusal, so a refusal is shown to somebody who can fix it. */
const STEP_FOR_CODE: Record<string, Step> = {
  nickname_required: 1,
  build_type_required: 1,
  manufacturer_required: 1,
  text_too_long: 1,
  weight_required: 2,
  weight_out_of_range: 2,
  serial_required: 2,
  serial_format: 2,
  serial_not_applicable: 2,
  photo_required: 4,
};

export type WizardValues = {
  nickname: string;
  buildType: BuildType | "";
  manufacturer: string;
  model: string;
  propulsion: string;
  weightGrams: string;
  hasCamera: boolean;
  serialNumber: string;
};

export function DroneWizard({
  draftId,
  initial,
  photos,
  locale,
}: {
  /** Present once the draft exists — it is in the URL, not in state. */
  draftId: string | null;
  initial: WizardValues;
  photos: PhotoRow[];
  locale: Locale;
}) {
  const t = useTranslations("drones");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const router = useRouter();

  // Somebody returning to a saved draft has already answered panes 1 and 2.
  const [step, setStep] = useState<Step>(draftId ? 3 : 1);
  const [values, setValues] = useState(initial);
  const [problems, setProblems] = useState<ReadonlySet<string>>(new Set());
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [pending, startTransition] = useTransition();

  function patch(changes: Partial<WizardValues>) {
    setValues((current) => ({ ...current, ...changes }));
    setSavedNotice(false);
  }

  function applyReasons(reasons: readonly Reason[]) {
    setProblems(new Set(reasons.map((reason) => reason.code)));

    const rateLimited = reasons.find((reason) => reason.code === "rate_limited");
    if (rateLimited) {
      setFormMessage(
        tErrors("rateLimited", {
          duration: formatSeconds(
            Number(rateLimited.params?.retryAfterSeconds ?? 0),
            locale,
          ),
        }),
      );
    } else if (reasons.some((reason) => reason.code === "profile_incomplete")) {
      // The one refusal with a fix that is not on this page at all.
      setFormMessage(t("errors.profile_incomplete"));
    } else if (reasons.some((reason) => reason.code === "not_authenticated")) {
      setFormMessage(t("errors.not_authenticated"));
    } else if (reasons.some((reason) => reason.code === "not_editable")) {
      setFormMessage(t("errors.not_editable"));
    } else if (!reasons.some((reason) => reason.code in STEP_FOR_CODE)) {
      setFormMessage(tErrors("generic"));
    } else {
      setFormMessage(null);
    }

    const owned = reasons
      .map((reason) => STEP_FOR_CODE[reason.code])
      .filter((value): value is Step => value !== undefined);
    if (owned.length > 0) setStep(Math.min(...owned) as Step);
  }

  /** Pane 1 → pane 2. Nothing can be stored yet, so nothing is claimed to be. */
  function advanceFromType() {
    const checked = validateDroneType(values);
    if (!checked.ok) {
      setProblems(new Set(checked.problems));
      setFormMessage(null);
      return;
    }
    setProblems(new Set());
    setFormMessage(null);
    setStep(2);
  }

  /** Pane 2 → the first write, and the draft id into the URL. */
  function saveDraft() {
    const type = validateDroneType(values);
    if (!type.ok) return applyReasons(type.problems.map((code) => ({ code })));

    const specs = validateDroneSpecs({
      ...values,
      buildType: type.value.buildType,
    });
    if (!specs.ok) return applyReasons(specs.problems.map((code) => ({ code })));

    startTransition(async () => {
      const result = await saveDroneDraftAction(draftId, {
        type: values,
        specs: {
          weightGrams: values.weightGrams,
          hasCamera: values.hasCamera,
          serialNumber: values.serialNumber,
        },
      });
      if (!result.ok) return applyReasons(result.reasons);

      setProblems(new Set());
      setFormMessage(null);
      setSavedNotice(true);
      setStep(3);

      if (!draftId) {
        /**
         * `replace`, not `push`: the draft-less URL is not a place anybody
         * should be able to go Back to once the row exists, or they would land
         * on an empty wizard and create a second draft for the same aircraft.
         */
        router.replace(`/drones/new?draft=${result.data.droneId}`);
      }
    });
  }

  /** Pane 5 → the submission gate. */
  function submit() {
    if (!draftId) return;
    startTransition(async () => {
      const result = await submitDroneAction(draftId);
      if (!result.ok) return applyReasons(result.reasons);
      router.refresh();
      router.push("/drones");
    });
  }

  const heading = [
    t("stepType"),
    t("stepSpecs"),
    t("stepRemoteId"),
    t("stepPhotos"),
    t("stepReview"),
  ][step - 1];
  const help = [
    t("stepTypeHelp"),
    t("stepSpecsHelp"),
    t("stepRemoteIdHelp"),
    t("stepPhotosHelp"),
    t("stepReviewHelp"),
  ][step - 1];

  const buildType: BuildType = values.buildType || "self_built";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (step === 1) return advanceFromType();
        if (step === 2) return saveDraft();
        if (step === 5) return submit();
        setStep((current) => (current + 1) as Step);
      }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-xs">
          {/* Both pre-formatted — a bare `{step}` renders `١` under `ar`. */}
          {t("stepOf", {
            step: formatNumber(step, locale),
            total: formatNumber(TOTAL_STEPS, locale),
          })}
        </p>
        <h2 className="text-lg font-medium">{heading}</h2>
        <p className="text-muted-foreground text-sm">{help}</p>
      </div>

      {step === 1 ? (
        <StepType
          values={values}
          problems={problems}
          disabled={pending}
          onChange={patch}
        />
      ) : null}

      {step === 2 ? (
        <StepSpecs
          buildType={buildType}
          values={values}
          locale={locale}
          problems={problems}
          disabled={pending}
          onChange={patch}
        />
      ) : null}

      {step === 3 ? <StepRemoteId /> : null}

      {step === 4 && draftId ? (
        <StepPhotos
          droneId={draftId}
          photos={photos}
          problems={problems}
          locale={locale}
        />
      ) : null}

      {step === 5 ? (
        <StepReview
          values={{ ...values, buildType }}
          photoCount={photos.length}
          locale={locale}
        />
      ) : null}

      <FormProblem>{formMessage}</FormProblem>

      {savedNotice ? (
        <p role="status" className="text-muted-foreground text-sm">
          {t("savedDraft")}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {step > 1 ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setProblems(new Set());
              setFormMessage(null);
              setStep((current) => (current - 1) as Step);
            }}
          >
            {tCommon("back")}
          </Button>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending
            ? step === 5
              ? t("submitting")
              : tCommon("loading")
            : step === 5
              ? t("submitForReview")
              : step === 2
                ? t("saveAndContinue")
                : tCommon("next")}
        </Button>
      </div>
    </form>
  );
}
