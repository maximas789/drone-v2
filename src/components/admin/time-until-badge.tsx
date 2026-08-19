import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { isUrgent, urgencyBucketOf } from "@/lib/admin/urgency";
import { countdownParts, formatCountdown } from "@/lib/dashboard/countdown";
import type { Locale } from "@/lib/locale";

/**
 * How long until this flight — the booking queue's answer to `AgeBadge`.
 *
 * **The mirror of the drone queue, and the mirror is the point.** A
 * registration matters by how long it has waited; a booking matters by how soon
 * it happens. A queue that showed only "requested 3 days ago" would sort a
 * flight this afternoon below one next month.
 *
 * **The countdown is `src/lib/dashboard/countdown.ts`, not a second
 * implementation.** The pilot's dashboard counts down to the same slot with the
 * same two functions, so the reviewer and the pilot cannot be shown different
 * numbers of hours for the same flight. That module is a plain one for thread
 * 59's reason — the dashboard's client component and this server component both
 * call it.
 *
 * **A slot already in the past is a destructive badge, not a hidden row.**
 * Nothing sweeps an undecided booking when its window closes, so a `past` row
 * here is the queue reporting its own failure to answer in time. Hiding it
 * would hide exactly the thing a regulator should see.
 *
 * `now` is a prop for `AgeBadge`'s reason: a render that reads the clock is
 * impure, and one instant per page means no two rows disagree.
 */
export function TimeUntilBadge({
  slotStart,
  now,
  locale,
}: {
  slotStart: Date;
  now: Date;
  locale: Locale;
}) {
  const t = useTranslations("review");
  const tDashboard = useTranslations("dashboard");

  if (urgencyBucketOf(slotStart, now) === "past") {
    return <Badge variant="destructive">{t("startsPast")}</Badge>;
  }

  return (
    <Badge variant={isUrgent(slotStart, now) ? "destructive" : "secondary"}>
      {formatCountdown(
        countdownParts(slotStart.getTime() - now.getTime()),
        locale,
        tDashboard,
      )}
    </Badge>
  );
}
