import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { ProfileWizard } from "@/components/profile/wizard";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth-guards";
import { getMyProfile, listCities } from "@/lib/data/pilot";
import { toLocale } from "@/lib/locale";
import { isInternalPath } from "@/lib/url";
import type { Metadata } from "next";
import { privatePageTitle } from "@/lib/site/metadata";

/**
 * `/profile/complete` — **the page open thread 13 was about.**
 *
 * `requirePilotProfile` has redirected here since F05 and nothing was here to
 * land on. Everything in Wave 6 is dead for a real pilot until it is: F14's
 * `submitDrone` refuses with `profile_incomplete` until a profile has
 * `completedAt`, and F12's engine emits `pilot_profile_incomplete` and
 * `identity_unverified`.
 *
 * **`requireUser`, not `requirePilotProfile`.** Guarding this page with the guard
 * that redirects *to* this page is an infinite redirect, and the two are one line
 * apart in the same file — worth saying out loud so nobody tidies it.
 *
 * No header of its own: the shell in `(app)/layout.tsx` holds the bell, the locale
 * switcher and sign-out. Growing a second one on the page was F15's one real
 * defect and it went past all five checks.
 */
export default async function CompleteProfilePage({
  searchParams,
}: PageProps<"/[locale]/profile/complete">) {
  const locale = toLocale(await localeParam());
  const session = await requireUser(locale);
  const t = await getTranslations("profile");

  const { next: nextParam } = await searchParams;
  const requested = typeof nextParam === "string" ? nextParam : null;
  /**
   * Validated **here**, not trusted from the query string. `isInternalPath` is
   * the same function the guard used to build the parameter — an open redirect
   * on a URL the app itself hands out is a phishing primitive, and a locale
   * prefix would be double-prefixed by next-intl and 404.
   */
  const next = requested && isInternalPath(requested) ? requested : "/dashboard";

  const [profile, cities] = await Promise.all([
    getMyProfile(session),
    listCities(session),
  ]);

  /**
   * Already a pilot. Send them on rather than showing a wizard for work that is
   * done — and honour `?next=` if they arrived with one, because the reason they
   * were sent here has been satisfied.
   */
  if (profile?.completedAt) {
    redirect({ href: next === "/dashboard" ? "/settings/profile" : next, locale });
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("completeTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("completeIntro")}</p>
      </header>

      <ProfileWizard
        locale={locale}
        cities={cities.map((city) => ({
          id: city.id,
          nameAr: city.nameAr,
          nameEn: city.nameEn,
        }))}
        hasIdentity={Boolean(profile)}
        next={next}
        initial={{
          fullNameAr: profile?.fullNameAr ?? "",
          fullNameEn: profile?.fullNameEn ?? "",
          idDocumentType: profile?.idDocumentType ?? "saudi_national_id",
          /**
           * **Never the stored number.** A saved identity document does not
           * travel back to the browser, not even to its owner — the mask is what
           * the owner sees, and a form field holding the whole value would be a
           * screen displaying it. Changing it means retyping it.
           */
          idDocumentNumber: "",
          dateOfBirth: profile?.dateOfBirth ?? "",
          mobileE164: profile?.mobileE164 ?? "",
          addressCityId: profile?.addressCityId ?? "",
          addressLine: profile?.addressLine ?? "",
          emergencyContact: profile?.emergencyContact ?? "",
        }}
      />
    </main>
  );
}

/**
 * Its own tab title, from the same string this page renders as its heading.
 * `robots` comes from the route group's layout — see `PRIVATE_ROBOTS`.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/profile/complete">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "profile.completeTitle");
}
