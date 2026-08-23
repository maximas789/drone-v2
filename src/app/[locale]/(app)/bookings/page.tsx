import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import {
  BookingRow,
  type BookingRowData,
} from "@/components/booking/booking-row";
import { ButtonLink } from "@/components/ui/button-link";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth-guards";
import {
  listMyPastBookings,
  listMyUpcomingBookings,
  listZoneAndRemoteIdForBookings,
} from "@/lib/data/booking";
import { toLocale } from "@/lib/locale";
import type { Metadata } from "next";
import { privatePageTitle } from "@/lib/site/metadata";

/**
 * `/bookings` — every flight this pilot has asked for.
 *
 * **The tab is in the URL, not in client state.** A pilot who opens a booking
 * and presses back returns to the tab they were on; a shared link opens where
 * the sender was looking. It also means this page ships no JavaScript for its
 * own navigation.
 *
 * **Four tabs, and `rejected` lives with `cancelled`.** F21 names the four; a
 * rejected booking is a flight that is not happening, exactly like a cancelled
 * one, and giving it a fifth tab would leave five tabs mostly empty to
 * distinguish two states the badge on the row already distinguishes.
 *
 * **Sorted the way each tab is read.** Upcoming and pending run soonest-first,
 * because the question is *what is next*; past and cancelled run most-recent
 * first, because the question is *what just happened*. The readers already
 * order that way, so the tabs inherit it rather than re-sorting.
 */

const TABS = ["upcoming", "pending", "past", "cancelled"] as const;
type Tab = (typeof TABS)[number];

function toTab(value: string | string[] | undefined): Tab {
  const first = Array.isArray(value) ? value[0] : value;
  return (TABS as readonly string[]).includes(first ?? "")
    ? (first as Tab)
    : "upcoming";
}

export default async function BookingsPage({
  searchParams,
}: PageProps<"/[locale]/bookings">) {
  const locale = toLocale(await localeParam());
  const session = await requireUser(locale);
  const t = await getTranslations("bookings");

  const tab = toTab((await searchParams).tab);
  const now = new Date();

  const [upcoming, past] = await Promise.all([
    listMyUpcomingBookings(session, now),
    listMyPastBookings(session, now),
  ]);

  /**
   * The partition, once, over both reads.
   *
   * `cancelled` and `rejected` are pulled out of *both* lists: a booking
   * cancelled yesterday for a slot next week is still cancelled, and leaving it
   * in "upcoming" would have the tab promise a flight that is not happening.
   */
  const all = [...upcoming, ...past];
  const dead = (status: string) => status === "cancelled" || status === "rejected";

  const rows =
    tab === "upcoming"
      ? upcoming.filter((row) => row.status === "approved")
      : tab === "pending"
        ? all.filter((row) => row.status === "pending")
        : tab === "past"
          ? past.filter((row) => !dead(row.status))
          : all.filter((row) => dead(row.status));

  const context = await listZoneAndRemoteIdForBookings(
    session,
    rows.map((row) => row.id),
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <ButtonLink href="/bookings/new">{t("bookAnother")}</ButtonLink>
      </header>

      {/**
       * Real links, not buttons: each tab is a URL, so the browser's own back
       * button and a middle-click both do what they should.
       */}
      <nav aria-label={t("tabsLabel")}>
        <ul className="flex flex-wrap gap-2">
          {TABS.map((candidate) => (
            <li key={candidate}>
              <Link
                href={`/bookings?tab=${candidate}`}
                aria-current={candidate === tab ? "page" : undefined}
                className={[
                  "inline-block rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  candidate === tab
                    ? "border-primary ring-3 ring-ring/40"
                    : "hover:border-ring",
                ].join(" ")}
              >
                {t(`tab.${candidate}` as never)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {rows.length === 0 ? (
        /**
         * **A sentence per tab, not one shared "nothing here".** "No cancelled
         * bookings" is good news; "no upcoming flights" is an invitation. A
         * single empty state cannot be both.
         */
        <p className="text-muted-foreground">{t(`empty.${tab}` as never)}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <BookingRow
              key={row.id}
              locale={locale}
              booking={
                {
                  id: row.id,
                  status: row.status,
                  slotStart: row.slotStart,
                  slotEnd: row.slotEnd,
                  zoneNameAr: context[row.id]?.zoneNameAr ?? null,
                  zoneNameEn: context[row.id]?.zoneNameEn ?? null,
                  remoteIdCode: context[row.id]?.remoteIdCode ?? null,
                } satisfies BookingRowData
              }
            />
          ))}
        </ul>
      )}
    </main>
  );
}

/**
 * Its own tab title, from the same string this page renders as its heading.
 * `robots` comes from the route group's layout — see `PRIVATE_ROBOTS`.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/bookings">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "bookings.title");
}
