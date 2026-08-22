import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * "By creating an account you agree to …", under the sign-up button.
 *
 * **A sentence, not a checkbox — and specifically not a pre-ticked one.** A
 * ticked box records a consent the person never gave: it is the interface
 * saying "yes" on their behalf and then keeping the receipt. An unticked box
 * would be honest but is the wrong instrument here, because these terms are not
 * optional — there is no account without them, so a control implying a choice
 * would be a second untruth. What the person is owed is the statement, in
 * front of them at the moment they act, with both documents one click away.
 *
 * `t.rich`, so the two links are **inside the sentence** rather than appended
 * to it. Arabic and English put the noun phrases in different places, and a
 * sentence assembled by concatenation can only be right in one of them — the
 * same reasoning that put `DOC_ANCHORS` in F26.
 */
export async function AcceptanceLine() {
  const t = await getTranslations("legal");

  return (
    <p className="text-muted-foreground text-sm">
      {t.rich("acceptance", {
        terms: (chunks) => (
          <Link href="/terms" className="underline underline-offset-4">
            {chunks}
          </Link>
        ),
        privacy: (chunks) => (
          <Link href="/privacy" className="underline underline-offset-4">
            {chunks}
          </Link>
        ),
      })}
    </p>
  );
}
