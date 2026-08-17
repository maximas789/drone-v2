"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { saveContactAction, saveIdentityAction } from "@/lib/actions/profile";
import type { Reason } from "@/lib/actions/result";
import { formatNumber, formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import {
  validateArabicName,
  validateLatinName,
  validateContact,
  validateIdentity,
} from "@/lib/validation/profile";
import { FormProblem } from "./field";
import { StepContact, type CityOption } from "./step-contact";
import { StepIdentity, type IdentityValues } from "./step-identity";
import { StepName } from "./step-name";

/**
 * `/profile/complete` — the wizard.
 *
 * **What "saving progress at each step" actually means here.** Steps 1 and 2 are
 * saved together, because `pilot_profile.id_document_number` and
 * `id_document_hash` are NOT NULL: there is no row that holds a name and no
 * document, and loosening those columns so a form could save half an identity
 * would weaken a regulator-facing record for the sake of a wizard. So the panes
 * are three and the writes are two — and the UI only claims a step is saved
 * where it genuinely is.
 *
 * **Step 1 is validated in the browser and nowhere else, until it is submitted
 * with step 2.** The validators are the *same pure functions* the server runs
 * (`src/lib/validation/`), so nothing here is a second opinion about what a
 * valid name is. The client is the same check, earlier — never the check.
 *
 * **A refusal that belongs to a hidden pane sends the pilot back to that pane.**
 * An error rendered on a field nobody can see is a form that silently refuses to
 * advance, which is the worst version of this screen.
 */

const TOTAL_STEPS = 3;

/**
 * Which pane owns which refusal code. The wizard needs this to put a
 * server-side refusal in front of the person who can fix it, and `Field` needs
 * the same codes to decide which input to mark invalid — one table, so the two
 * cannot disagree.
 */
const STEP_FOR_CODE: Record<string, 1 | 2 | 3> = {
  name_ar_required: 1,
  name_ar_script: 1,
  name_en_required: 1,
  name_en_script: 1,
  id_format: 2,
  id_checksum: 2,
  id_type_mismatch: 2,
  id_already_registered: 2,
  dob_required: 2,
  dob_invalid: 2,
  dob_underage: 2,
  mobile_format: 3,
  city_required: 3,
  emergency_contact_format: 3,
  address_too_long: 3,
};

export type WizardInitialValues = {
  fullNameAr: string;
  fullNameEn: string;
  idDocumentType: IdentityValues["idDocumentType"];
  /**
   * **Empty when a row already exists.** A saved identity number is never sent
   * back to the browser — not even to its owner, who has already seen the mask
   * and would have to retype it to change it. That is the same rule the masking
   * table states, applied to a form field: a value that never reaches the client
   * cannot leak from it.
   */
  idDocumentNumber: string;
  dateOfBirth: string;
  mobileE164: string;
  addressCityId: string;
  addressLine: string;
  emergencyContact: string;
};

export function ProfileWizard({
  initial,
  cities,
  locale,
  /** True when the identity half is already on the row. */
  hasIdentity,
  /** Where to go when the profile is complete. Already checked by the page. */
  next,
}: {
  initial: WizardInitialValues;
  cities: readonly CityOption[];
  locale: Locale;
  hasIdentity: boolean;
  next: string;
}) {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const router = useRouter();

  // Land where there is still something to answer, rather than always at pane 1.
  // Somebody returning to a half-finished profile has already typed their name.
  const [step, setStep] = useState<1 | 2 | 3>(hasIdentity ? 3 : 1);
  const [values, setValues] = useState(initial);
  const [problems, setProblems] = useState<ReadonlySet<string>>(new Set());
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [pending, startTransition] = useTransition();

  function patch(changes: Partial<WizardInitialValues>) {
    setValues((current) => ({ ...current, ...changes }));
    setSavedNotice(false);
  }

  /** Turns an action's refusal into pane-level state. */
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
    } else if (reasons.some((reason) => reason.code === "unauthorized")) {
      setFormMessage(t("errors.unauthorized"));
    } else if (reasons.some((reason) => reason.code === "profile_identity_first")) {
      setFormMessage(t("errors.profile_identity_first"));
    } else if (!reasons.some((reason) => reason.code in STEP_FOR_CODE)) {
      // A code no pane owns. Better a generic sentence than silence — the
      // alternative is a button that does nothing and says nothing.
      setFormMessage(tErrors("generic"));
    } else {
      setFormMessage(null);
    }

    // Show the pane that owns the *first* refusal, so the field carrying the
    // message is on screen.
    const owned = reasons
      .map((reason) => STEP_FOR_CODE[reason.code])
      .filter((value): value is 1 | 2 | 3 => value !== undefined);
    if (owned.length > 0) setStep(Math.min(...owned) as 1 | 2 | 3);
  }

  /** Pane 1 → pane 2. No server call: nothing can be stored yet. */
  function advanceFromName() {
    const found = [
      validateArabicName(values.fullNameAr),
      validateLatinName(values.fullNameEn),
    ].filter((problem): problem is NonNullable<typeof problem> => problem !== null);

    if (found.length > 0) {
      setProblems(new Set(found));
      setFormMessage(null);
      return;
    }
    setProblems(new Set());
    setFormMessage(null);
    setStep(2);
  }

  /** Pane 2 → the first write. */
  function saveIdentity() {
    const checked = validateIdentity({
      fullNameAr: values.fullNameAr,
      fullNameEn: values.fullNameEn,
      idDocumentType: values.idDocumentType,
      idDocumentNumber: values.idDocumentNumber,
      dateOfBirth: values.dateOfBirth,
    });
    if (!checked.ok) {
      applyReasons(checked.problems.map((code) => ({ code })));
      return;
    }

    startTransition(async () => {
      const result = await saveIdentityAction(checked.value);
      if (!result.ok) return applyReasons(result.reasons);

      setProblems(new Set());
      setFormMessage(null);
      setSavedNotice(true);
      setStep(3);
    });
  }

  /** Pane 3 → the second write, and out. */
  function saveContact() {
    const checked = validateContact({
      mobileE164: values.mobileE164,
      addressCityId: values.addressCityId,
      addressLine: values.addressLine,
      emergencyContact: values.emergencyContact,
    });
    if (!checked.ok) {
      applyReasons(checked.problems.map((code) => ({ code })));
      return;
    }

    startTransition(async () => {
      const result = await saveContactAction(checked.value);
      if (!result.ok) return applyReasons(result.reasons);

      setProblems(new Set());
      setFormMessage(null);

      if (result.data.completed) {
        // `refresh` first: the shell and the destination both read the profile,
        // and a push alone would render them from the cache that still says
        // incomplete.
        router.refresh();
        router.push(next);
        return;
      }
      setSavedNotice(true);
    });
  }

  /**
   * No way back into the identity panes for somebody whose identity is already
   * stored. The number is deliberately never sent to the browser, so pane 2
   * would open empty and "save" would refuse a field they cannot see the current
   * value of. Changing a stored document is `/settings/profile`'s job, where the
   * consequence — verification is cleared — can be stated before they type.
   */
  const canGoBack = step > 1 && !(hasIdentity && step === 3);

  const heading =
    step === 1 ? t("stepName") : step === 2 ? t("stepIdentity") : t("stepContact");
  const help =
    step === 1
      ? t("stepNameHelp")
      : step === 2
        ? t("stepIdentityHelp")
        : t("stepContactHelp");

  return (
    <form
      // A real `<form>` with a real submit: Enter in a text field then does what
      // the visible button does, which is what everybody expects and what a
      // `<div>` full of inputs never delivers.
      onSubmit={(event) => {
        event.preventDefault();
        if (step === 1) return advanceFromName();
        if (step === 2) return saveIdentity();
        return saveContact();
      }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-xs">
          {/* Both numbers are pre-formatted. A bare `{step}` handed to ICU
              renders `١` under `ar` — open thread 22. */}
          {t("stepOf", {
            step: formatNumber(step, locale),
            total: formatNumber(TOTAL_STEPS, locale),
          })}
        </p>
        <h2 className="text-lg font-medium">{heading}</h2>
        <p className="text-muted-foreground text-sm">{help}</p>
      </div>

      {step === 1 ? (
        <StepName
          values={values}
          problems={problems}
          disabled={pending}
          onChange={patch}
        />
      ) : null}

      {step === 2 ? (
        <StepIdentity
          values={values}
          locale={locale}
          problems={problems}
          disabled={pending}
          onChange={patch}
        />
      ) : null}

      {step === 3 ? (
        <StepContact
          values={values}
          cities={cities}
          locale={locale}
          problems={problems}
          disabled={pending}
          onChange={patch}
        />
      ) : null}

      <FormProblem>{formMessage}</FormProblem>

      {savedNotice ? (
        <p role="status" className="text-muted-foreground text-sm">
          {t("savedStep")}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {canGoBack ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setProblems(new Set());
              setFormMessage(null);
              setStep((current) => (current === 3 ? 2 : 1));
            }}
          >
            {tCommon("back")}
          </Button>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending
            ? t("saving")
            : step === 3
              ? t("finish")
              : t("saveAndContinue")}
        </Button>
      </div>
    </form>
  );
}
