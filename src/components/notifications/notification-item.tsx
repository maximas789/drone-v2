"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { markNotificationReadAction } from "@/lib/actions/notification";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { collapseParams, isNotificationType } from "@/lib/notifications/render";
import { cn } from "@/lib/utils";

/**
 * One notification, rendered from a `type` key and structured `params`.
 *
 * **Nothing here reads a stored sentence.** The row carries `zoneAr` *and*
 * `zoneEn`; `collapseParams` picks the half this reader asked for and hands the
 * catalogue a single `{zone}`. That is why a notification written a year ago in
 * Arabic reads correctly in English today — and why it still names the zone as
 * it was called at the time, with no join back to a table that may have been
 * renamed since.
 */

export type NotificationView = {
  id: string;
  type: string;
  params: Record<string, unknown> | null;
  href: string | null;
  status: string;
  createdAt: string;
};

export function NotificationItem({
  notification,
  locale,
  onRead,
}: {
  notification: NotificationView;
  locale: Locale;
  onRead?: (id: string) => void;
}) {
  const t = useTranslations("notifications");
  const [read, setRead] = useState(notification.status !== "unread");
  const [pending, startTransition] = useTransition();

  const created = new Date(notification.createdAt);

  /**
   * An unknown type renders as its own key rather than throwing — a
   * notification the catalogue has not caught up with should still be
   * *visible*, because the alternative is a blank row that says nothing
   * happened. `render.test.ts` is what stops one ever reaching here.
   */
  const message = isNotificationType(notification.type)
    ? t(notification.type, collapseParams(notification.params, locale))
    : notification.type;

  function markRead() {
    if (read || pending) return;
    setRead(true);
    startTransition(async () => {
      const result = await markNotificationReadAction(notification.id);
      // Put it back if the server disagreed: an item that looks read but is
      // still counted in the bell is worse than one that never changed.
      if (!result.ok) setRead(false);
      else onRead?.(notification.id);
    });
  }

  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          read ? "bg-transparent" : "bg-primary",
        )}
      />
      <span className="flex flex-col gap-1">
        <span className={cn("text-sm", read ? "font-normal" : "font-medium")}>
          {message}
        </span>
        {/* Both: the relative form for a glance, the exact instant on hover —
            Gregorian and Latin-numeralled in both languages, via format.ts. */}
        <time
          dateTime={notification.createdAt}
          title={formatDateTime(created, locale)}
          className="text-muted-foreground text-xs"
        >
          {formatRelativeTime(created, locale)}
        </time>
      </span>
    </>
  );

  const className = cn(
    "flex w-full items-start gap-3 rounded-md p-3 text-start transition-colors",
    read ? "bg-transparent" : "bg-accent/40",
    "hover:bg-accent",
  );

  if (!notification.href) {
    return (
      <li>
        <button type="button" onClick={markRead} className={className}>
          {body}
        </button>
      </li>
    );
  }

  return (
    <li>
      {/**
       * `Link` from `@/i18n/navigation`, never `next/link` — the stored `href`
       * is locale-less on purpose, and this is what puts the reader's own
       * locale in front of it.
       */}
      <Link href={notification.href} onClick={markRead} className={className}>
        {body}
      </Link>
    </li>
  );
}
