"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { SlotTime } from "@/components/booking/slot-time";
import { ButtonLink } from "@/components/ui/button-link";
import { countdownParts, formatCountdown } from "@/lib/dashboard/countdown";
import type { Locale } from "@/lib/locale";

/**
 * The soonest approved flight, with a live countdown.
 *
 * **A client component for one reason: the countdown.** Everything else could
 * be server-rendered, but a number that says "in 3 hours" and never changes is
 * worse than no number — a pilot who leaves the tab open reads a stale answer
 * to the one question this card exists to answer.
 *
 * **It renders the server's value first and only then ticks.** Computing the
 * first value in the browser makes the server and client markup disagree, and
 * the fix for that is not `suppressHydrationWarning`: it is to render what the
 * server said and let the effect take over on the next minute.
 *
 * **The arithmetic lives in `@/lib/dashboard/countdown`, not here**, because the
 * dashboard is a Server Component and every export of a `"use client"` module
 * is a client reference — calling one during the server render throws at
 * request time. See that file.
 */

export function NextFlight({
  bookingId,
  zoneName,
  remoteIdCode,
  slotStart,
  slotEnd,
  initialCountdown,
  checkInOpensAt,
  locale,
}: {
  bookingId: string;
  zoneName: string;
  remoteIdCode: string | null;
  slotStart: string;
  slotEnd: string;
  /** Rendered on the first paint, formatted on the server's clock. */
  initialCountdown: string;
  /** ISO. The countdown becomes a check-in prompt from here on. */
  checkInOpensAt: string;
  locale: Locale;
}) {
  const t = useTranslations("dashboard");
  const [countdown, setCountdown] = useState(initialCountdown);
  const [checkInOpen, setCheckInOpen] = useState(false);

  useEffect(() => {
    const target = Date.parse(slotStart);
    const opensAt = Date.parse(checkInOpensAt);
    const ends = Date.parse(slotEnd);

    function tick() {
      const now = Date.now();
      setCheckInOpen(now >= opensAt && now <= ends);
      setCountdown(formatCountdown(countdownParts(target - now), locale, t));
    }

    tick();
    // A minute, not a second: the card answers "how long have I got", and a
    // seconds display would redraw sixty times a minute to say the same thing.
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [slotStart, slotEnd, checkInOpensAt, locale, t]);

  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-medium">{t("nextFlight")}</h2>
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {checkInOpen ? t("checkInOpen") : countdown}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xl font-medium">{zoneName}</p>
        <p className="text-muted-foreground">
          <SlotTime
            start={new Date(slotStart)}
            end={new Date(slotEnd)}
            locale={locale}
          />
        </p>
      </div>

      {remoteIdCode ? (
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-xs">{t("remoteId")}</span>
          <span dir="ltr" className="text-start font-mono text-lg">
            {remoteIdCode}
          </span>
        </div>
      ) : null}

      <ButtonLink href={`/bookings/${bookingId}`}>
        {checkInOpen ? t("goCheckIn") : t("viewFlight")}
      </ButtonLink>
    </section>
  );
}
