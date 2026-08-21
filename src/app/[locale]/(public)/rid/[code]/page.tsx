import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { IdentityReveal } from "@/components/remote-id/identity-reveal";
import { ReportDialog } from "@/components/remote-id/report-dialog";
import { ScanResult } from "@/components/remote-id/scan-result";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { ProposalNotice } from "@/components/proposal-notice";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth-guards";
import { formatSeconds } from "@/lib/format";
import { toLocale } from "@/lib/locale";
import { resolveRemoteId } from "@/lib/remote-id/resolve";

/**
 * `/[locale]/rid/[code]` — the scannable digital licence plate.
 *
 * **A phone-first page reached from a QR sticker on an airframe**, usually by
 * somebody with no account who is standing outside looking up. Everything it
 * shows comes from `redactRemoteId`; this file decides layout and nothing about
 * who may see what.
 *
 * `noindex, nofollow`, and `robots.txt` disallows `/*​/rid/` as well. Letting a
 * crawler walk these pages would turn the scan endpoint into a browsable
 * national drone registry — exactly what the masking exists to prevent.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("scanTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function ScanPage({
  params,
}: PageProps<"/[locale]/rid/[code]">) {
  const { locale: localeParam, code } = await params;
  const locale = toLocale(localeParam);

  const t = await getTranslations("remoteId");
  const tCommon = await getTranslations("common");
  const tErrors = await getTranslations("errors");

  const session = await getSession();
  const outcome = await resolveRemoteId({
    rawCode: decodeURIComponent(code),
    session,
    headers: await headers(),
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <Link href="/" className="text-xl font-semibold">
          {tCommon("appName")}
        </Link>
        <LocaleSwitcher />
      </header>

      <div>
        <h1 className="text-2xl font-semibold">{t("scanHeading")}</h1>
        <p className="text-muted-foreground text-sm">{t("scanIntro")}</p>
      </div>

      {outcome.ok ? (
        <>
          <ScanResult view={outcome.view} locale={locale} />
          {outcome.view.canReveal ? (
            <IdentityReveal code={outcome.view.code} locale={locale} />
          ) : null}
          <ReportDialog code={outcome.view.code} locale={locale} />
        </>
      ) : outcome.reason === "rate_limited" ? (
        /**
         * Still a page, not a 429 with nothing on it. Somebody scanning a
         * second sticker a moment later needs to be told to wait, in a language
         * they read.
         */
        <p className="border-border rounded-xl border p-5 text-sm" role="alert">
          {tErrors("rateLimited", {
            duration: formatSeconds(outcome.retryAfterSeconds, locale),
          })}
        </p>
      ) : (
        /**
         * **Not a 404.** "This code is not registered" is the most useful thing
         * a field inspector can be told, and a 404 makes the tool look broken
         * at the moment it is working correctly. Reporting stays available —
         * an unregistered aircraft is the more interesting report.
         */
        <>
          <section className="border-border flex flex-col items-start gap-3 rounded-xl border p-5">
            <span className="text-muted-foreground text-sm">{t("code")}</span>
            <span
              dir="ltr"
              className="font-mono text-2xl font-semibold ltr:tracking-wide sm:text-3xl"
            >
              {outcome.code}
            </span>
            <Badge variant="secondary" className="h-7 px-3 text-sm">
              {outcome.reason === "invalid_code"
                ? t("invalidCode")
                : t("statusUnregistered")}
            </Badge>
            <p className="text-muted-foreground text-sm">
              {outcome.reason === "invalid_code"
                ? t("invalidCodeBody")
                : t("statusUnregisteredBody")}
            </p>
          </section>
          <ReportDialog code={outcome.code} locale={locale} />
        </>
      )}

      <ProposalNotice />
    </main>
  );
}
