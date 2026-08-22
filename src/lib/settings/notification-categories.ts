import { notificationCategory } from "@/lib/db/enums";

export type NotificationCategory =
  (typeof notificationCategory.enumValues)[number];

/**
 * The categories the settings page offers a switch for.
 *
 * **This is deliberately not the whole enum, and the difference is the point.**
 *
 * `notification_category` has three values. Only two of them are ever passed to
 * `notify()`:
 *
 * | Category | Passed by | Switchable |
 * |---|---|---|
 * | `booking_reminder` | `inngest/functions/booking-reminders.ts` | yes |
 * | `registration_expiry` | `inngest/functions/expiry-reminders.ts` | yes |
 * | `zone_closure` | **nobody** | no |
 *
 * F23c's closure fan-out sends `zoneClosed` with **no category at all**, and
 * says why in as many words: *"A cancellation is not a preference — a pilot who
 * muted it would turn up to a closed zone."* That call is right. A closure
 * notice is the same kind of thing as a rejection: it is a decision about a
 * flight somebody has already booked, and hiding it behind a preference is
 * hiding it.
 *
 * So offering a `zone_closure` switch would put a control on the page that
 * changes **nothing** — the exact failure mode F28 exists to avoid, in
 * miniature. An inert switch is worse than an absent one, because a person who
 * turns it off believes they have done something.
 *
 * The enum value is left in place rather than migrated away: it costs nothing,
 * it is what a future closure *digest* would key on, and dropping a value from
 * a Postgres enum is a migration far larger than the tidiness is worth.
 * `notification-categories.test.ts` is what stops it drifting back — it reads
 * the source for `category:` literals and fails if this list and the code
 * disagree in either direction.
 */
export const SWITCHABLE_CATEGORIES = [
  "booking_reminder",
  "registration_expiry",
] as const satisfies readonly NotificationCategory[];

export type SwitchableCategory = (typeof SWITCHABLE_CATEGORIES)[number];

/**
 * Categories the app has, but never lets anybody switch off. Rendered as part
 * of the "these are always sent" sentence rather than as a disabled control.
 */
export const ALWAYS_SENT_CATEGORIES = notificationCategory.enumValues.filter(
  (category) =>
    !(SWITCHABLE_CATEGORIES as readonly string[]).includes(category),
);
