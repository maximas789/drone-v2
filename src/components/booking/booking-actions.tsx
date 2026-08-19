"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelBookingAction, checkInBookingAction } from "@/lib/actions/booking";
import { formatDateTime, formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { useRouter } from "@/i18n/navigation";

/**
 * The two things a pilot can do to a booking they already hold.
 *
 * **Both windows are computed on the server and passed in**, not decided here.
 * A browser clock three hours out would otherwise offer a check-in button
 * outside the slot and hide it inside one; the actions refuse either way, but a
 * control that appears and then refuses is worse than one that was never there.
 *
 * **The cancellation cutoff is an absolute time, not "two hours before".** A
 * pilot reading "you can cancel until 2 hours before" has to do arithmetic
 * about a slot they may be looking at in a different timezone's clock; a
 * printed instant is the answer to the question they are actually asking.
 */
export function BookingActions({
  bookingId,
  canCheckIn,
  canCancel,
  cancelCutoff,
  locale,
}: {
  bookingId: string;
  canCheckIn: boolean;
  canCancel: boolean;
  /** ISO. Shown whether or not cancelling is still possible. */
  cancelCutoff: string;
  locale: Locale;
}) {
  const t = useTranslations("bookings");
  const tErrors = useTranslations("errors");
  const router = useRouter();

  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; reasons?: { code: string; params?: Record<string, string | number> }[] }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setMessage(null);
        setConfirming(false);
        // The server owns the row; re-read it rather than guessing the new
        // state here and risking a screen that disagrees with the database.
        router.refresh();
        return;
      }
      const rateLimited = result.reasons?.find((r) => r.code === "rate_limited");
      setMessage(
        rateLimited
          ? tErrors("rateLimited", {
              duration: formatSeconds(
                Number(rateLimited.params?.retryAfterSeconds ?? 0),
                locale,
              ),
            })
          : t(`refusals.${result.reasons?.[0]?.code ?? "unknown"}` as never),
      );
    });
  }

  if (!canCheckIn && !canCancel) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("cancelClosed", { cutoff: formatDateTime(new Date(cancelCutoff), locale) })}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <p role="alert" className="text-destructive text-sm">
          {message}
        </p>
      ) : null}

      {canCheckIn ? (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            disabled={pending}
            onClick={() => run(() => checkInBookingAction(bookingId))}
          >
            {t("checkIn")}
          </Button>
          {/**
           * Said plainly, next to the button, because the consequence of *not*
           * pressing it is the part a pilot will not guess.
           */}
          <p className="text-muted-foreground text-sm">{t("checkInNote")}</p>
        </div>
      ) : null}

      {canCancel ? (
        <div className="flex flex-col gap-2">
          {confirming ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm">{t("cancelConfirm")}</span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() => run(() => cancelBookingAction(bookingId))}
              >
                {t("cancelYes")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirming(false)}
              >
                {t("cancelNo")}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirming(true)}
            >
              {t("cancelBooking")}
            </Button>
          )}
          <p className="text-muted-foreground text-sm">
            {t("cancelUntil", {
              cutoff: formatDateTime(new Date(cancelCutoff), locale),
            })}
          </p>
        </div>
      ) : null}
    </div>
  );
}
