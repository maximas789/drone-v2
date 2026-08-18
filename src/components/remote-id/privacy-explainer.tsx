import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button-link";
import {
  PRIVACY_HIDDEN_ORDER,
  PRIVACY_SHOWN_ORDER,
} from "@/lib/remote-id/privacy-fields";

/**
 * What a stranger who scans this sticker actually learns — **before** the pilot
 * prints it and puts it on an airframe that flies over other people.
 *
 * The card is the moment to say this, because it is the moment the QR becomes
 * physical. A privacy notice buried in a legal page is one the person sticking
 * the label on never reads.
 *
 * **Every line here was cross-checked against F11's masking table**
 * (`.claude/plans/features/F11-remote-id-redaction.md`) and against the code
 * that implements it (`src/lib/remote-id/redact.ts`), not written from memory —
 * an explainer that is merely *approximately* right is a privacy promise the
 * app does not keep. The anonymous column of that table is exactly:
 *
 *   shown  — code, registration status, valid-until, build type, weight class,
 *            city of registration, whether a flight is authorised right now,
 *            and which Remote ID methods the aircraft broadcasts
 *   hidden — the nickname, manufacturer, model, serial number, photographs,
 *            owner name, mobile, national ID, *which* zone a flight is in,
 *            declared modules, booking history, and the scan log
 *
 * The two lists live in `src/lib/remote-id/privacy-fields.ts`, which maps each
 * field of the anonymous projection to the line the pilot reads — and
 * `privacy-fields.test.ts` holds that map against `redactRemoteId`'s **actual
 * output** in both directions. So F11 widening what a bystander sees now fails
 * a test instead of quietly making this page lie.
 */
export function PrivacyExplainer({ code }: { code: string }) {
  const t = useTranslations("remoteId.card");

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium">{t("privacyTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("privacyIntro")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("privacyShownTitle")}</h3>
          <ul className="text-muted-foreground flex flex-col gap-1 text-sm">
            {PRIVACY_SHOWN_ORDER.map((key) => (
              <li key={key} className="flex gap-2">
                <span aria-hidden>·</span>
                <span>{t(`privacyShown.${key}`)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("privacyHiddenTitle")}</h3>
          <ul className="text-muted-foreground flex flex-col gap-1 text-sm">
            {PRIVACY_HIDDEN_ORDER.map((key) => (
              <li key={key} className="flex gap-2">
                <span aria-hidden>·</span>
                <span>{t(`privacyHidden.${key}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/**
       * A reviewer *can* see the owner behind a code — and doing so writes an
       * audit event naming them and their stated reason. Saying so here is the
       * point: "nobody can ever see who you are" would be false, and the true
       * version is the more reassuring one anyway, because it describes a
       * mechanism rather than making a promise.
       */}
      <p className="text-muted-foreground text-sm">{t("privacyReviewer")}</p>

      <div className="flex flex-col items-start gap-2">
        <ButtonLink variant="outline" href={`/rid/${code}`}>
          {t("privacyOpenPublic")}
        </ButtonLink>
        <p className="text-muted-foreground text-xs">{t("privacyOpenPublicHint")}</p>
      </div>
    </section>
  );
}
