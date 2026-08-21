import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { AGE_FLAG_DAYS } from "@/components/admin/age-badge";
import { QueueFilters } from "@/components/admin/queue-filters";
import { QueueTable } from "@/components/admin/queue-table";
import { QueueTabs } from "@/components/admin/queue-tabs";
import { ReportTriage } from "@/components/admin/report-triage";
import { UserRoleTable } from "@/components/admin/user-role-table";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { ProposalNotice } from "@/components/proposal-notice";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  applyQueueFilters,
  isFiltered,
  parseQueueFilters,
} from "@/lib/admin/filters";
import { requireReviewer } from "@/lib/auth-guards";
import { listCities } from "@/lib/data/pilot";
import {
  countPendingReviews,
  listDroneQueue,
  listReports,
} from "@/lib/data/review";
import { listUsers } from "@/lib/data/user";
import { formatDateTime, formatDays, formatNumber } from "@/lib/format";
import { toLocale } from "@/lib/locale";
import { isAdmin } from "@/lib/session";

/**
 * `/admin` — the review queue.
 *
 * Wave 3's placeholder said hello and printed the account's role. This is the
 * real thing for **drone registrations**; `/admin/bookings` is the other tab,
 * and F22c adds the pilots directory.
 *
 * **The tab strip arrived with the second tab, not before it.** F22a shipped
 * this queue bare, because a two-tab control whose second tab links to a route
 * that does not exist is worse than one tab — the seam rule that also settled
 * F16/F19/F20/F21. F22b built `/admin/bookings`, so the strip is here now.
 *
 * **Oldest first, and not configurable.** A queue sorted newest-first buries
 * the submissions that have waited longest, which is the opposite of what a
 * regulator needs. The order is in `listDroneQueue`, not in a control.
 *
 * **The clock is read once, here.** `AgeBadge` takes `now` as a prop rather
 * than calling `Date.now()` in its render — a React render that reads the clock
 * is impure, and one instant per page means no two rows can disagree about what
 * day it is.
 *
 * Role assignment and the drone-report list stay below the queue for now. They
 * are F05's and F11's surfaces respectively and neither has anywhere else to
 * live yet; F25 and F29 own relocating them, and thread 35 owns giving the
 * reports a real triage state.
 */
export default async function AdminPage({
  searchParams,
}: PageProps<"/[locale]/admin">) {
  const locale = toLocale(await localeParam());
  const session = await requireReviewer();
  const t = await getTranslations();
  const tReview = await getTranslations("review");

  const [queue, cities, users, reports, counts] = await Promise.all([
    listDroneQueue(session),
    listCities(session),
    listUsers(session),
    listReports(session),
    countPendingReviews(session),
  ]);

  const filters = parseQueueFilters(
    await searchParams,
    cities.map((row) => row.id),
  );
  const now = new Date();
  const rows = applyQueueFilters(queue, filters, now);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{tReview("queueTitle")}</h1>
          <p className="text-muted-foreground text-sm">
            {tReview("queueIntro")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <SignOutButton />
        </div>
      </header>

      <ProposalNotice />

      <QueueTabs
        active="drones"
        droneCount={formatNumber(counts.drones, locale)}
        bookingCount={formatNumber(counts.bookings, locale)}
      />

      <section className="flex flex-col gap-4">
        {/*
          **The count moved to the tab** when F22b added the strip. It was a
          lone badge beside this heading while there was only one queue; with
          both totals on the tabs, repeating one of them two lines below is the
          same number said twice — and the tab's is the better one, because it
          is counted in SQL rather than taken from a page bounded by a `limit`.
          The filtered count stays on the filter bar, beside what caused it.
        */}
        <h2 className="text-lg font-medium">{tReview("queueDrones")}</h2>

        <QueueFilters
          filters={filters}
          filtered={isFiltered(filters)}
          cities={cities}
          locale={locale}
          resultCount={formatNumber(rows.length, locale)}
          totalCount={formatNumber(queue.length, locale)}
        />

        {queue.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {tReview("queueEmpty")}
          </p>
        ) : rows.length === 0 ? (
          /*
            Two different empty states, because they mean two different things.
            "Nothing is waiting" is good news; "your filters match nothing" is a
            filter to change, and telling somebody the queue is empty when it is
            not is a lie they will act on.
          */
          <p className="text-muted-foreground text-sm">
            {tReview("queueNoMatches")}
          </p>
        ) : (
          <>
            <QueueTable rows={rows} now={now} locale={locale} />
            <p className="text-muted-foreground text-xs">
              {tReview("overdueExplainer", {
                duration: formatDays(AGE_FLAG_DAYS, locale),
              })}
            </p>
          </>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.roleAssignment")}</CardTitle>
          <CardDescription>{t("admin.roleAssignmentIntro")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isAdmin(session) ? (
            <UserRoleTable
              users={users}
              currentUserId={session.user.id}
              locale={locale}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("admin.adminOnlyNotice")}
            </p>
          )}
        </CardContent>
      </Card>

      {/*
        F11's half: a report filed from the public scan page has to land
        somewhere a reviewer sees, or "files a report visible to reviewers" is a
        claim about a table nobody reads.

        **Thread 35 closed here.** It was a read-only list until F22c: reports
        accumulated for ever with no handled state, no assignment and no way to
        close one. The columns were deliberately not added earlier, because a
        state nothing writes is a lie about what the app does — so they arrived
        with these controls. Open reports sort first, oldest first inside that;
        handled ones stay below rather than vanishing, because "what did we do
        about that sighting" is asked after the fact.
      */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.reportsTitle")}</CardTitle>
          <CardDescription>{t("admin.reportsIntro")}</CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("admin.reportsEmpty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-4 text-sm">
              {reports.map((report) => (
                <li key={report.id} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span dir="ltr" className="font-mono font-medium">
                      {report.reportedCode}
                    </span>
                    <Badge
                      variant={
                        report.status === "open" ? "default" : "secondary"
                      }
                    >
                      {tReview(`reportStatus.${report.status}`)}
                    </Badge>
                    {report.remoteIdCode ? null : (
                      <Badge variant="outline">
                        {t("admin.reportsUnresolved")}
                      </Badge>
                    )}
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(report.createdAt, locale)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{report.description}</p>
                  {report.locationNote ? (
                    <p className="text-muted-foreground text-xs">
                      {report.locationNote}
                    </p>
                  ) : null}
                  {/*
                    The reported code resolved to a real aircraft, so the
                    reviewer can go and look at it. A report about a code that
                    resolved to nothing has nowhere to send them, and an
                    unresolved badge above already says so.
                  */}
                  {report.droneId ? (
                    <Link
                      href={`/admin/drones/${report.droneId}`}
                      className="text-sm underline"
                    >
                      {tReview("reportOpenAircraft")}
                    </Link>
                  ) : null}

                  {report.status === "open" ? (
                    <ReportTriage reportId={report.id} locale={locale} />
                  ) : (
                    <div className="text-muted-foreground flex flex-col gap-1 text-xs">
                      <span>
                        {report.handledAt
                          ? tReview("reportHandledAt", {
                              at: formatDateTime(report.handledAt, locale),
                            })
                          : null}
                      </span>
                      {/* The reviewer's own words, kept for the next one. */}
                      {report.handlingNote ? (
                        <p className="whitespace-pre-wrap">
                          {report.handlingNote}
                        </p>
                      ) : null}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ButtonLink variant="outline" href="/dashboard">
        {t("dashboard.title")}
      </ButtonLink>
    </main>
  );
}
