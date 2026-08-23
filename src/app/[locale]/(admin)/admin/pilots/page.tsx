import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { PilotSearch } from "@/components/admin/pilot-search";
import { QueueTabs } from "@/components/admin/queue-tabs";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ButtonLink } from "@/components/ui/button-link";
import { ProposalNotice } from "@/components/proposal-notice";
import { requireReviewer } from "@/lib/auth-guards";
import { countPendingReviews, searchPilots } from "@/lib/data/review";
import { formatNumber } from "@/lib/format";
import { toLocale } from "@/lib/locale";
import type { Metadata } from "next";
import { privatePageTitle } from "@/lib/site/metadata";

/**
 * `/admin/pilots` — the directory behind the queues.
 *
 * The two queues answer *"what is waiting"*; this answers *"who is this
 * person"* — the question a reviewer asks when a name recurs, when a report
 * names an aircraft, or when an identity needs checking before any submission
 * exists to hang it on.
 *
 * **The first page is server-rendered and the search is a POST.** The list
 * arrives without JavaScript; the search box is a client component that calls
 * `searchPilotsAction` rather than submitting a GET, because the term may be a
 * national ID and personal data must never reach a URL. `PilotSearch` carries
 * the full reasoning.
 *
 * **Unverified first, then oldest** — the ordering is in `searchPilots`. A
 * directory sorted by name would bury a pilot who has been waiting a fortnight
 * behind everyone whose name begins with alif.
 */
export default async function AdminPilotsPage() {
  const locale = toLocale(await localeParam());
  const session = await requireReviewer();
  const t = await getTranslations();
  const tReview = await getTranslations("review");

  const [initial, counts] = await Promise.all([
    searchPilots(session, ""),
    countPendingReviews(session),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{tReview("pilotsTitle")}</h1>
          <p className="text-muted-foreground text-sm">
            {tReview("pilotsIntro")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <SignOutButton />
        </div>
      </header>

      <ProposalNotice />

      <QueueTabs
        active="pilots"
        droneCount={formatNumber(counts.drones, locale)}
        bookingCount={formatNumber(counts.bookings, locale)}
      />

      <PilotSearch initialRows={initial.rows} locale={locale} />

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
}: PageProps<"/[locale]/admin/pilots">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "review.pilotsTitle");
}
