"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Field, FormProblem } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FileDropzone } from "@/components/upload/file-dropzone";
import { useRouter } from "@/i18n/navigation";
import { declareModuleAction } from "@/lib/actions/remote-id";
import type { Reason } from "@/lib/actions/result";
import { formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";
/**
 * From the **pure** module, never from the action. `actions/remote-id.ts` is
 * `"use server"`, so anything it exports arrives here as a server reference —
 * importing the array from there gave `DECLARATION_KINDS.map is not a
 * function` at render, with every static check green.
 */
import { DECLARATION_KINDS } from "@/lib/validation/declaration";

/**
 * Declare an external Remote ID module against an approved registration.
 *
 * **Two steps, because the document hangs off the declaration.** F07's upload
 * route takes a `targetId` that must already exist — a declaration row — so the
 * row is written first and the PDF is attached to it. That ordering is also the
 * honest one: the claim is what the pilot is making, and the Declaration of
 * Compliance is evidence *for* it. A pilot who has the module but not the paper
 * can still declare, and a reviewer sees a claim with nothing behind it, which
 * is exactly what it is.
 *
 * **The form does not offer a validity window.** `validFrom` / `validUntil`
 * describe when a *certificate* is good for, and a pilot typing those before
 * anybody has read the certificate would put an unchecked claim on the card
 * beside the verified ones. F22's reviewer sets them when verifying.
 *
 * No `<input type="date">` anywhere here — thread 46 — and no native
 * `required`: the browser's own validation speaks the browser's language and
 * cancels the submit before the app's bilingual refusal can run. Every field is
 * checked server-side and the refusal comes back as a code.
 */
export function DeclareModuleForm({
  droneId,
  locale,
}: {
  droneId: string;
  locale: Locale;
}) {
  const t = useTranslations("remoteId.card");
  const tCommon = useTranslations("common");
  const refusalText = useRefusalText(locale);
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>(DECLARATION_KINDS[0]);
  const [manufacturer, setManufacturer] = useState("");
  const [moduleSerial, setModuleSerial] = useState("");
  const [docReference, setDocReference] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  /**
   * The codes that belong to one field, so "this serial is already claimed"
   * appears at the serial rather than only at the foot of the form.
   */
  const [problems, setProblems] = useState<ReadonlySet<string>>(new Set());
  /** Set once the row exists — which is what the PDF can then be attached to. */
  const [declarationId, setDeclarationId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          {t("declareModule")}
        </Button>
        <p className="text-muted-foreground text-xs">{t("declareModuleHint")}</p>
      </div>
    );
  }

  /**
   * The row exists. The form is replaced rather than left on screen, because
   * submitting it again would supersede what was just written — which is a real
   * operation, but not one anybody means to do twice in a row.
   */
  if (declarationId) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <p className="text-sm font-medium">{t("declaredPendingTitle")}</p>
        <p className="text-muted-foreground text-sm">{t("declaredPendingBody")}</p>

        <FileDropzone
          kind="declaration_doc"
          targetId={declarationId}
          locale={locale}
          onUploaded={() => router.refresh()}
        />

        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDeclarationId(null);
              setOpen(false);
              router.refresh();
            }}
          >
            {tCommon("close")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setMessage(null);
          setProblems(new Set());
          const result = await declareModuleAction({
            droneId,
            kind,
            manufacturer,
            moduleSerial,
            docReference,
          });
          if (!result.ok) {
            const codes = result.reasons.map((reason) => reason.code);
            setProblems(new Set(codes));
            /**
             * **Only when no field will say it.** A refusal that belongs to a
             * field is rendered *at* that field; also putting it at the foot of
             * the form printed the same sentence twice, which reads as two
             * different problems. Found by submitting the empty form.
             */
            setMessage(
              codes.some((code) => FIELD_CODES.has(code))
                ? null
                : refusalText(result.reasons),
            );
            return;
          }
          setDeclarationId(result.data.declarationId);
        });
      }}
    >
      <p className="text-sm font-medium">{t("declareModule")}</p>

      <Field
        namespace="remoteId.card"
        label={t("moduleKind")}
        codes={["declaration_kind_required"]}
        problems={problems}
      >
        {(field) => (
          <Select
            {...field}
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            disabled={pending}
          >
            {DECLARATION_KINDS.map((value) => (
              <option key={value} value={value}>
                {t(`moduleKinds.${value}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        namespace="remoteId.card"
        label={t("moduleManufacturer")}
        codes={[]}
        problems={problems}
      >
        {(field) => (
          <Input
            {...field}
            value={manufacturer}
            dir="auto"
            onChange={(event) => setManufacturer(event.target.value)}
            disabled={pending}
          />
        )}
      </Field>

      <Field
        namespace="remoteId.card"
        label={t("moduleSerial")}
        hint={t("moduleSerialHint")}
        codes={["module_serial_claimed"]}
        problems={problems}
      >
        {/* A manufacturer's string: Latin, LTR, monospace — like every other
            serial in this app, and never localised. */}
        {(field) => (
          <Input
            {...field}
            value={moduleSerial}
            dir="ltr"
            className="text-start font-mono"
            onChange={(event) => setModuleSerial(event.target.value)}
            disabled={pending}
          />
        )}
      </Field>

      <Field
        namespace="remoteId.card"
        label={t("moduleDocReference")}
        hint={t("moduleDocReferenceHint")}
        codes={[]}
        problems={problems}
      >
        {(field) => (
          <Input
            {...field}
            value={docReference}
            dir="auto"
            onChange={(event) => setDocReference(event.target.value)}
            disabled={pending}
          />
        )}
      </Field>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? tCommon("loading") : t("declareSubmit")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setMessage(null);
          }}
        >
          {tCommon("cancel")}
        </Button>
      </div>

      <FormProblem>{message}</FormProblem>
    </form>
  );
}

/**
 * The refusals that belong to one input, and are therefore rendered *at* it
 * rather than at the foot of the form. Everything else — the empty
 * declaration, the rate limit, a drone that is not approved — is about the
 * submission as a whole.
 */
const FIELD_CODES = new Set(["declaration_kind_required", "module_serial_claimed"]);

/**
 * Every refusal `declareModuleAction` can return. An explicit list rather than
 * `t(`errors.${code}`)` on whatever arrives: a code with no key makes next-intl
 * print the key path itself as if it were a sentence.
 */
const KNOWN_CODES = new Set([
  "not_authenticated",
  "not_found",
  "not_approved",
  "declaration_kind_required",
  "declaration_empty",
  "declaration_too_long",
  "module_serial_claimed",
]);

function useRefusalText(locale: Locale) {
  const t = useTranslations("remoteId.card");
  const tErrors = useTranslations("errors");

  return (reasons: readonly Reason[]): string => {
    const rateLimited = reasons.find((r) => r.code === "rate_limited");
    if (rateLimited) {
      // Through `formatSeconds` before ICU sees it (thread 22).
      return tErrors("rateLimited", {
        duration: formatSeconds(
          Number(rateLimited.params?.retryAfterSeconds ?? 0),
          locale,
        ),
      });
    }
    const known = reasons.find((r) => KNOWN_CODES.has(r.code));
    return known ? t(`errors.${known.code}`) : tErrors("generic");
  };
}
