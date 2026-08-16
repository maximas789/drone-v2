import { riyadhDayKey } from "@/lib/format";

/**
 * The arithmetic behind every scheduled job, **pure**.
 *
 * Same split as `src/lib/rate-limit/rules.ts` and `src/lib/airspace/`: nothing
 * here touches the database, Inngest or `server-only`, so the whole of it is
 * unit-testable without a connection string. A rule a `POSTGRES_URL` can veto
 * is a rule nobody can test.
 */

// --- Cron -----------------------------------------------------------------

/**
 * Every schedule is Riyadh civil time. `03:00` has to mean three in the morning
 * in Riyadh, not three in the morning wherever the executor happens to be — an
 * expiry sweep drifting into the middle of the working day is the visible
 * symptom, and a reminder arriving at 06:00 the wrong day is the invisible one.
 */
export const CRON_TIMEZONE = "Asia/Riyadh";

export function riyadhCron(expression: string): string {
  return `TZ=${CRON_TIMEZONE} ${expression}`;
}

/**
 * The declared schedule of every cron function, by function id.
 *
 * Exported as data because F29's system page lists "cron, timezone, last run,
 * next due" — and reading it off the function definitions would mean importing
 * the whole Inngest graph into a page render.
 */
export const CRON_SCHEDULES = {
  "registration-expiry-sweep": "0 3 * * *",
  "registration-expiry-reminders": "15 3 * * *",
  "booking-closeout": "*/15 * * * *",
  "booking-reminders": "0 * * * *",
  "review-queue-digest": "30 * * * *",
  "rate-limit-sweep": "0 4 * * *",
} as const;

export type CronFunctionId = keyof typeof CRON_SCHEDULES;

// --- Registration expiry --------------------------------------------------

/**
 * **Instants, not dates.** A registration expiring at 00:30 Riyadh must not be
 * swept by the 03:00 run on the *previous* Riyadh day, and comparing calendar
 * dates in UTC is exactly how that happens: at 03:00 Riyadh the UTC date is
 * still yesterday's, so `expiresAt`'s UTC date and `now`'s UTC date match and a
 * date comparison declares a live registration expired eight hours early.
 */
export function isRegistrationExpired(
  expiresAt: Date | null,
  now: Date,
): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now.getTime();
}

/** How many whole **Riyadh civil days** separate `now` from `target`. */
export function daysUntilRiyadhDay(target: Date, now: Date): number {
  const from = Date.parse(`${riyadhDayKey(now)}T00:00:00Z`);
  const to = Date.parse(`${riyadhDayKey(target)}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/**
 * How far ahead a pilot is warned. Descending, because the rule below picks the
 * *smallest* threshold still ahead of the drone.
 */
export const EXPIRY_REMINDER_DAYS = [60, 30, 7] as const;

export type ExpiryThreshold = (typeof EXPIRY_REMINDER_DAYS)[number];

/**
 * Which reminder a drone that many days out is due, or `null` for none.
 *
 * The **smallest threshold that is still at or above** the remaining days: at
 * 29 days out the answer is 30, not 60, because the 60-day warning was already
 * sent (or was already missed, and re-sending it now would say something
 * untrue). A drone past every threshold has nothing left to warn about — it is
 * the sweep's problem, not the reminder's.
 */
export function reminderThresholdFor(
  daysRemaining: number,
): ExpiryThreshold | null {
  if (daysRemaining < 0) return null;
  let chosen: ExpiryThreshold | null = null;
  for (const threshold of EXPIRY_REMINDER_DAYS) {
    if (threshold >= daysRemaining) chosen = threshold;
  }
  return chosen;
}

/**
 * The marker written once a threshold has been warned about. The next run skips
 * anyone who already has one — a pilot must never get the same 30-day warning
 * twice, and a sweep that re-queried "still 30 days out" every day for a week
 * would send it seven times.
 */
export const EXPIRY_REMINDER_ACTION = "drone.expiry_reminded";

// --- Booking closeout -----------------------------------------------------

/**
 * How long after a slot ends a pilot may still be recorded as having flown it.
 * Check-in is manual, and a pilot packing up a drone is not looking at a phone.
 */
export const NO_SHOW_GRACE_MINUTES = 30;

export type CloseoutVerdict = "completed" | "no_show" | null;

/**
 * What an `approved` booking becomes once its slot is over. `null` means leave
 * it alone — the slot is still running, or the grace period has not elapsed.
 *
 * Checked in wins immediately: somebody who flew is `completed` the moment the
 * slot ends, with no grace period, because there is nothing left to wait for.
 */
export function closeoutVerdict(
  booking: { slotEnd: Date; checkedInAt: Date | null },
  now: Date,
): CloseoutVerdict {
  if (now.getTime() < booking.slotEnd.getTime()) return null;
  if (booking.checkedInAt) return "completed";

  const graceEnds =
    booking.slotEnd.getTime() + NO_SHOW_GRACE_MINUTES * 60_000;
  return now.getTime() >= graceEnds ? "no_show" : null;
}

// --- Booking reminders ----------------------------------------------------

/** "The day before." The job runs hourly and each booking is marked once. */
export const BOOKING_REMINDER_LEAD_HOURS = 24;

export const BOOKING_REMINDER_ACTION = "booking.reminded";

/**
 * Bookings whose slot starts inside this window are due a reminder.
 *
 * It opens at `now` rather than at `now + 23h` on purpose: a booking created
 * *inside* the 24-hour window would otherwise never fall in any hourly slice
 * and would silently get no reminder at all. The marker is what stops the wide
 * window sending twenty-four of them.
 */
export function bookingReminderWindow(now: Date): { from: Date; to: Date } {
  return {
    from: now,
    to: new Date(now.getTime() + BOOKING_REMINDER_LEAD_HOURS * 3_600_000),
  };
}

// --- Review queue digest --------------------------------------------------

/**
 * A second run inside this window sends nothing. The digest is hourly, so a
 * manual trigger or a retried run half an hour later must not put a second
 * identical summary in every reviewer's inbox.
 */
export const DIGEST_MIN_INTERVAL_MINUTES = 45;

export function digestSuppressedSince(now: Date): Date {
  return new Date(now.getTime() - DIGEST_MIN_INTERVAL_MINUTES * 60_000);
}

/**
 * An empty queue sends **nothing** — not a "nothing to review" email. A digest
 * that arrives every hour regardless is a digest people filter away, and then
 * the one that mattered is filtered away too.
 */
export function digestWorthSending(counts: {
  pendingDrones: number;
  pendingBookings: number;
}): boolean {
  return counts.pendingDrones + counts.pendingBookings > 0;
}
