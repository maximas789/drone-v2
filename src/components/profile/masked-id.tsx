import { useTranslations } from "next-intl";
import { maskIdDocument } from "@/lib/remote-id/redact";

/**
 * An identity document number, as it appears **everywhere in this app**.
 *
 * `maskIdDocument` is F11's function and the only projection that exists — F11's
 * whole grep criterion was that there is exactly one. This component does not
 * mask; it *renders* the mask, so a second surface cannot quietly grow a second
 * rule about how many digits a person may see.
 *
 * **The owner sees the mask too.** That is not a courtesy to the owner, it is
 * the property that makes the criterion checkable: if there is no branch that
 * ever renders the whole number, then no screen can display one, and the only
 * path to the full value is `revealIdentityAction` — which writes the audit
 * event before it returns anything.
 *
 * `dir="ltr"` on the value: the bullets and the digits are a single left-to-right
 * token. Left to an RTL paragraph the browser reorders them and the last four
 * digits land on the wrong side of the bullets, which reads as a different
 * number.
 */
export function MaskedId({
  number,
  documentType,
}: {
  number: string | null;
  documentType: string | null;
}) {
  const t = useTranslations("profile");
  const masked = maskIdDocument(number);
  if (!masked) return null;

  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{t("maskedIdLabel")}</dt>
      <dd className="flex flex-wrap items-baseline gap-2">
        <span dir="ltr" className="font-mono text-sm">
          {masked}
        </span>
        {documentType ? (
          <span className="text-muted-foreground text-xs">
            {t(`idType.${documentType}`)}
          </span>
        ) : null}
      </dd>
      <p className="text-muted-foreground text-xs">{t("maskedIdHint")}</p>
    </div>
  );
}
