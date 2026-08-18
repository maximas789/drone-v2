"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveContactAction, saveIdentityAction } from "@/lib/actions/profile";
import type { Reason } from "@/lib/actions/result";
import { formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { validateContact, validateIdentity } from "@/lib/validation/profile";
import { FormProblem } from "@/components/form/field";
import { StepContact, type CityOption, type ContactValues } from "./step-contact";
import { StepIdentity, type IdentityValues } from "./step-identity";
import { StepName } from "./step-name";

/**
 * `/settings/profile` — editing a profile that already exists.
 *
 * **Two independent forms, on purpose**, because the two halves have different
 * consequences and only one of them is reversible in the pilot's own hands:
 *
 * - **Contact details** save freely. A new mobile number says nothing about who
 *   somebody is, so a human verification of their document still stands.
 * - **Identity** is behind a disclosure and an acknowledgement, because saving it
 *   clears `verifiedAt` and puts the profile back in the review queue. F17's
 *   requirement is that the UI *warns before* saving, not that it explains
 *   afterwards — a pilot who loses a verification they waited days for must have
 *   been told that was the trade.
 *
 * The identity form opens **empty**. The stored document number is never sent to
 * the browser, so changing it means retyping it in full — which is also the
 * safest thing to ask of somebody changing an identity document.
 */

const STEP_CODES = new Set([
  "name_ar_required",
  "name_ar_script",
  "name_en_required",
  "name_en_script",
  "id_format",
  "id_checksum",
  "id_type_mismatch",
  "id_already_registered",
  "dob_required",
  "dob_invalid",
  "dob_underage",
  "mobile_format",
  "city_required",
  "emergency_contact_format",
  "address_too_long",
]);

export function ProfileEditor({
  identity,
  contact,
  cities,
  locale,
  isVerified,
}: {
  identity: {
    fullNameAr: string;
    fullNameEn: string;
    idDocumentType: IdentityValues["idDocumentType"];
  };
  contact: ContactValues;
  cities: readonly CityOption[];
  locale: Locale;
  /** Drives the warning: there is nothing to lose if nobody has verified yet. */
  isVerified: boolean;
}) {
  return (
    <div className="flex flex-col gap-8">
      <ContactForm
        initial={contact}
        cities={cities}
        locale={locale}
      />
      <IdentityForm initial={identity} locale={locale} isVerified={isVerified} />
    </div>
  );
}

/** Shared refusal handling. One definition, so the two forms cannot diverge. */
function useRefusals(locale: Locale) {
  const t = useTranslations("profile");
  const tErrors = useTranslations("errors");
  const [problems, setProblems] = useState<ReadonlySet<string>>(new Set());
  const [formMessage, setFormMessage] = useState<string | null>(null);

  function clear() {
    setProblems(new Set());
    setFormMessage(null);
  }

  function apply(reasons: readonly Reason[]) {
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
    if (reasons.some((reason) => reason.code === "not_authenticated")) {
      setFormMessage(t("errors.not_authenticated"));
      return;
    }
    if (reasons.some((reason) => reason.code === "profile_identity_first")) {
      setFormMessage(t("errors.profile_identity_first"));
      return;
    }
    // Every remaining code should be owned by a field. If none is, say something
    // rather than leaving a button that appears to do nothing.
    setFormMessage(
      reasons.some((reason) => STEP_CODES.has(reason.code))
        ? null
        : tErrors("generic"),
    );
  }

  return { problems, formMessage, apply, clear, setFormMessage };
}

function ContactForm({
  initial,
  cities,
  locale,
}: {
  initial: ContactValues;
  cities: readonly CityOption[];
  locale: Locale;
}) {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const { problems, formMessage, apply, clear } = useRefusals(locale);
  const headingId = useId();

  function submit() {
    const checked = validateContact(values);
    if (!checked.ok) {
      setSaved(false);
      return apply(checked.problems.map((code) => ({ code })));
    }
    startTransition(async () => {
      const result = await saveContactAction(checked.value);
      if (!result.ok) {
        setSaved(false);
        return apply(result.reasons);
      }
      clear();
      setSaved(true);
    });
  }

  return (
    <form
      aria-labelledby={headingId}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4"
    >
      <h2 id={headingId} className="text-sm font-medium">
        {t("contactSection")}
      </h2>

      <StepContact
        values={values}
        cities={cities}
        locale={locale}
        problems={problems}
        disabled={pending}
        onChange={(patch) => {
          setValues((current) => ({ ...current, ...patch }));
          setSaved(false);
        }}
      />

      <FormProblem>{formMessage}</FormProblem>
      {saved ? (
        <p role="status" className="text-muted-foreground text-sm">
          {t("saved")}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("saving") : tCommon("save")}
      </Button>
    </form>
  );
}

function IdentityForm({
  initial,
  locale,
  isVerified,
}: {
  initial: {
    fullNameAr: string;
    fullNameEn: string;
    idDocumentType: IdentityValues["idDocumentType"];
  };
  locale: Locale;
  isVerified: boolean;
}) {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({
    ...initial,
    idDocumentNumber: "",
    dateOfBirth: "",
  });
  const [acknowledged, setAcknowledged] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const { problems, formMessage, apply, clear } = useRefusals(locale);
  const headingId = useId();
  const ackId = useId();

  function submit() {
    const checked = validateIdentity(values);
    if (!checked.ok) {
      setSaved(false);
      return apply(checked.problems.map((code) => ({ code })));
    }
    startTransition(async () => {
      const result = await saveIdentityAction(checked.value);
      if (!result.ok) {
        setSaved(false);
        return apply(result.reasons);
      }
      clear();
      setSaved(true);
      setCleared(result.data.verificationCleared);
    });
  }

  if (!open) {
    return (
      <section aria-labelledby={headingId} className="flex flex-col gap-3">
        <h2 id={headingId} className="text-sm font-medium">
          {t("identitySection")}
        </h2>
        {isVerified ? (
          <p className="text-muted-foreground border-s-2 ps-3 text-xs">
            {t("identityChangeWarning")}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => setOpen(true)}
        >
          {t("editIdentity")}
        </Button>
      </section>
    );
  }

  return (
    <form
      aria-labelledby={headingId}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4"
    >
      <h2 id={headingId} className="text-sm font-medium">
        {t("identitySection")}
      </h2>

      <p className="text-destructive border-s-2 border-destructive ps-3 text-sm">
        {t("identityChangeWarning")}
      </p>

      <StepName
        values={values}
        problems={problems}
        disabled={pending}
        onChange={(patch) => {
          setValues((current) => ({ ...current, ...patch }));
          setSaved(false);
        }}
      />

      <StepIdentity
        values={values}
        locale={locale}
        problems={problems}
        disabled={pending}
        onChange={(patch) => {
          setValues((current) => ({ ...current, ...patch }));
          setSaved(false);
        }}
      />

      {/**
       * The acknowledgement gates the button rather than appearing after it was
       * pressed. It is only asked of somebody who has a verification to lose —
       * asking an unverified pilot to confirm they understand nothing will happen
       * would train everybody to tick it without reading.
       */}
      {isVerified ? (
        <span className="flex items-center gap-2">
          <input
            id={ackId}
            type="checkbox"
            className="size-4 accent-current"
            checked={acknowledged}
            disabled={pending}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <label htmlFor={ackId} className="text-sm">
            {t("identityChangeAcknowledge")}
          </label>
        </span>
      ) : null}

      <FormProblem>{formMessage}</FormProblem>

      {cleared ? (
        <p role="status" className="text-sm">
          {t("verificationClearedNotice")}
        </p>
      ) : saved ? (
        <p role="status" className="text-muted-foreground text-sm">
          {t("saved")}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={pending || (isVerified && !acknowledged)}
        >
          {pending ? t("saving") : tCommon("save")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            clear();
          }}
        >
          {tCommon("cancel")}
        </Button>
      </div>
    </form>
  );
}
