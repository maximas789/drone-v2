"use client";

import { useState } from "react";
import type { Locale } from "@/lib/locale";
import { BookingConfirmation } from "./confirmation";
import {
  BookingWizard,
  type BookableZone,
  type BookingPrefill,
} from "./wizard";
import type { BookableDrone } from "./drone-select";

/**
 * The wizard and its outcome, which is one screen with two states rather than
 * a redirect.
 *
 * **No `router.push` on success.** The seat is claimed and the answer is on
 * screen; navigating away from it would mean a pilot on a slow connection sees
 * a spinner where the confirmation should be, and a failed navigation would
 * lose the only thing telling them whether they are authorised or waiting. The
 * links out are offered, not taken on their behalf.
 */
export function NewBooking({
  zones,
  drones,
  prefill,
  locale,
}: {
  zones: readonly BookableZone[];
  drones: readonly BookableDrone[];
  prefill: BookingPrefill;
  locale: Locale;
}) {
  const [created, setCreated] = useState<{
    bookingId: string;
    approved: boolean;
  } | null>(null);

  if (created) {
    return (
      <BookingConfirmation
        bookingId={created.bookingId}
        approved={created.approved}
      />
    );
  }

  return (
    <BookingWizard
      zones={zones}
      drones={drones}
      prefill={prefill}
      locale={locale}
      onCreated={setCreated}
    />
  );
}
