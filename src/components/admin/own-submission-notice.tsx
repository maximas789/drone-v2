import { useTranslations } from "next-intl";

/**
 * The four-eyes explanation, shown **in place of** the decision controls.
 *
 * A greyed-out button with no sentence beside it is a screen that looks broken;
 * a reviewer who owns the record needs to know that the app is working exactly
 * as intended and that somebody else has to decide. So the panel is replaced,
 * not disabled — there is nothing here to press, and nothing here that looks
 * pressable.
 *
 * **It says the server refuses too.** That sentence is not decoration: it is
 * the difference between a rule and a suggestion, and a reader who wonders
 * whether the block is only in the markup deserves the answer without having to
 * try it. `isOwnSubmission` is checked inside `src/lib/workflow/`, before the
 * transition, so a self-approval POSTed straight at the action writes nothing —
 * not even an audit event.
 */
export function OwnSubmissionNotice() {
  const t = useTranslations("review");

  return (
    <div
      className="border-s-4 flex flex-col gap-2 rounded-lg border p-4"
      role="note"
    >
      <h2 className="font-medium">{t("ownSubmissionTitle")}</h2>
      <p className="text-muted-foreground text-sm">{t("ownSubmissionBody")}</p>
    </div>
  );
}
