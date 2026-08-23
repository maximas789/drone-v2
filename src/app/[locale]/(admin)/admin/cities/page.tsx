import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { CityForm } from "@/components/admin/city-form";
import { QueueTabs } from "@/components/admin/queue-tabs";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { ProposalNotice } from "@/components/proposal-notice";
import { requireAdmin } from "@/lib/auth-guards";
import { countPendingReviews } from "@/lib/data/review";
import { listCitiesWithZoneCounts } from "@/lib/data/zone-admin";
import { formatNumber } from "@/lib/format";
import { toLocale } from "@/lib/locale";
import type { Metadata } from "next";
import { privatePageTitle } from "@/lib/site/metadata";

/**
 * `/admin/cities` — **what turns an unmodelled city into a drawable one.**
 *
 * A zone belongs to a city, so this short list is the constraint on where
 * anything can be drawn at all. The seed ships six Saudi cities and only Riyadh
 * carries `isModelled: true`; the zone count beside each row is what makes that
 * flag checkable rather than a claim somebody set once.
 *
 * **Nothing here edits or deletes a city.** A city is referenced by every zone
 * drawn in it, and renaming one silently rewrites the name on a published map
 * and in every booking confirmation that has already gone out. Deleting one is
 * refused by the database anyway. Adding is the act this feature needs; the
 * other two are not written rather than written and disabled.
 */
export default async function AdminCitiesPage() {
  const locale = toLocale(await localeParam());
  const session = await requireAdmin();
  const t = await getTranslations("cityAdmin");
  const tReview = await getTranslations("review");

  const [cities, counts] = await Promise.all([
    listCitiesWithZoneCounts(session),
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

      <ProposalNotice />

      <QueueTabs
        active="zones"
        droneCount={formatNumber(counts.drones, locale)}
        bookingCount={formatNumber(counts.bookings, locale)}
      />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">{t("title")}</caption>
          <thead className="bg-muted/50">
            <tr>
              <Th>{t("colCity")}</Th>
              <Th>{t("colCentroid")}</Th>
              <Th>{t("colZones")}</Th>
              <Th>{t("colModelled")}</Th>
            </tr>
          </thead>
          <tbody>
            {cities.map((row) => (
              <tr key={row.id} className="border-t align-top">
                <Td>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">
                      {locale === "ar" ? row.nameAr : row.nameEn}
                    </span>
                    <span
                      dir="ltr"
                      className="text-muted-foreground font-mono text-xs"
                    >
                      {row.code}
                    </span>
                  </div>
                </Td>
                {/*
                  `dir="ltr"` is safe here and only here: a bare coordinate pair
                  carries no strong RTL run to reorder. Anything with a formatted
                  Arabic date in it takes `<bdi>` instead.
                */}
                <Td>
                  <span dir="ltr" className="font-mono text-xs">
                    {row.centroidLat.toFixed(4)}, {row.centroidLng.toFixed(4)}
                  </span>
                </Td>
                <Td>{formatNumber(row.zoneCount, locale)}</Td>
                <Td>
                  {row.isModelled ? (
                    <Badge>{t("modelledYes")}</Badge>
                  ) : (
                    <span className="text-muted-foreground">
                      {t("modelledNo")}
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground text-sm">{t("modelledHint")}</p>

      <CityForm locale={locale} />

      <ButtonLink variant="outline" href="/admin/zones">
        {tReview("tabZones")}
      </ButtonLink>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="text-muted-foreground p-3 text-start font-medium">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="p-3 text-start">{children}</td>;
}

/**
 * Its own tab title, from the same string this page renders as its heading.
 * `robots` comes from the route group's layout — see `PRIVATE_ROBOTS`.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/cities">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "cityAdmin.title");
}
