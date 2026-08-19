import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button-link";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * The things standing between this pilot and a legal flight.
 *
 * **It renders nothing when nothing is required.** An "Action required" heading
 * over an empty box, or over "you're all set", teaches a reader to stop looking
 * at it — and then the one week it matters, they skip it too. F21's criterion
 * is that it "appears only when something is genuinely required, and is absent
 * otherwise", which is a statement about the empty case, not the full one.
 *
 * **Order is by what blocks what.** An incomplete profile blocks registration,
 * which blocks a Remote ID, which blocks a booking. Listing them in that order
 * means the top item is always the one worth doing next.
 */

export type ActionItem = {
  /** Catalogue key under `dashboard.actions`. */
  key: string;
  href: string;
  /** Rendered into the item's sentence, already formatted. */
  values?: Record<string, string>;
};

export function buildActions({
  profileComplete,
  identityVerified,
  rejectedDroneCount,
  expiringSoon,
  bookingToday,
  locale,
}: {
  profileComplete: boolean;
  identityVerified: boolean;
  rejectedDroneCount: number;
  /** The soonest registration expiry inside the warning window, if any. */
  expiringSoon: { nickname: string; expiresAt: Date } | null;
  bookingToday: { id: string } | null;
  locale: Locale;
}): ActionItem[] {
  const items: ActionItem[] = [];

  if (!profileComplete) {
    items.push({ key: "completeProfile", href: "/profile/complete" });
  } else if (!identityVerified) {
    /**
     * Distinct from "incomplete", and **not a task the pilot can finish** —
     * a human reviewer checks the document. It is here because it blocks
     * booking, so a pilot who does not know it is pending would read every
     * refusal as a bug in the form they already filled in correctly.
     */
    items.push({ key: "awaitingVerification", href: "/settings/profile" });
  }

  if (rejectedDroneCount > 0) {
    items.push({ key: "rejectedDrone", href: "/drones" });
  }

  if (expiringSoon) {
    items.push({
      key: "expiringRegistration",
      href: "/drones",
      values: {
        nickname: expiringSoon.nickname,
        date: formatDate(expiringSoon.expiresAt, locale),
      },
    });
  }

  if (bookingToday) {
    items.push({
      key: "flightToday",
      href: `/bookings/${bookingToday.id}`,
    });
  }

  return items;
}

export async function ActionRequired({ items }: { items: readonly ActionItem[] }) {
  const t = await getTranslations("dashboard");
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-s-4 p-5">
      <h2 className="text-lg font-medium">{t("actionRequired")}</h2>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
          >
            <span className="text-sm">
              {t(`actions.${item.key}` as never, item.values as never)}
            </span>
            <ButtonLink variant="outline" size="sm" href={item.href}>
              {t(`actionCta.${item.key}` as never)}
            </ButtonLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
