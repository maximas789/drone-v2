import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { UserRoleTable } from "@/components/admin/user-role-table";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireReviewer } from "@/lib/auth-guards";
import { listDroneReports } from "@/lib/data/remote-id";
import { listUsers } from "@/lib/data/user";
import { formatDateTime } from "@/lib/format";
import { toLocale } from "@/lib/locale";
import { isAdmin, roleOf } from "@/lib/session";

/**
 * Wave 3 admin index. F22–F25 fill it with the review queues, the zone editor,
 * the Remote ID lookup and the audit browser.
 *
 * What it carries now is the one admin surface F05 itself owns: role
 * assignment. `listUsers` returns an empty list to anyone who isn't an admin,
 * so a reviewer reaching this page sees the notice rather than the roster —
 * the scoping is in the data layer, not in this component's markup.
 */
export default async function AdminPage() {
  const locale = toLocale(await localeParam());
  const session = await requireReviewer();
  const t = await getTranslations();
  const users = await listUsers(session);
  const reports = await listDroneReports(session);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("admin.title")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("dashboard.signedInAs", { role: t(`roles.${roleOf(session)}`) })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <SignOutButton />
        </div>
      </header>

      <Badge variant="secondary" className="whitespace-normal">
        {t("common.proposalNotice")}
      </Badge>

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
        somewhere a reviewer sees, or "files a report visible to reviewers" is
        a claim about a table nobody reads. F22's queues replace this list —
        `listDroneReports` returns nothing to a non-reviewer, so the scoping is
        in the data layer rather than in this markup.
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
            <ul className="flex flex-col gap-3 text-sm">
              {reports.map((report) => (
                <li key={report.id} className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span dir="ltr" className="font-mono font-medium">
                      {report.reportedCode}
                    </span>
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
