import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { NO_SHOW_LIMIT } from "@/lib/data/pilot";
import type { PilotHistory as History } from "@/lib/data/review";
import { formatDate, formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * What this pilot has done before.
 *
 * A reviewer deciding one registration is deciding about a person, and the
 * question that actually changes the decision is "has this been refused before,
 * and what for". So **prior rejections carry their reasons**: a count alone
 * makes a pilot refused twice for blurry photographs look identical to one
 * refused twice for misdeclaring a weight, and those are not the same person.
 *
 * The no-show count is flagged at `NO_SHOW_LIMIT`, imported rather than
 * restated — it is the same threshold `autoApproveEligible` uses to take a
 * pilot off the fast path, and a panel that flagged at a different number would
 * be telling the reviewer something the system does not act on.
 */
export function PilotHistoryPanel({
  history,
  locale,
}: {
  history: History;
  locale: Locale;
}) {
  const t = useTranslations("review");
  const noShowFlagged = history.noShows >= NO_SHOW_LIMIT;

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <h2 className="font-medium">{t("historyTitle")}</h2>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={t("historyDrones")}
          value={formatNumber(history.dronesTotal, locale)}
        />
        <Stat
          label={t("historyApproved")}
          value={formatNumber(history.dronesApproved, locale)}
        />
        <Stat
          label={t("historyBookings")}
          value={formatNumber(history.bookingsTotal, locale)}
        />
        <Stat
          label={t("historyNoShows")}
          value={formatNumber(history.noShows, locale)}
          flagged={noShowFlagged}
        />
      </dl>

      {noShowFlagged ? (
        <p className="text-destructive text-xs">{t("historyNoShowFlag")}</p>
      ) : null}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t("historyRejections")}</h3>
        {history.rejections.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("historyNoRejections")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {history.rejections.map((rejection) => (
              <li
                key={rejection.droneId}
                className="border-s-2 ps-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{rejection.nickname}</span>
                  {rejection.decidedAt ? (
                    <span className="text-muted-foreground text-xs">
                      {formatDate(rejection.decidedAt, locale)}
                    </span>
                  ) : null}
                </div>
                {/*
                  The pilot's own refusal text, quoted exactly as it was
                  written and as they received it. `whitespace-pre-wrap` so a
                  reviewer who wrote three short lines is not flattened into
                  one.
                */}
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {rejection.reason ?? t("historyNoReasonRecorded")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  flagged = false,
}: {
  label: string;
  value: string;
  flagged?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd>
        {flagged ? (
          <Badge variant="destructive">{value}</Badge>
        ) : (
          <span className="text-lg font-medium tabular-nums">{value}</span>
        )}
      </dd>
    </div>
  );
}
