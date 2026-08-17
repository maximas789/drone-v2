import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { countMyUnread } from "@/lib/data/notification";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import type { Session } from "@/lib/session";

/**
 * The bell, with its unread count.
 *
 * **A server component, counted on navigation.** No polling and no websockets:
 * this app has nothing that needs to arrive within seconds, and adding a socket
 * would be complexity with no user benefit — a count that updates when you move
 * around the app is the honest shape of the thing.
 *
 * The count goes through `formatNumber` before it reaches the page. A bare
 * number handed to ICU renders `٣` under `ar` (open thread 22), and a bell
 * showing Arabic-Indic digits beside a Latin-numeral date is precisely the
 * inconsistency `src/lib/format.ts` exists to prevent.
 */
export async function NotificationBell({
  session,
  locale,
}: {
  session: Session;
  locale: Locale;
}) {
  const t = await getTranslations("notifications");
  const unread = await countMyUnread(session);

  return (
    <Link
      href="/notifications"
      className="hover:bg-accent relative inline-flex size-9 items-center justify-center rounded-md border text-sm"
      aria-label={
        unread > 0
          ? t("unreadCount", { count: formatNumber(unread, locale) })
          : t("title")
      }
    >
      <BellIcon />
      {unread > 0 ? (
        <span
          // `-end-1`/`-top-1`: logical, so the badge sits on the correct
          // corner once the page flips to RTL.
          className="bg-primary text-primary-foreground absolute -end-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4"
          // The visible number is decorative — the accessible name above
          // already says how many, in a full sentence.
          aria-hidden
        >
          {formatNumber(unread, locale)}
        </span>
      ) : null}
    </Link>
  );
}

function BellIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
