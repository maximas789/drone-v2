import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ProposalNotice } from "@/components/proposal-notice";
import { DateRange } from "@/components/admin/analytics/date-range";
import { ExportCsv } from "@/components/admin/analytics/export-csv";
import { NoShowLine } from "@/components/admin/analytics/noshow-line";
import { OutcomesChart } from "@/components/admin/analytics/outcomes-chart";
import { RegistrationsChart } from "@/components/admin/analytics/registrations-chart";
import { ResolutionsLine } from "@/components/admin/analytics/resolutions-line";
import { StatTiles } from "@/components/admin/analytics/stat-tiles";
import { TurnaroundHistogram } from "@/components/admin/analytics/turnaround-histogram";
import { UtilisationHeatmap } from "@/components/admin/analytics/utilisation-heatmap";
import { ZoneBar } from "@/components/admin/analytics/zone-bar";
import { QueueTabs } from "@/components/admin/queue-tabs";
import { requireReviewer } from "@/lib/auth-guards";
import { getAnalytics } from "@/lib/analytics/queries";
import { toRangeKey } from "@/lib/analytics/range";
import { countPendingReviews } from "@/lib/data/review";
import { formatNumber } from "@/lib/format";
import { toLocale } from "@/lib/locale";
import type { Metadata } from "next";
import { privatePageTitle } from "@/lib/site/metadata";

/**
 * `/admin/analytics` — **the screen a regulator is shown.**
 *
 * Reviewer-level, and read-only: there is not a single control on this page
 * that changes anything in the database. It answers one question — what is
 * happening across the platform — and the first chart answers the one this
 * whole product exists to answer, which is how many of the aircraft now
 * registered could not have been registered at all under a serial-keyed scheme.
 *
 * **Every number is a live query.** Nothing here is precomputed, cached across
 * requests, seeded or mocked; `src/lib/analytics/queries.ts` is the only source
 * and it is eight aggregate queries in one `Promise.all`. A dashboard with a
 * fixture in it would be worse than no dashboard on a page whose entire claim
 * is that this is what is actually happening.
 *
 * **Dynamic, not static.** It reads the session and the clock, so it must be —
 * a prerendered analytics page would show whoever opened it the numbers as they
 * were at build time.
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: PageProps<"/[locale]/admin/analytics">) {
  const locale = toLocale(await localeParam());
  const session = await requireReviewer();
  const t = await getTranslations("analytics");

  const params = await searchParams;
  const range = toRangeKey(params.range);

  const [data, counts] = await Promise.all([
    getAnalytics(session, range),
    countPendingReviews(session),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("intro")}</p>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <SignOutButton />
        </div>
      </header>

      <QueueTabs
        active="analytics"
        droneCount={formatNumber(counts.drones, locale)}
        bookingCount={formatNumber(counts.bookings, locale)}
      />

      <ProposalNotice />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRange active={range} locale={locale} />
        <ExportCsv range={range} locale={locale} />
      </div>

      <StatTiles tiles={data.tiles} locale={locale} />

      {/*
        **Two sentences that make the page's decisions readable rather than
        mysterious.** Both describe something a careful reader will notice and
        wonder about, and a dashboard that leaves a reader wondering whether
        what they are seeing is a choice or a bug has already lost them.
      */}
      <div className="text-muted-foreground flex flex-col gap-1 text-xs">
        <p>{t("tilesFixedNote")}</p>
        {/*
          The RTL decision, stated on the page as F25 requires. Reversing a time
          axis for Arabic misleads more than it accommodates: a reader who knows
          charts expects the left edge to be earlier, and mirroring it makes a
          rising trend read as a falling one to anybody who does not check.
        */}
        <p>{t("rtlNote")}</p>
      </div>

      <div className="flex flex-col gap-4">
        {/* First and largest — the build-type split is the evidence. */}
        <RegistrationsChart
          rows={data.registrations}
          window={data.window}
          locale={locale}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <OutcomesChart
            rows={data.outcomes}
            window={data.window}
            locale={locale}
          />
          <TurnaroundHistogram buckets={data.turnaround} locale={locale} />
        </div>

        <ZoneBar rows={data.zones} locale={locale} />

        <UtilisationHeatmap cells={data.utilisation} locale={locale} />

        <div className="grid gap-4 lg:grid-cols-2">
          <NoShowLine rows={data.noShow} window={data.window} locale={locale} />
          <ResolutionsLine
            rows={data.resolutions}
            window={data.window}
            locale={locale}
          />
        </div>
      </div>
    </main>
  );
}

/**
 * Its own tab title, from the same string this page renders as its heading.
 * `robots` comes from the route group's layout — see `PRIVATE_ROBOTS`.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/analytics">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "analytics.title");
}
