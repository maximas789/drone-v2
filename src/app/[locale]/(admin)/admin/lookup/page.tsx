import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { LookupSearchBar } from "@/components/admin/lookup/search-bar";
import { QueueTabs } from "@/components/admin/queue-tabs";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ButtonLink } from "@/components/ui/button-link";
import { ProposalNotice } from "@/components/proposal-notice";
import { requireReviewer } from "@/lib/auth-guards";
import { countPendingReviews } from "@/lib/data/review";
import { formatNumber } from "@/lib/format";
import { toLocale } from "@/lib/locale";
import { isAdmin } from "@/lib/session";

/**
 * `/admin/lookup` — the compliance spot-check.
 *
 * The queues answer *"what is waiting"* and the directory answers *"who is this
 * person"*. This answers the question asked **in a field, beside an aircraft**:
 * an officer has a Remote ID — scanned, read aloud, or half-remembered — and
 * needs a registration, an owner and whether the thing overhead is authorised
 * to be there right now. It is the enforcement half of the Remote ID
 * proposition, and it is what makes the pitch complete rather than pilot-only.
 *
 * **Nothing is rendered on the server but the chrome.** There is no initial
 * list and there is no `searchParams` — a lookup term may be a national ID, and
 * a term in a URL is a term in the address bar, the history and the access log.
 * Every result arrives through `lookupAction`, which is a POST.
 *
 * **Reviewer, not admin.** Looking a drone up is the job; `/admin/reveals`,
 * which watches who has been looking, is the admin-only surface.
 */
export default async function AdminLookupPage() {
  const locale = toLocale(await localeParam());
  const session = await requireReviewer();
  const t = await getTranslations();
  const tLookup = await getTranslations("lookup");

  const counts = await countPendingReviews(session);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{tLookup("title")}</h1>
          <p className="text-muted-foreground text-sm">{tLookup("intro")}</p>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <SignOutButton />
        </div>
      </header>

      <ProposalNotice />

      <QueueTabs
        active="lookup"
        droneCount={formatNumber(counts.drones, locale)}
        bookingCount={formatNumber(counts.bookings, locale)}
      />

      {/*
        Every search is written to the audit trail, and the officer is told so
        on the screen where they do it. The oversight page is one click away
        for whoever may read it — and only for them: `requireAdmin` answers a
        reviewer with a 404, so the link is drawn only where it leads somewhere.
        The zones tab makes the opposite call for a tab strip that cannot see
        the session; this page already has it.
      */}
      <p className="text-muted-foreground text-sm">{tLookup("loggingNotice")}</p>

      <LookupSearchBar locale={locale} />

      <div className="flex flex-wrap gap-2">
        {isAdmin(session) ? (
          <ButtonLink variant="outline" href="/admin/reveals">
            {tLookup("revealsLink")}
          </ButtonLink>
        ) : null}
        <ButtonLink variant="outline" href="/dashboard">
          {t("dashboard.title")}
        </ButtonLink>
      </div>
    </main>
  );
}
