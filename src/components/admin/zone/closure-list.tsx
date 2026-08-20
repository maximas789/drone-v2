"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { ImpactTable, type ImpactRow } from "@/components/admin/zone/impact-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import {
  publishZoneClosureAction,
  withdrawZoneClosureAction,
} from "@/lib/actions/admin";
import type { Reason } from "@/lib/actions/result";
import { formatDateTime, formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * The closures on a zone, and the button that puts one into force.
 *
 * **Publishing is the consequential act, so the confirmation carries the
 * names.** The list beside an unpublished closure is computed on the server
 * from the row as stored, by the same half-open predicate the fan-out uses — so
 * an admin confirms against the list the job will act on, not a resemblance of
 * it. A count would be a number somebody accepts; a person's name and the time
 * of their flight is a decision.
 *
 * **A published closure offers no delete.** Publishing cancels flights and
 * emails pilots; deleting the row afterwards would reopen the airspace while
 * leaving every cancellation standing and erasing the only record of why they
 * happened. The refusal is in `withdrawZoneClosure`, and this simply does not
 * draw a control for it.
 */

export type ClosureRow = {
  id: string;
  startsAt: string;
  endsAt: string;
  reasonAr: string;
  reasonEn: string;
  authorityRef: string | null;
  publishedAt: string | null;
  /** Live bookings the window covers — server-computed, unpublished rows only. */
  impact: ImpactRow[];
  /** Ids of other closures on this zone whose window overlaps this one. */
  overlaps: string[];
};

export function ClosureList({
  closures,
  locale,
  now,
}: {
  closures: readonly ClosureRow[];
  locale: Locale;
  /** Rendered on the server so "in force" and "over" do not flip on hydration. */
  now: string;
}) {
  const t = useTranslations("zoneAdmin");
  const tErrors = useTranslations("errors");
  const router = useRouter();

  const [reasons, setReasons] = useState<Reason[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [fanOutFailed, setFanOutFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  /**
   * Both controls answer the same shape, and only one of them carries
   * `fanOutQueued` — so the parameter is the union rather than a widened object
   * literal, which would make a result with a *different* `data` unassignable.
   */
  function run(
    action: () => Promise<
      | { ok: true; data: { fanOutQueued?: boolean } | Record<string, unknown> }
      | { ok: false; reasons: Reason[] }
    >,
  ) {
    startTransition(async () => {
      setReasons([]);
      setFanOutFailed(false);
      const result = await action();
      if (!result.ok) {
        setReasons(result.reasons);
        return;
      }
      if (result.data.fanOutQueued === false) setFanOutFailed(true);
      setConfirming(null);
      router.refresh();
    });
  }

  const at = new Date(now).getTime();

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{t("closuresHeading")}</h2>
        <p className="text-muted-foreground text-sm">{t("closuresIntro")}</p>
      </div>

      {fanOutFailed ? (
        <p className="border-destructive rounded-lg border border-s-4 p-3 text-sm">
          {t("closureFanOutFailed")}
        </p>
      ) : null}

      {reasons.length > 0 ? (
        <div className="border-destructive flex flex-col gap-1 rounded-lg border border-s-4 p-3 text-sm">
          {reasons.map((reason, index) => (
            <p key={`${reason.code}-${index}`}>
              {reason.code === "rate_limited"
                ? tErrors("rateLimited", {
                    duration: formatSeconds(
                      Number(reason.params?.retryAfterSeconds ?? 0),
                      locale,
                    ),
                  })
                : t.has(`problems.${reason.code}`)
                  ? t(`problems.${reason.code}`, { min: "20" })
                  : tErrors("generic")}
            </p>
          ))}
        </div>
      ) : null}

      {closures.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("closuresNone")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {closures.map((row) => {
            const state = stateOf(row, at);
            return (
              <li key={row.id} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium">
                    <bdi>
                      {t("closureWindow", {
                        start: formatDateTime(new Date(row.startsAt), locale),
                        end: formatDateTime(new Date(row.endsAt), locale),
                      })}
                    </bdi>
                  </p>
                  <Badge variant={state === "inForce" ? "default" : "secondary"}>
                    {t(CLOSURE_STATE_LABEL[state])}
                  </Badge>
                </div>

                {/*
                  The reason is shown in the page's language, because that is
                  the language the reader is in — but both were written, and the
                  pilot receives theirs.
                */}
                <p className="text-sm">
                  {locale === "ar" ? row.reasonAr : row.reasonEn}
                </p>
                {row.authorityRef ? (
                  <p className="text-muted-foreground text-xs">
                    {t("closureAuthorityRefValue", { ref: row.authorityRef })}
                  </p>
                ) : null}

                {row.publishedAt ? (
                  <p className="text-muted-foreground text-xs">
                    <bdi>
                      {t("closurePublishedAt", {
                        date: formatDateTime(new Date(row.publishedAt), locale),
                      })}
                    </bdi>
                  </p>
                ) : null}

                {row.overlaps.length > 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {t("closureOverlapsNotice")}
                  </p>
                ) : null}

                {/* --- Unpublished: the preview, then the two controls -------- */}
                {row.publishedAt ? null : confirming === row.id ? (
                  <div className="flex flex-col gap-2 border-s-4 ps-3">
                    <h3 className="text-sm font-medium">
                      {t("closurePublishHeading")}
                    </h3>
                    <p className="text-sm">{t("closurePublishIntro")}</p>
                    <ImpactTable
                      rows={row.impact}
                      locale={locale}
                      emptyLabel={t("closurePreviewNone")}
                      countLabel={(count, n) => t("closureCancelCount", { count, n })}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={pending}
                        onClick={() =>
                          run(() => publishZoneClosureAction(row.id))
                        }
                      >
                        {t("closurePublishConfirm")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setConfirming(null)}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={pending}
                      onClick={() => setConfirming(row.id)}
                    >
                      {t("closurePublish")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => run(() => withdrawZoneClosureAction(row.id))}
                    >
                      {t("closureWithdraw")}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type ClosureState = "draft" | "scheduled" | "inForce" | "over";

/**
 * Four states, and none of them is a column.
 *
 * `published_at` says whether the engine reads this row at all; the window
 * itself says whether it is refusing anything *now*. Storing a status beside
 * them would be a third opinion that goes stale on its own without anybody
 * writing to it, which is precisely how a closure that ended last week keeps
 * claiming to be in force.
 */
function stateOf(
  row: { publishedAt: string | null; startsAt: string; endsAt: string },
  at: number,
): ClosureState {
  if (!row.publishedAt) return "draft";
  if (new Date(row.endsAt).getTime() <= at) return "over";
  if (new Date(row.startsAt).getTime() > at) return "scheduled";
  return "inForce";
}

const CLOSURE_STATE_LABEL = {
  draft: "closureStateDraft",
  scheduled: "closureStateScheduled",
  inForce: "closureStateInForce",
  over: "closureStateOver",
} as const;
