import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { docAnchorHref } from "@/lib/docs/slugs";
import { formatDate, formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * What a reviewer said, **verbatim**.
 *
 * The reason is rendered exactly as it was written and nowhere near a
 * catalogue: it is one person's sentence about one aircraft, and paraphrasing
 * it — or replacing it with a generic "your registration was not approved" —
 * would leave the pilot with nothing to act on. That is the failure this
 * component exists to prevent.
 *
 * It is rendered as **text inside a `<p>`**, never as markup. The string comes
 * from a reviewer typing into a form; React escapes it, and nothing here
 * reaches for `dangerouslySetInnerHTML`.
 *
 * `whitespace-pre-wrap` because a reviewer who wrote three numbered lines meant
 * three lines. Collapsing them into a paragraph is a quiet edit of somebody
 * else's decision.
 *
 * **A rejection is never a dead end.** The notice states the reason and the
 * caller puts the two actions that answer it — correct the details, resubmit —
 * directly beneath.
 *
 * **F26b adds the link to the documentation's common-reasons section**, below
 * the reviewer's own words and never in place of them: the reason is one
 * person's sentence about this aircraft, and the page is the general case. The
 * `href` comes from `docAnchorHref` rather than being written here, because the
 * fragment a heading derives from its own text differs between `ar` and `en` —
 * that section carries an explicit, language-independent id for this link.
 */
export function RejectionNotice({
  reason,
  decidedAt,
  rejectionCount,
  locale,
  children,
}: {
  reason: string | null;
  decidedAt: Date | null;
  /** Shown only from the second refusal onwards — see below. */
  rejectionCount: number;
  locale: Locale;
  children?: React.ReactNode;
}) {
  const t = useTranslations("drones");

  return (
    <section
      // `alert`, not a plain region: this is the answer to something the pilot
      // submitted and waited for, and it must be announced rather than found.
      role="alert"
      className="border-destructive flex flex-col gap-3 rounded-lg border p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-destructive text-sm font-medium">
          {t("rejectedTitle")}
        </h2>
        {decidedAt ? (
          <p className="text-muted-foreground text-xs">
            {t("rejectedOn", { date: formatDate(decidedAt, locale) })}
          </p>
        ) : null}
      </div>

      {reason ? (
        /**
         * **`dir="auto"`, and it is load-bearing.** A reviewer writes in
         * whichever language they think in, and the pilot may be reading the
         * page in the other one — so this is the one string on the page whose
         * direction is not the page's. Inherited LTR put the full stop of an
         * Arabic sentence at the *left-hand* end on `/en`: legible, but wrong,
         * and it is a regulator's words being mis-set. `auto` takes the
         * direction from the first strong character, which is the only rule
         * that is right for both. `text-start` then follows the resolved
         * direction rather than the page's.
         *
         * Found by opening the English page against an Arabic rejection.
         */
        <blockquote
          dir="auto"
          className="border-s-2 ps-3 text-start text-sm whitespace-pre-wrap"
        >
          {reason}
        </blockquote>
      ) : (
        /**
         * `rejectDrone` requires a written reason, so this should be
         * unreachable — but the column is nullable and `resubmitDrone` clears
         * it on the way back into the queue. If a row ever arrives here without
         * one, saying so is better than rendering an empty quote that reads as
         * a reviewer who said nothing.
         */
        <p className="text-muted-foreground text-sm">{t("rejectedNoReason")}</p>
      )}

      {/**
       * The count appears from the **second** rejection onwards. On the first,
       * "attempt 1" is noise; on the third it is the thing the pilot needs to
       * know before they resubmit unchanged.
       */}
      {rejectionCount >= 1 ? (
        <p className="text-muted-foreground text-xs">
          {t("rejectionCount", {
            count: formatNumber(rejectionCount + 1, locale),
          })}
        </p>
      ) : null}

      <p className="text-sm">{t("rejectedNext")}</p>

      <p className="text-sm">
        <Link
          href={docAnchorHref("rejectionReasons")}
          className="text-primary underline underline-offset-4"
        >
          {t("rejectedCommonReasons")}
        </Link>
      </p>

      {children}
    </section>
  );
}
