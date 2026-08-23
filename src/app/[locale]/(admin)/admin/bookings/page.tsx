import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { BookingQueueFilters } from "@/components/admin/booking-queue-filters";
import { BookingQueueTable } from "@/components/admin/booking-queue-table";
import { QueueTabs } from "@/components/admin/queue-tabs";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ButtonLink } from "@/components/ui/button-link";
import { ProposalNotice } from "@/components/proposal-notice";
import {
  applyBookingFilters,
  isBookingFiltered,
  parseBookingFilters,
} from "@/lib/admin/filters";
import { IMMINENT_HOURS } from "@/lib/admin/urgency";
import { requireReviewer } from "@/lib/auth-guards";
import { countPendingReviews, listBookingQueue } from "@/lib/data/review";
import { listActiveZones } from "@/lib/data/zone";
import { formatHours, formatNumber } from "@/lib/format";
import { toLocale } from "@/lib/locale";
import type { Metadata } from "next";
import { privatePageTitle } from "@/lib/site/metadata";

/**
 * `/admin/bookings` — the flight queue, and the second half of F22's queue.
 *
 * **Soonest slot first, and not configurable.** The drone queue is oldest-first
 * because a registration matters by how long it has waited; a booking matters
 * by how soon the flight is, and a queue ordered by request date would put a
 * flight this afternoon below one next month. The order is in
 * `listBookingQueue`, not in a control.
 *
 * **A slot already past is still listed.** Nothing sweeps an undecided request
 * when its window closes, so those rows are the queue admitting it failed to
 * answer in time — `TimeUntilBadge` marks them destructive and the urgency
 * filter has a bucket for them. Hiding them would hide the failure.
 *
 * **The clock is read once, here.** `TimeUntilBadge` takes `now` as a prop
 * rather than calling `Date.now()` in its render — a React render that reads
 * the clock is impure, and one instant per page means no two rows can disagree
 * about how long is left.
 *
 * The tab counts are the queues' **own totals, counted in SQL**, not the
 * filtered lengths and not `rows.length` of a page bounded by a limit.
 */
export default async function AdminBookingsPage({
  searchParams,
}: PageProps<"/[locale]/admin/bookings">) {
  const locale = toLocale(await localeParam());
  const session = await requireReviewer();
  const t = await getTranslations();
  const tReview = await getTranslations("review");

  const [queue, zones, counts] = await Promise.all([
    listBookingQueue(session),
    listActiveZones(session),
    countPendingReviews(session),
  ]);

  const filters = parseBookingFilters(
    await searchParams,
    zones.map((row) => row.id),
  );
  const now = new Date();
  const rows = applyBookingFilters(queue, filters, now);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{tReview("queueTitle")}</h1>
          <p className="text-muted-foreground text-sm">
            {tReview("queueBookingsIntro")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <SignOutButton />
        </div>
      </header>

      <ProposalNotice />

      <QueueTabs
        active="bookings"
        droneCount={formatNumber(counts.drones, locale)}
        bookingCount={formatNumber(counts.bookings, locale)}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">{tReview("queueBookings")}</h2>

        <BookingQueueFilters
          filters={filters}
          filtered={isBookingFiltered(filters)}
          zones={zones}
          locale={locale}
          resultCount={formatNumber(rows.length, locale)}
          totalCount={formatNumber(queue.length, locale)}
        />

        {queue.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {tReview("bookingsEmpty")}
          </p>
        ) : rows.length === 0 ? (
          /*
            Two empty states, because they mean two different things — the
            drone queue's reasoning. "Nothing is waiting" is good news; "your
            filters match nothing" is a filter to change.
          */
          <p className="text-muted-foreground text-sm">
            {tReview("bookingsNoMatches")}
          </p>
        ) : (
          <>
            <BookingQueueTable rows={rows} now={now} locale={locale} />
            <p className="text-muted-foreground text-xs">
              {tReview("imminentExplainer", {
                duration: formatHours(IMMINENT_HOURS, locale),
              })}
            </p>
          </>
        )}
      </section>

      <ButtonLink variant="outline" href="/dashboard">
        {t("dashboard.title")}
      </ButtonLink>
    </main>
  );
}

/**
 * Its own tab title, from the same string this page renders as its heading.
 * `robots` comes from the route group's layout — see `PRIVATE_ROBOTS`.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/bookings">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "review.tabBookings");
}
