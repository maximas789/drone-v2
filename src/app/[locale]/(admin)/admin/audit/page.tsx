import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { AuditFilters } from "@/components/admin/audit/filters";
import { AuditTable } from "@/components/admin/audit/table";
import { QueueTabs } from "@/components/admin/queue-tabs";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ProposalNotice } from "@/components/proposal-notice";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  auditFilterQuery,
  decodeAuditCursor,
  hasAnyAuditFilter,
  parseAuditFilters,
} from "@/lib/admin/audit-filters";
import { requireAdmin } from "@/lib/auth-guards";
import {
  listAuditActionCodes,
  listAuditActors,
  listAuditEvents,
} from "@/lib/data/audit";
import { countPendingReviews } from "@/lib/data/review";
import { auditEvent } from "@/lib/db/schema";
import { formatNumber, riyadhDayKey } from "@/lib/format";
import { toLocale } from "@/lib/locale";

/**
 * `/admin/audit` — **the whole log, and the proof that nothing rewrites it.**
 *
 * **Admin only, and 404 rather than 403.** A reviewer reaches
 * `/admin/analytics` and does not reach this: analytics is aggregate counts
 * with no person in them, while this page names who revealed whose identity and
 * why. A reviewer who could read it would know exactly how much scrutiny their
 * own decisions were getting — the same asymmetry `/admin/reveals` exists for,
 * and the reason that page is admin-only too. The guard is here on the page,
 * not only in the layout, because `(admin)/layout.tsx` requires a *reviewer*.
 *
 * **Browsing is not audited; the export is.** Writing a row every time an
 * administrator scrolled the log would bury the events that matter under the
 * act of reading them, and would make the table grow by being looked at. Taking
 * a **copy** of it out of the system is a different act, so `/api/admin/audit`
 * writes an event for that — as do the reveals and lookups that appear here.
 * The page says both things out loud rather than leaving a reader to guess.
 *
 * **Cursor pagination, not offset.** This table only ever grows: an
 * administrator reading page three while a reviewer approves something would
 * see one row twice and miss another. The cursor is `(created_at, id)`, which
 * is stable under insertion by construction.
 *
 * **There is no edit control on this page and no delete control, because there
 * is no server action that could serve one.** `audit-integrity.test.ts` greps
 * the source for an update or delete against `auditEvent` and fails if one
 * appears.
 */
export default async function AdminAuditPage({
  searchParams,
}: PageProps<"/[locale]/admin/audit">) {
  const locale = toLocale(await localeParam());
  const session = await requireAdmin();
  const t = await getTranslations("audit");

  const params = await searchParams;
  const filters = parseAuditFilters(params);
  const cursor = decodeAuditCursor(params.cursor);
  const filtered = hasAnyAuditFilter(filters);

  const [page, actors, actions, counts] = await Promise.all([
    listAuditEvents(session, filters, cursor),
    listAuditActors(session),
    listAuditActionCodes(session),
    countPendingReviews(session),
  ]);

  /**
   * The years the date filter offers: this Riyadh year and the four before it.
   * The log cannot hold an event older than the platform, and a select of forty
   * years to pick a date from a table that starts in 2026 is a worse control
   * than a short one.
   */
  const thisYear = Number(riyadhDayKey(new Date()).slice(0, 4));
  const years = [0, 1, 2, 3, 4].map((back) => thisYear - back);

  const query = auditFilterQuery(filters);
  /**
   * The export carries **the filters, not the cursor**: the file is the
   * filtered log, not the fifty rows that happen to be on screen. A regulator
   * asking for "every decision this reviewer made in August" wants all of them.
   */
  const exportHref = `/api/admin/audit?${new URLSearchParams({
    ...query,
    locale,
  }).toString()}`;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
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
        active="audit"
        droneCount={formatNumber(counts.drones, locale)}
        bookingCount={formatNumber(counts.bookings, locale)}
      />

      <ProposalNotice />

      {/*
        **The integrity claim, in one line, on the page** — F25's own wording:
        "the page says so in one line". A reader has no way to verify from the
        outside that a log is append-only, so the system that keeps it says what
        it guarantees, and the test suite holds it to it.
      */}
      <div className="text-muted-foreground flex flex-col gap-1 text-xs">
        <p>{t("appendOnly")}</p>
        <p>{t("browsingNotAudited")}</p>
      </div>

      <AuditFilters
        filters={filters}
        filtered={filtered}
        actors={actors}
        actions={actions}
        entityTypes={auditEvent.entityType.enumValues}
        years={years}
        locale={locale}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">{t("exportNote")}</p>
        {/*
          A real anchor styled from `buttonVariants`, not `<Button render={<a/>}>`
          — Base UI's Button expects a genuine `<button>`, and its escape hatch
          puts `role="button"` on the anchor so a screen reader announces a
          download as a button. Not `ButtonLink` either: this href leaves the
          locale-prefixed route tree, so it must not go through
          `@/i18n/navigation`, which is why the locale rides in the query string.
        */}
        <a
          href={exportHref}
          download
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {t("exportCsv")}
        </a>
      </div>

      {page.rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {filtered ? t("noMatches") : t("empty")}
        </p>
      ) : (
        <>
          <AuditTable rows={page.rows} locale={locale} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-xs">{t("pageNote")}</p>
            {page.nextCursor ? (
              /*
                One direction only, and deliberately. A keyset cursor knows how
                to go forward; "previous" would need the reverse cursor kept in
                the URL as well, and the back button already does that job
                correctly for free because every page is its own link.
              */
              <Link
                href={{
                  pathname: "/admin/audit",
                  query: { ...query, cursor: page.nextCursor },
                }}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {t("olderPage")}
              </Link>
            ) : null}
          </div>
        </>
      )}
    </main>
  );
}
