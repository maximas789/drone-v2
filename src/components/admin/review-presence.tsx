"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { touchPresenceAction } from "@/lib/actions/review";
import { formatList } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * "Somebody else has this open" — F22's **soft lock**, and the emphasis is on
 * soft.
 *
 * **It grants nothing and blocks nothing.** What stops two reviewers writing
 * two decisions over each other is `applyTransition`'s `select … for update`
 * and the `already_applied` the second one gets back; both decision panels
 * already refresh on that refusal so the loser sees what actually happened. All
 * this does is make the collision rare by showing the first reviewer's name to
 * the second *before* either starts typing.
 *
 * A hard lock was considered and rejected: a closed laptop sends no unlock, so
 * every implementation ends up either leaking locks or stealing them, and both
 * failure modes are worse than two people occasionally meeting on one record.
 *
 * **The heartbeat is a `setInterval`, not a `useEffect` per render.** It pings
 * on mount and every `PING_MS` after, and clears on unmount. A ping is rate
 * limited under its own bucket (`review.presence`), so a throttled one simply
 * does not update the line — it never surfaces an error, because "we could not
 * ask just now" is not something a reviewer can act on.
 */

/** Comfortably inside the row's 90-second TTL, so a live viewer never blinks out. */
const PING_MS = 30_000;

export function ReviewPresence({
  entityType,
  entityId,
  locale,
}: {
  entityType: "drone" | "booking" | "pilot_profile";
  entityId: string;
  locale: Locale;
}) {
  const t = useTranslations("review");
  const [viewers, setViewers] = useState<
    Array<{ userId: string; name: string | null }>
  >([]);

  useEffect(() => {
    let cancelled = false;

    async function ping() {
      const result = await touchPresenceAction(entityType, entityId);
      // Refused (rate limited, or the session ended): leave the last answer
      // on screen rather than claiming the record is suddenly unattended.
      if (cancelled || !result.ok) return;
      setViewers(result.data.viewers);
    }

    void ping();
    const timer = setInterval(() => void ping(), PING_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [entityType, entityId]);

  if (viewers.length === 0) return null;

  return (
    <p
      /*
        `polite`, not `assertive`: a colleague opening the same record is worth
        knowing and is never worth interrupting somebody mid-sentence for.
      */
      aria-live="polite"
      className="border-s-2 border-amber-500 ps-3 text-sm"
    >
      {t("viewedBy", {
        /*
          Through `formatList`, not `join(", ")`: Arabic separates with `،`
          and takes a conjunction before the last name, and rule 6 keeps every
          `Intl` call in `format.ts` where the forced locale tag lives.
        */
        names: formatList(
          viewers.map((viewer) => viewer.name?.trim() || t("viewerUnknown")),
          locale,
        ),
      })}
    </p>
  );
}
