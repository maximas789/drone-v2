import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { NotificationList } from "@/components/notifications/notification-list";
import { NotificationPreferences } from "@/components/notifications/notification-preferences";
import { requireUser } from "@/lib/auth-guards";
import {
  getMyPreferences,
  listMyNotifications,
} from "@/lib/data/notification";
import { toLocale } from "@/lib/locale";
import type { Metadata } from "next";
import { privatePageTitle } from "@/lib/site/metadata";

/**
 * The full notification list.
 *
 * Read server-side on navigation — no polling, no websockets. Nothing this app
 * sends needs to arrive within seconds, and a socket would be complexity with
 * no user benefit.
 *
 * The guard runs in the layout too. Repeated here because this page reads the
 * session, and a page that needs one should say so rather than trust that
 * something above it happened to check.
 */
export default async function NotificationsPage() {
  const locale = toLocale(await localeParam());
  const session = await requireUser(locale);
  const t = await getTranslations("notifications");

  const [rows, preferences] = await Promise.all([
    listMyNotifications(session),
    getMyPreferences(session),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <NotificationList
        locale={locale}
        /**
         * Serialised at the boundary: `createdAt` crosses to a client component
         * as an ISO string, not a `Date`. The same rule the airspace engine
         * follows, and for the same reason — one of the two round trips would
         * otherwise hand back a string that nothing expects.
         */
        notifications={rows.map((row) => ({
          id: row.id,
          type: row.type,
          params: row.params as Record<string, unknown> | null,
          href: row.href,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
        }))}
      />

      <NotificationPreferences
        preferences={preferences.map((row) => ({
          category: row.category,
          emailEnabled: row.emailEnabled,
          inAppEnabled: row.inAppEnabled,
        }))}
      />
    </main>
  );
}

/**
 * Its own tab title, from the same string this page renders as its heading.
 * `robots` comes from the route group's layout — see `PRIVATE_ROBOTS`.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/notifications">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "notifications.title");
}
