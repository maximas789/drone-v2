import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { AGE_FLAG_DAYS, ageInDays, isOverdue } from "@/lib/admin/queue";
import { formatDays } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * How long this submission has been waiting.
 *
 * **The age is the point of the queue.** A list of pending registrations
 * sorted oldest-first still tells a reviewer nothing about *how* old the top
 * one is, and "waiting eleven days" is the fact that changes what they do next.
 *
 * Over `AGE_FLAG_DAYS` it becomes a destructive badge with its own sentence
 * rather than merely a different colour — a colour alone is invisible to anyone
 * who cannot distinguish it, and this is the one signal on the row that is
 * supposed to interrupt.
 *
 * **`now` is a prop, not a `Date.now()` in the render.** A React render that
 * reads the clock is impure — `react-hooks/purity` says so — and the honest fix
 * is to read it where the query already happens rather than to silence the
 * rule. The page passes one instant to every row, so no two rows on the same
 * screen can disagree about what day it is.
 *
 * The day count goes through `formatDays`, which formats the unit via CLDR:
 * that is both the route around thread 22 (a bare number in an ICU message
 * renders Arabic-Indic digits) and around thread 23 (`i18n:check` reads a
 * plural branch body as a placeholder).
 */
export function AgeBadge({
  submittedAt,
  now,
  locale,
}: {
  submittedAt: Date | null;
  now: Date;
  locale: Locale;
}) {
  const t = useTranslations("review");
  const days = ageInDays(submittedAt, now);
  const overdue = isOverdue(submittedAt, now);

  if (days === 0) {
    return (
      <Badge variant="secondary">{t("waitingToday")}</Badge>
    );
  }

  return (
    <Badge variant={overdue ? "destructive" : "secondary"}>
      {overdue
        ? t("waitingOverdue", { duration: formatDays(days, locale) })
        : t("waiting", { duration: formatDays(days, locale) })}
    </Badge>
  );
}

/** The threshold, for the sentence that explains the flag once per page. */
export { AGE_FLAG_DAYS };
