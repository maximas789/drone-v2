"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction } from "@/lib/actions/notification";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { riyadhYmd } from "@/lib/airspace/time";
import { NotificationItem, type NotificationView } from "./notification-item";

/**
 * The full list: grouped by Riyadh civil day, newest first, with an unread
 * filter and a bulk "mark all read".
 *
 * Grouped by the **Riyadh** day rather than the viewer's, and by the same
 * function the slot grid uses. A notification written at 01:00 Riyadh belongs
 * to that day for everyone reading it, or two people looking at the same list
 * would see different headings.
 */
export function NotificationList({
  notifications,
  locale,
}: {
  notifications: NotificationView[];
  locale: Locale;
}) {
  const t = useTranslations("notifications");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => {
    const read = new Set(readIds);
    return notifications.map((row) =>
      read.has(row.id) ? { ...row, status: "read" } : row,
    );
  }, [notifications, readIds]);

  const visible = unreadOnly
    ? rows.filter((row) => row.status === "unread")
    : rows;
  const unreadCount = rows.filter((row) => row.status === "unread").length;

  const groups = useMemo(() => {
    const byDay = new Map<string, NotificationView[]>();
    for (const row of visible) {
      const key = riyadhYmd(new Date(row.createdAt));
      const bucket = byDay.get(key);
      if (bucket) bucket.push(row);
      else byDay.set(key, [row]);
    }
    return [...byDay.entries()];
  }, [visible]);

  function markAll() {
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (result.ok) setReadIds(rows.map((row) => row.id));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={unreadOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setUnreadOnly((value) => !value)}
          aria-pressed={unreadOnly}
        >
          {t("filterUnread")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={markAll}
          disabled={pending || unreadCount === 0}
        >
          {t("markAllRead")}
        </Button>
      </div>

      {groups.length === 0 ? (
        /**
         * An empty list is a normal state, not a failure — it reads as a
         * finished sentence in both languages rather than as a blank panel that
         * looks like something failed to load.
         */
        <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
          {unreadOnly ? t("emptyUnread") : t("empty")}
        </p>
      ) : (
        groups.map(([day, items]) => (
          <section key={day} className="flex flex-col gap-1">
            <h2 className="text-muted-foreground px-3 text-xs font-medium">
              {formatDate(new Date(`${day}T12:00:00.000Z`), locale)}
            </h2>
            <ul className="flex flex-col gap-1">
              {items.map((row) => (
                <NotificationItem
                  key={row.id}
                  notification={row}
                  locale={locale}
                  onRead={(id) => setReadIds((current) => [...current, id])}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
