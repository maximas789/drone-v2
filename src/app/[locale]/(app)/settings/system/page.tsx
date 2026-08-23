import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { locale as localeParam } from "next/root-params";
import { notFound } from "next/navigation";
import { ActivityLog } from "@/components/ops/activity-log";
import { DataCountsPanel } from "@/components/ops/data-counts";
import { EmailFilters } from "@/components/ops/email-filters";
import { EmailLogPanel } from "@/components/ops/email-log";
import { HealthGrid } from "@/components/ops/health-grid";
import { JobsPanel } from "@/components/ops/jobs-panel";
import { RegenerateQr } from "@/components/ops/regenerate-qr";
import { requireUser } from "@/lib/auth-guards";
import { toLocale } from "@/lib/locale";
import { getDataCounts } from "@/lib/ops/counts";
import { runHealthChecks } from "@/lib/ops/health";
import { listEmailLog, listEmailTemplates, isEmailStatus } from "@/lib/ops/email-log";
import { listJobRuns, listScheduledFunctions } from "@/lib/ops/jobs";
import { listAuditEvents } from "@/lib/data/audit";
import { isAdmin } from "@/lib/session";
import type { Metadata } from "next";
import { privatePageTitle } from "@/lib/site/metadata";

/**
 * `/settings/system` — everything the app does out of sight, made visible.
 *
 * **`notFound()`, not a redirect and not a "forbidden" page.** A reviewer who
 * is told *"you are not allowed here"* has learned that an admin page exists at
 * this URL; a 404 tells them nothing they did not already know. The settings
 * nav does not render the link for them either, but that is a courtesy — this
 * is the check.
 *
 * **The request's own origin is what `APP_URL` is compared against**, and only
 * a request can know it. It is read here and passed down rather than looked up
 * inside the check, because a check that read the environment for both halves
 * of the comparison would always agree with itself.
 *
 * **There is no agent-activity section**, and there never will be: no MCP
 * server was ever built, so a panel for it would describe a product this is
 * not.
 */
export default async function SystemSettingsPage({
  searchParams,
}: PageProps<"/[locale]/settings/system">) {
  const locale = toLocale(await localeParam());
  const session = await requireUser(locale);
  if (!isAdmin(session)) notFound();

  const requestHeaders = await headers();
  /**
   * `host` plus the forwarded protocol — behind a proxy the scheme is the
   * proxy's, and comparing `http://` against a correctly-configured
   * `https://APP_URL` would report a mismatch on every production request.
   */
  const host = requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : null;

  /**
   * The email filters live in the **URL**, so a link to a filtered view is a
   * link somebody else can open and see the same rows.
   */
  const params = await searchParams;
  const rawStatus = typeof params.status === "string" ? params.status : "";
  const rawTemplate =
    typeof params.template === "string" ? params.template : "";
  const status = isEmailStatus(rawStatus) ? rawStatus : undefined;
  const template = rawTemplate || undefined;

  const t = await getTranslations("ops");
  const [checks, counts, runs, scheduled, emails, templates, activity] =
    await Promise.all([
      runHealthChecks(origin),
      getDataCounts(),
      listJobRuns(),
      listScheduledFunctions(),
      listEmailLog({ status, template }),
      listEmailTemplates(),
      /**
       * **The same reader F25b's browser uses** — one log, one query. A second
       * source here is how the admin's trail and the regulator's start to
       * disagree.
       */
      listAuditEvents(session, undefined, null, 25),
    ]);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">{t("healthTitle")}</h2>
          <p className="text-muted-foreground text-sm">{t("healthIntro")}</p>
        </header>
        <HealthGrid checks={checks} />
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("qr.title")}</h3>
          <p className="text-muted-foreground text-sm">{t("qr.intro")}</p>
          <RegenerateQr locale={locale} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">{t("jobs.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("jobs.intro")}</p>
        </header>
        <JobsPanel runs={runs} scheduled={scheduled} locale={locale} />
      </section>

      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">{t("email.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("email.intro")}</p>
        </header>
        <EmailFilters
          templates={templates}
          status={status}
          template={template}
        />
        <EmailLogPanel rows={emails} locale={locale} />
      </section>

      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">{t("activity.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("activity.intro")}</p>
        </header>
        <ActivityLog rows={activity.rows} locale={locale} />
      </section>

      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">{t("countsTitle")}</h2>
          <p className="text-muted-foreground text-sm">{t("countsIntro")}</p>
        </header>
        <DataCountsPanel counts={counts} locale={locale} />
      </section>
    </div>
  );
}

/**
 * Its own tab title, from the same string this page renders as its heading.
 * `robots` comes from the route group's layout — see `PRIVATE_ROBOTS`.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/settings/system">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "settings.system.title");
}
