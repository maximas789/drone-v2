import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { ProposalNotice } from "@/components/proposal-notice";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import {
  countRevealsByReviewer,
  listIdentityReveals,
} from "@/lib/data/audit";
import { formatDateTime, formatNumber } from "@/lib/format";
import { toLocale } from "@/lib/locale";
import { isRole } from "@/lib/session";
import type { Metadata } from "next";
import { privatePageTitle } from "@/lib/site/metadata";

/**
 * `/admin/reveals` — who has been unmasking whom, and why.
 *
 * **Admin only.** A reviewer may reveal an identity; only an administrator may
 * watch the reveals. That asymmetry is the whole feature: a power exercised in
 * the belief that nobody is looking is a different power from one exercised
 * knowing the reason will be read, and a reviewer who could see this page would
 * know exactly how much scrutiny their own reveals were getting.
 *
 * **The count comes before the list, and the ordering is the point.** A list
 * sorted by time answers *"what happened"*; it does not answer *"is somebody
 * revealing forty identities a week"*, which is the question an administrator
 * is actually here to ask. The rolling 30-day count per reviewer, highest
 * first, is what makes an unusual pattern visible rather than buried under
 * three screens of individually reasonable rows.
 *
 * **A filter that is a link.** Unlike the lookup box, a reviewer's *user id* is
 * not personal data about a member of the public, so this one is an ordinary
 * GET — an administrator can send a colleague "here is what this reviewer has
 * been doing", and the back button works.
 *
 * Nothing on this page carries a name or a document number of anyone who was
 * revealed. The audit table deliberately holds neither, and this screen must
 * not become the place they reappear.
 */
export default async function AdminRevealsPage({
  searchParams,
}: PageProps<"/[locale]/admin/reveals">) {
  const locale = toLocale(await localeParam());
  const session = await requireAdmin();
  const t = await getTranslations();
  const tLookup = await getTranslations("lookup");
  const tReview = await getTranslations("review");
  const tRoles = await getTranslations("roles");

  const params = await searchParams;
  const raw = params.reviewer;
  /**
   * Narrowed to a single string before it reaches a query, like every other
   * URL filter in this build: `?reviewer=a&reviewer=b` arrives as an array,
   * and an array reaching an `eq()` is a runtime error on an admin screen.
   */
  const reviewerFilter = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);

  const [rows, counts] = await Promise.all([
    listIdentityReveals(session, reviewerFilter),
    countRevealsByReviewer(session),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{tLookup("revealsTitle")}</h1>
          <p className="text-muted-foreground text-sm">
            {tLookup("revealsIntro")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <SignOutButton />
        </div>
      </header>

      <ProposalNotice />

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{tLookup("revealsWindowTitle")}</h2>
        {counts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {tLookup("revealsWindowEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {counts.map((row) => (
              <li
                key={row.reviewerUserId}
                className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {row.reviewerName ?? tLookup("reviewerUnknown")}
                  </span>
                  {row.reviewerEmail ? (
                    <span dir="ltr" className="text-muted-foreground text-xs">
                      {row.reviewerEmail}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {/*
                    A pre-formatted string, never a bare number in an ICU
                    message: next-intl formats a numeric argument under the page
                    locale and would render `٣` on the Arabic page (thread 22).
                  */}
                  <Badge>
                    {tLookup("revealsCount", {
                      count: formatNumber(row.count, locale),
                    })}
                  </Badge>
                  <Link
                    href={`/admin/reveals?reviewer=${encodeURIComponent(row.reviewerUserId)}`}
                    className="text-sm underline"
                  >
                    {tLookup("revealsFilterTo")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">{tLookup("revealsListTitle")}</h2>
          {reviewerFilter ? (
            /* The reset is a genuine anchor styled as a button — `ButtonLink`,
               never `Button render={<Link/>}`: Base UI's Button expects a real
               `<button>` and its escape hatch puts `role="button"` on the
               `<a>`, so a screen reader announces a navigation as a button. */
            <ButtonLink variant="ghost" size="sm" href="/admin/reveals">
              {tReview("filterReset")}
            </ButtonLink>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {reviewerFilter
              ? tLookup("revealsFilteredEmpty")
              : tLookup("revealsEmpty")}
          </p>
        ) : (
          <ol className="flex flex-col gap-4">
            {rows.map((row) => (
              <li key={row.id} className="border-s-2 ps-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">
                    {row.reviewerName ?? tLookup("reviewerUnknown")}
                  </span>
                  {isRole(row.reviewerRole) ? (
                    /*
                      The role **at the time**, from the row — never a join to
                      the account's current role. A reviewer later promoted must
                      not retroactively appear to have acted as an admin.

                      Through `isRole`, not straight into the catalogue:
                      `actorRole` is `text`, and a row left by a role this build
                      no longer has must not take the oversight page down with a
                      missing key.
                    */
                    <Badge variant="outline">{tRoles(row.reviewerRole)}</Badge>
                  ) : null}
                  {/*
                    `formatDateTime` puts an Arabic month name between Latin
                    numerals. `dir="ltr"` would set the whole run backwards;
                    `<bdi>` isolates it without imposing a direction.
                  */}
                  <bdi className="text-muted-foreground text-sm">
                    {formatDateTime(row.createdAt, locale)}
                  </bdi>
                </div>

                <p className="text-sm">
                  {row.targetCode ? (
                    <span dir="ltr" className="font-mono">
                      {row.targetCode}
                    </span>
                  ) : (
                    /* The profile-keyed reveal has no code — a `pending`
                       registration has no Remote ID at all. Saying so is
                       better than an empty cell that reads as a fault. */
                    <span className="text-muted-foreground">
                      {tLookup("revealsNoCode")}
                    </span>
                  )}
                </p>

                {row.reason ? (
                  /* Verbatim, and `dir="auto"`: a reviewer's sentence is the
                     one string on this page whose direction is not the
                     page's. Without it an Arabic reason sets its full stop at
                     the wrong end on `/en`. */
                  <p dir="auto" className="text-muted-foreground mt-1 text-sm">
                    {row.reason}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <ButtonLink variant="outline" href="/admin/lookup">
          {tLookup("title")}
        </ButtonLink>
        <ButtonLink variant="outline" href="/dashboard">
          {t("dashboard.title")}
        </ButtonLink>
      </div>
    </main>
  );
}

/**
 * Its own tab title, from the same string this page renders as its heading.
 * `robots` comes from the route group's layout — see `PRIVATE_ROBOTS`.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/reveals">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "lookup.revealsTitle");
}
