import { useTranslations } from "next-intl";

/**
 * Step 3: how this aircraft is identified in the air.
 *
 * **It states what the aircraft *gets*, never what it does not need.**
 * "No serial number required" is an absence, and an absence framed as a
 * concession reads as a fallback path with an apology attached. "Your aircraft
 * will be issued an Ajniha Remote ID — that is its registration identity" is a
 * statement about what it has. That difference is the whole product's posture,
 * which is why this pane exists at all rather than the wizard going straight
 * from specifications to photographs.
 *
 * **There is nothing to choose here yet, and the pane does not pretend
 * otherwise.** F18's spec puts "declare an existing Remote ID module" on this
 * step, but `remote_id_declaration.remoteIdId` is NOT NULL onto `remote_id`, and
 * F10 issues that row **only on approval** — so a draft has nothing to hang a
 * declaration on. Rather than loosen the schema for a form, the declaration
 * moves to F19's card, where a `remote_id` row exists by definition, and this
 * pane says plainly that it can be done after approval. A radio group with one
 * permanently selected option would be a choice that is not a choice.
 */
export function StepRemoteId() {
  const t = useTranslations("drones");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <h3 className="text-sm font-medium">{t("remoteIdAjnihaTitle")}</h3>
        <p className="text-muted-foreground text-sm">{t("remoteIdAjnihaBody")}</p>
      </div>

      <p className="text-muted-foreground border-s-2 ps-3 text-xs">
        {t("remoteIdDeclareLater")}
      </p>
    </div>
  );
}
