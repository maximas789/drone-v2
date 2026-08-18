"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { FormProblem } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import {
  deleteDroneAction,
  renewDroneAction,
  resubmitDroneAction,
  submitDroneAction,
} from "@/lib/actions/drone";
import type { Reason } from "@/lib/actions/result";
import { formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * The three things a pilot can do to their own registration, and the one thing
 * they can undo.
 *
 * One component rather than four, because all four are the same shape: post an
 * action, translate whatever comes back, refresh. Four copies would be four
 * places for the refusal handling to be slightly different, and the refusal is
 * the part that matters — every one of these actions can say no.
 *
 * **Every refusal is rendered.** These actions re-check the status server-side,
 * so a stale page really can post `submit` at a drone that a reviewer has
 * already decided, and answering that with a silent no-op would look like a
 * broken button.
 */

type Kind = "submit" | "resubmit" | "renew";

export function DroneAction({
  droneId,
  kind,
  locale,
  variant = "default",
}: {
  droneId: string;
  kind: Kind;
  locale: Locale;
  variant?: "default" | "outline";
}) {
  const t = useTranslations("drones");
  const refusalText = useRefusalText(locale);
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  /**
   * **The one refusal whose fix is not on this page.** F18 says a refusal
   * carries a link to the thing that answers it, never a bare sentence — and
   * "complete your profile" with nothing to press leaves the pilot to go and
   * find the page themselves. `?next=` brings them back to this aircraft
   * afterwards, which is F17's own return journey.
   *
   * Found by pressing Renew with an empty profile and reading the result.
   */
  const [needsProfile, setNeedsProfile] = useState(false);
  const [pending, startTransition] = useTransition();

  const label = {
    submit: t("submitForReview"),
    resubmit: t("resubmit"),
    renew: t("renew"),
  }[kind];

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant={variant}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            setNeedsProfile(false);
            const result =
              kind === "submit"
                ? await submitDroneAction(droneId)
                : kind === "resubmit"
                  ? await resubmitDroneAction(droneId)
                  : await renewDroneAction(droneId);

            if (!result.ok) {
              setMessage(refusalText(result.reasons));
              setNeedsProfile(
                result.reasons.some((r) => r.code === "profile_incomplete"),
              );
              return;
            }
            router.refresh();
          })
        }
      >
        {pending ? t("submitting") : label}
      </Button>
      <FormProblem>{message}</FormProblem>
      {needsProfile ? (
        <Link
          href={`/profile/complete?next=${encodeURIComponent(`/drones/${droneId}`)}`}
          className="text-sm underline"
        >
          {t("completeProfileLink")}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Delete, in two presses.
 *
 * **Not `window.confirm`.** A native confirm speaks the *browser's* language,
 * not the app's — the same class of defect as `<input type="date">` in F17,
 * where Chrome rendered Arabic-Indic digits into an identity record and ignored
 * `lang` everywhere it was set. It also blocks the page entirely while it is
 * open. The confirmation is therefore ordinary markup: it is bilingual because
 * the catalogue is, and it says what will be destroyed rather than asking "are
 * you sure?" about an unnamed thing.
 */
export function DeleteDroneButton({
  droneId,
  nickname,
  locale,
}: {
  droneId: string;
  nickname: string;
  locale: Locale;
}) {
  const t = useTranslations("drones");
  const tCommon = useTranslations("common");
  const refusalText = useRefusalText(locale);
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setMessage(null);
            setConfirming(true);
          }}
        >
          {tCommon("delete")}
        </Button>
        <FormProblem>{message}</FormProblem>
      </div>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-label={t("deleteTitle")}
      /**
       * **`w-full`, so the confirmation takes a line of its own.** Without it
       * the panel stays a flex item in the row it replaced the Delete button
       * in, and it renders wedged between Continue and Submit — a destructive
       * confirmation squeezed in beside two ordinary buttons, at whatever width
       * is left over. Found by pressing Delete and looking at it.
       */
      className="border-destructive flex w-full flex-col gap-3 rounded-lg border p-4"
    >
      <p className="text-sm">{t("deleteConfirm", { nickname })}</p>
      <p className="text-muted-foreground text-xs">{t("deleteIrreversible")}</p>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteDroneAction(droneId);
              if (!result.ok) {
                setConfirming(false);
                setMessage(refusalText(result.reasons));
                return;
              }
              /**
               * `refresh` before `push`: the list is a server render and the
               * deleted aircraft would otherwise still be on it when the pilot
               * arrives, which reads as the delete having failed.
               */
              router.refresh();
              router.push("/drones");
            })
          }
        >
          {pending ? tCommon("loading") : t("deleteConfirmAction")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          {tCommon("cancel")}
        </Button>
      </div>

      <FormProblem>{message}</FormProblem>
    </div>
  );
}

/**
 * Every refusal these four actions can return, so a code is only rendered when
 * the catalogue is known to hold it.
 *
 * An explicit list rather than `t(\`errors.${code}\`)` on whatever arrives: a
 * code with no key makes next-intl emit the key path itself, so the pilot would
 * be shown `drones.errors.something` as if it were a sentence. `i18n:check`
 * cannot catch that — it compares the two catalogues to each other, and a key
 * missing from both is missing consistently.
 */
const KNOWN_CODES = new Set([
  "not_authenticated",
  "not_found",
  "not_editable",
  "not_deletable",
  "already_applied",
  "invalid_transition",
  "profile_incomplete",
  "photo_required",
  "serial_required",
]);

/**
 * A refusal, as a sentence.
 *
 * The codes are the server's own, so the same refusal reads correctly in both
 * languages and a caller could branch on it instead.
 */
function useRefusalText(locale: Locale) {
  const t = useTranslations("drones");
  const tErrors = useTranslations("errors");

  return (reasons: readonly Reason[]): string => {
    const rateLimited = reasons.find((r) => r.code === "rate_limited");
    if (rateLimited) {
      // The countdown goes through `formatSeconds` before ICU sees it — a bare
      // number reaching a message renders `٤٥` under `ar` (thread 22).
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
