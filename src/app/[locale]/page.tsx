import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
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
import {
  formatDate,
  formatDateRange,
  formatNumber,
  formatTime,
  riyadhWeekday,
} from "@/lib/format";
import { toLocale } from "@/lib/locale";

/**
 * Wave 1 placeholder. F16 replaces this with the real landing page.
 *
 * It deliberately exercises the whole i18n foundation — direction, fonts,
 * the switcher, and every formatting rule — so a regression is visible on the
 * first page anyone opens rather than three waves later.
 */
export default async function Home() {
  const locale = toLocale(await localeParam());
  const t = await getTranslations();

  // A fixed instant, so this page reads the same on every render: a Sunday,
  // 14:00 Riyadh time.
  const sample = new Date("2026-03-15T11:00:00Z");
  const sampleEnd = new Date("2026-03-15T13:00:00Z");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("common.appName")}</h1>
          <p className="text-muted-foreground text-sm">{t("common.tagline")}</p>
        </div>
        <LocaleSwitcher />
      </header>

      <Badge variant="secondary">{t("common.proposalNotice")}</Badge>

      <Card>
        <CardHeader>
          <CardTitle>{t("landing.remoteIdTitle")}</CardTitle>
          <CardDescription>{t("landing.remoteIdBody")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {/*
            shadcn now builds on Base UI, whose composition prop is `render`,
            not Radix's `asChild`.
          */}
          <ButtonLink href="/">{t("landing.ctaRegister")}</ButtonLink>
          <ButtonLink variant="outline" href="/">
            {t("landing.ctaExploreMap")}
          </ButtonLink>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("common.date")}</CardTitle>
          <CardDescription>{t("zones.disclaimer")}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t("common.date")}</dt>
            <dd>{formatDate(sample, locale)}</dd>

            <dt className="text-muted-foreground">{t("common.time")}</dt>
            <dd>{formatTime(sample, locale)}</dd>

            <dt className="text-muted-foreground">{t("booking.selectSlot")}</dt>
            <dd>{formatDateRange(sample, sampleEnd, locale)}</dd>

            <dt className="text-muted-foreground">riyadhWeekday()</dt>
            <dd>{formatNumber(riyadhWeekday(sample), locale)}</dd>
          </dl>
        </CardContent>
      </Card>
    </main>
  );
}
