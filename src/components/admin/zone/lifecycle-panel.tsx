"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  archiveZoneAction,
  publishZoneAction,
  suspendZoneAction,
} from "@/lib/actions/admin";
import type { Reason } from "@/lib/actions/result";
import { useRouter } from "@/i18n/navigation";
import { formatDateTime, formatNumber, formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import type { PublishProblem } from "@/lib/validation/zone-publish";

/**
 * **Publish, suspend, archive** — and the impact of each, before it happens.
 *
 * The panel shows what is missing rather than a greyed button with nothing
 * beside it: an admin who cannot publish should be told *which* of the five
 * conditions is unmet, because four of them are things they can fix in a
 * minute and the fifth (an overlap with a published no-fly zone) is a boundary
 * they have to go and move.
 *
 * **Suspension names the flights it will cancel.** "This will cancel 3
 * bookings" is a number somebody accepts without thinking; three people's names
 * beside three times is a decision. The reason is required in both languages
 * because it is quoted verbatim to each pilot in theirs.
 *
 * Every button here calls a server action that re-checks the session, the role
 * and the rule for itself. Nothing on this screen is the security boundary.
 */

export type ImpactRow = {
  bookingId: string;
  pilotName: string;
  droneNickname: string | null;
  slotStart: string;
  slotEnd: string;
  status: string;
};

export function LifecyclePanel({
  zoneId,
  status,
  publishedAt,
  readiness,
  overlappingNoFly,
  impact,
  locale,
}: {
  zoneId: string;
  status: string;
  publishedAt: string | null;
  /** Empty when the zone is fit to publish. */
  readiness: readonly PublishProblem[];
  overlappingNoFly: readonly string[];
  impact: readonly ImpactRow[];
  locale: Locale;
}) {
  const t = useTranslations("zoneAdmin");
  const tErrors = useTranslations("errors");
  const tBookings = useTranslations("bookings");
  const router = useRouter();
  const fieldId = useId();

  const [reasons, setReasons] = useState<Reason[]>([]);
  const [confirming, setConfirming] = useState<"suspend" | "archive" | null>(
    null,
  );
  const [reasonAr, setReasonAr] = useState("");
  const [reasonEn, setReasonEn] = useState("");
  /**
   * Set when the suspension committed but its cancellation fan-out could not be
   * queued. Not an error — the zone *is* suspended — but the pilots holding
   * slots in it have not been told, and somebody has to know that.
   */
  const [fanOutFailed, setFanOutFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const canPublish = status !== "active" && status !== "archived";
  const ready = readiness.length === 0;

  function run(
    action: () => Promise<{
      ok: boolean;
      reasons?: Reason[];
      data?: { status: string; fanOutQueued?: boolean };
    }>,
  ) {
    startTransition(async () => {
      setReasons([]);
      setFanOutFailed(false);
      const result = await action();
      if (!result.ok) {
        setReasons(result.reasons ?? []);
        return;
      }
      if (result.data?.fanOutQueued === false) setFanOutFailed(true);
      setConfirming(null);
      setReasonAr("");
      setReasonEn("");
      router.refresh();
    });
  }

  function messageFor(reason: Reason): string {
    if (reason.code === "rate_limited") {
      return tErrors("rateLimited", {
        duration: formatSeconds(
          Number(reason.params?.retryAfterSeconds ?? 0),
          locale,
        ),
      });
    }
    return t.has(`problems.${reason.code}`)
      ? t(`problems.${reason.code}`, stringParams(reason.params))
      : tErrors("generic");
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{t("lifecycleHeading")}</h2>
        <p className="text-muted-foreground text-sm">{t("lifecycleIntro")}</p>
        {/*
          **A static map, not a key built from the status.** The first version
          interpolated — `status${capitalise(status)}Notice` — and printed
          `zoneAdmin.statusActiveNotice` on the page the moment a zone went
          live, because that one key had not been written. Every static check
          was green; thread 60's shape, found by publishing a zone and looking.
          A `Record` makes the missing case a type error instead.
        */}
        <p className="text-muted-foreground text-sm">
          {t(
            STATUS_NOTICE[status as keyof typeof STATUS_NOTICE] ??
              "lifecycleIntro",
          )}
        </p>
        {publishedAt ? (
          <p className="text-muted-foreground text-xs">
            <bdi>
              {t("publishedAt", {
                date: formatDateTime(new Date(publishedAt), locale),
              })}
            </bdi>
          </p>
        ) : null}
      </div>

      {/* --- What is standing in the way, named ----------------------------- */}
      {canPublish ? (
        ready ? (
          <p className="text-sm">{t("publishReady")}</p>
        ) : (
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-medium">{t("publishBlocked")}</p>
            <ul className="ms-4 list-disc">
              {readiness.map((code) => (
                <li key={code}>
                  {t(`problems.${code}`, {
                    zones: overlappingNoFly.join("، "),
                  })}
                </li>
              ))}
            </ul>
          </div>
        )
      ) : null}

      {/* --- Whose flights this touches ------------------------------------- */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t("impactHeading")}</h3>
        {impact.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("impactNone")}</p>
        ) : (
          <>
            <p className="text-sm">
              {t("impactCount", { count: formatNumber(impact.length, locale) })}
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[30rem] border-collapse text-sm">
                <caption className="sr-only">{t("impactHeading")}</caption>
                <thead className="bg-muted/50">
                  <tr>
                    <th scope="col" className="p-2 text-start font-medium">
                      {t("colPilot")}
                    </th>
                    <th scope="col" className="p-2 text-start font-medium">
                      {t("colWhen")}
                    </th>
                    <th scope="col" className="p-2 text-start font-medium">
                      {t("colBookingStatus")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {impact.map((row) => (
                    <tr key={row.bookingId} className="border-t">
                      <td className="p-2 text-start">
                        {row.pilotName}
                        {row.droneNickname ? (
                          <span className="text-muted-foreground block text-xs">
                            {row.droneNickname}
                          </span>
                        ) : null}
                      </td>
                      <td className="p-2 text-start">
                        <bdi>
                          {formatDateTime(new Date(row.slotStart), locale)}
                        </bdi>
                      </td>
                      <td className="p-2 text-start">
                        <Badge variant="outline">
                          {tBookings.has(`status${capitalise(row.status)}`)
                            ? tBookings(
                                `status${capitalise(row.status)}` as "statusPending",
                              )
                            : row.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {fanOutFailed ? (
        <p className="border-destructive rounded-lg border border-s-4 p-3 text-sm">
          {t("fanOutFailed")}
        </p>
      ) : null}

      {reasons.length > 0 ? (
        <div className="border-destructive flex flex-col gap-1 rounded-lg border border-s-4 p-3 text-sm">
          {reasons.map((reason, index) => (
            <p key={`${reason.code}-${index}`}>{messageFor(reason)}</p>
          ))}
        </div>
      ) : null}

      {/* --- The two confirmations ------------------------------------------ */}
      {confirming === "suspend" ? (
        <div className="flex flex-col gap-3 rounded-lg border border-s-4 p-3">
          <h3 className="font-medium">{t("suspendHeading")}</h3>
          <p className="text-sm">{t("suspendIntro")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-ar`}>{t("suspendReasonAr")}</Label>
              <textarea
                id={`${fieldId}-ar`}
                dir="rtl"
                lang="ar"
                rows={3}
                maxLength={2000}
                value={reasonAr}
                onChange={(event) => setReasonAr(event.target.value)}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent p-2.5 text-base outline-none focus-visible:ring-3 md:text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${fieldId}-en`}>{t("suspendReasonEn")}</Label>
              <textarea
                id={`${fieldId}-en`}
                dir="ltr"
                lang="en"
                rows={3}
                maxLength={2000}
                value={reasonEn}
                onChange={(event) => setReasonEn(event.target.value)}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent p-2.5 text-base outline-none focus-visible:ring-3 md:text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={
                pending ||
                reasonAr.trim().length < 20 ||
                reasonEn.trim().length < 20
              }
              onClick={() =>
                run(() => suspendZoneAction(zoneId, reasonAr, reasonEn))
              }
            >
              {t("suspendConfirm")}
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
      ) : confirming === "archive" ? (
        <div className="flex flex-col gap-3 rounded-lg border border-s-4 p-3">
          <p className="text-sm">{t("archiveIntro")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => archiveZoneAction(zoneId))}
            >
              {t("archive")}
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
          {canPublish ? (
            <Button
              type="button"
              disabled={pending || !ready}
              onClick={() => run(() => publishZoneAction(zoneId))}
            >
              {status === "suspended" ? t("republish") : t("publish")}
            </Button>
          ) : null}
          {status === "active" ? (
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => setConfirming("suspend")}
            >
              {t("suspend")}
            </Button>
          ) : null}
          {status !== "archived" ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirming("archive")}
            >
              {t("archive")}
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}

/** Every zone status, and the sentence that explains it to an admin. */
const STATUS_NOTICE = {
  draft: "statusDraftNotice",
  active: "statusActiveNotice",
  suspended: "statusSuspendedNotice",
  archived: "statusArchivedNotice",
} as const;

function capitalise(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/** Thread 22: anything numeric reaching a message arrives as a string. */
function stringParams(
  params: Record<string, string | number> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params ?? {})) out[key] = String(value);
  return out;
}
