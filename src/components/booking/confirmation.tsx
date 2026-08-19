"use client";

import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button-link";

/**
 * What just happened, and what happens next.
 *
 * **The two outcomes are worded differently, not badged differently.** An
 * `approved` booking is an authorisation; a `pending` one is a request waiting
 * on a human. Rendering both as "booked" with a coloured chip beside it is how
 * a pilot ends up standing in a field believing they have permission they do
 * not have.
 *
 * `role="status"` rather than `alert`: this is the result of something the
 * pilot did on purpose, not an interruption.
 */
export function BookingConfirmation({
  bookingId,
  approved,
}: {
  bookingId: string;
  approved: boolean;
}) {
  const t = useTranslations("booking");

  return (
    <section
      role="status"
      className="bg-card flex flex-col gap-4 rounded-lg border p-5"
    >
      <h2 className="text-lg font-medium">
        {approved ? t("confirmedTitle") : t("requestedTitle")}
      </h2>
      <p className="text-muted-foreground text-sm">
        {approved ? t("confirmedBody") : t("requestedBody")}
      </p>

      <div className="flex flex-wrap gap-3">
        <ButtonLink href={`/bookings/${bookingId}`}>
          {t("viewBooking")}
        </ButtonLink>
        <ButtonLink variant="outline" href="/zones">
          {t("backToMap")}
        </ButtonLink>
      </div>
    </section>
  );
}
