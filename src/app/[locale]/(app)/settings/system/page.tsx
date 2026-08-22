import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { locale as localeParam } from "next/root-params";
import { notFound } from "next/navigation";
import { DataCountsPanel } from "@/components/ops/data-counts";
import { HealthGrid } from "@/components/ops/health-grid";
import { RegenerateQr } from "@/components/ops/regenerate-qr";
import { requireUser } from "@/lib/auth-guards";
import { toLocale } from "@/lib/locale";
import { getDataCounts } from "@/lib/ops/counts";
import { runHealthChecks } from "@/lib/ops/health";
import { isAdmin } from "@/lib/session";

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
 * F29b adds jobs, F29c the email and activity logs. Neither is stubbed here: an
 * empty panel headed "Background jobs" would be exactly the lie this page is
 * supposed to expose.
 */
export default async function SystemSettingsPage() {
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

  const t = await getTranslations("ops");
  const [checks, counts] = await Promise.all([
    runHealthChecks(origin),
    getDataCounts(),
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
          <h2 className="text-lg font-medium">{t("countsTitle")}</h2>
          <p className="text-muted-foreground text-sm">{t("countsIntro")}</p>
        </header>
        <DataCountsPanel counts={counts} locale={locale} />
      </section>
    </div>
  );
}
