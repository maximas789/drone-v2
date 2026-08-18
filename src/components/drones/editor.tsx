"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { FormProblem } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { saveDroneDraftAction } from "@/lib/actions/drone";
import type { Reason } from "@/lib/actions/result";
import { formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import {
  validateDroneSpecs,
  validateDroneType,
  type BuildType,
} from "@/lib/validation/drone";
import type { WizardValues } from "./wizard";
import { StepSpecs } from "./step-specs";
import { StepType } from "./step-type";

/**
 * Editing an aircraft that already exists — **one screen, not a wizard.**
 *
 * The wizard's five panes exist to walk somebody through a decision they have
 * not made yet. A pilot correcting a weight a reviewer queried has already made
 * every one of those decisions and knows exactly which field is wrong; making
 * them click Next four times to reach it would be a worse form, not a
 * consistent one.
 *
 * **The same two panes, reused as sections.** `StepType` and `StepSpecs` are
 * rendered here directly rather than re-implemented: the fields, their hints,
 * the radio cards and — the part that matters — the rule that the serial field
 * is *absent* for a self-built or FPV airframe all come from one place. A
 * second copy of those fields is a second place for that rule to be got wrong,
 * and it is the one rule this product cannot get wrong.
 *
 * It posts `saveDroneDraftAction`, which re-runs both validators server-side
 * and re-checks that the drone is still editable. The client pass is the same
 * check, earlier — never the check.
 */
export function DroneEditor({
  droneId,
  initial,
  locale,
}: {
  droneId: string;
  initial: WizardValues;
  locale: Locale;
}) {
  const t = useTranslations("drones");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const router = useRouter();

  const [values, setValues] = useState(initial);
  const [problems, setProblems] = useState<ReadonlySet<string>>(new Set());
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function patch(changes: Partial<WizardValues>) {
    setValues((current) => ({ ...current, ...changes }));
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
      return;
    }

    /**
     * The three refusals whose fix is not a field on this form. `not_editable`
     * is the one a pilot can reach without doing anything wrong — a reviewer
     * picking the request up while the form was open — so it names what
     * happened rather than saying the save failed.
     */
    for (const code of ["not_editable", "not_found", "not_authenticated"]) {
      if (reasons.some((reason) => reason.code === code)) {
        setFormMessage(t(`errors.${code}`));
        return;
      }
    }

    // Everything else belongs to a field, and `Field` renders it there.
    setFormMessage(null);
  }

  function save() {
    const type = validateDroneType(values);
    if (!type.ok) return applyReasons(type.problems.map((code) => ({ code })));

    const specs = validateDroneSpecs({
      ...values,
      buildType: type.value.buildType,
    });
    if (!specs.ok) return applyReasons(specs.problems.map((code) => ({ code })));

    startTransition(async () => {
      const result = await saveDroneDraftAction(droneId, {
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
      /**
       * Back to the aircraft, not to a "saved" banner on the form. The detail
       * page is where the pilot then presses Resubmit, which is the whole
       * reason a rejected registration is editable at all.
       */
      router.refresh();
      router.push(`/drones/${droneId}`);
    });
  }

  const buildType: BuildType = values.buildType || "self_built";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="flex flex-col gap-8"
    >
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">{t("stepType")}</h2>
        <StepType
          values={values}
          problems={problems}
          disabled={pending}
          onChange={patch}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">{t("stepSpecs")}</h2>
        <StepSpecs
          buildType={buildType}
          values={values}
          locale={locale}
          problems={problems}
          disabled={pending}
          onChange={patch}
        />
      </section>

      <FormProblem>{formMessage}</FormProblem>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? tCommon("loading") : tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
