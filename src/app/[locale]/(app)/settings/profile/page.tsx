import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { MaskedId } from "@/components/profile/masked-id";
import { RevealOwnId } from "@/components/profile/reveal-own-id";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { VerificationStatus } from "@/components/profile/verification-status";
import { requirePilotProfile } from "@/lib/auth-guards";
import { getMyProfileWithCity, listCities } from "@/lib/data/pilot";
import { formatDate } from "@/lib/format";
import { toLocale } from "@/lib/locale";
import type { Metadata } from "next";
import { privatePageTitle } from "@/lib/site/metadata";

/**
 * `/settings/profile` — the pilot's own view of their identity, and the edit path.
 *
 * **This is the first shipped caller of `requirePilotProfile` with a `next`.** An
 * incomplete profile cannot be *edited* into completeness field by field — the
 * wizard is the surface that knows what is still missing — so this page sends
 * them there and the wizard sends them back. F18's `/drones/new` will be the
 * second caller and does not exist yet, which is why this is the pair that can
 * actually be driven end to end today.
 *
 * **Nothing here shows a whole document number.** `MaskedId` renders F11's one
 * masker, for the owner as much as for anybody else, and the identity form opens
 * empty rather than pre-filled. So there is no branch on this page that could
 * display the full value, which is what makes "no screen displays a full national
 * ID without a logged reveal" a property rather than a promise.
 *
 * The reviewer's view of this data, and the Reveal control that goes with it, are
 * **F22's** — this page is the pilot's side only.
 */
export default async function ProfileSettingsPage() {
  const locale = toLocale(await localeParam());
  // Redirects to `/profile/complete?next=/settings/profile` when the profile is
  // missing or incomplete. It calls `requireUser` itself, so there is no second
  // guard here — but the guard *is* repeated relative to the layout, because a
  // page that reads a session should say so.
  const { session } = await requirePilotProfile(locale, "/settings/profile");
  const t = await getTranslations("profile");

  const [profile, cities] = await Promise.all([
    getMyProfileWithCity(session),
    listCities(session),
  ]);

  // The guard above already redirected if this were missing. Narrowing rather
  // than asserting, because a non-null assertion here would be a claim about
  // another function's behaviour that the compiler cannot check.
  if (!profile) return null;

  return (
    /**
     * **No `<main>` and no `<h1>` here any more.** F28a put a settings layout
     * above this page: it owns the page heading and the section nav, and a
     * second `<main>` inside the first would give the document two main
     * landmarks — which a screen reader reports as an error, not as structure.
     */
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{t("editTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("editIntro")}</p>
      </header>

      <VerificationStatus
        verifiedAt={profile.verifiedAt}
        rejectedAt={profile.rejectedAt}
        rejectionReason={profile.rejectionReason}
        locale={locale}
      />

      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-sm font-medium">{t("personalInfo")}</h2>
        <dl className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-xs">{t("fullNameAr")}</dt>
            <dd dir="rtl" lang="ar" className="text-sm">
              {profile.fullNameAr}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-xs">{t("fullNameEn")}</dt>
            <dd dir="ltr" lang="en" className="text-start text-sm">
              {profile.fullNameEn}
            </dd>
          </div>

          <div className="flex flex-col gap-2">
            <MaskedId
              number={profile.idDocumentNumber}
              documentType={profile.idDocumentType}
            />
            {/**
             * **The mask stays.** The reveal is a second, deliberate act that
             * writes its audit row before it returns anything — so this page
             * still has no branch that renders a whole document number without
             * one, which is the property `MaskedId` is written around.
             */}
            <RevealOwnId locale={locale} />
          </div>

          {profile.dateOfBirth ? (
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-xs">
                {t("dateOfBirth")}
              </dt>
              <dd className="text-sm">
                {/* `date` columns come back as `YYYY-MM-DD` strings. Read at
                    noon UTC so the Riyadh (+3) rendering lands on the same
                    calendar day — midnight would fall on the day before for any
                    negative-offset formatter. */}
                {formatDate(new Date(`${profile.dateOfBirth}T12:00:00Z`), locale)}
              </dd>
            </div>
          ) : null}

          {profile.city ? (
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-xs">{t("cityLabel")}</dt>
              <dd className="text-sm">
                {locale === "ar" ? profile.city.nameAr : profile.city.nameEn}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <ProfileEditor
        locale={locale}
        isVerified={profile.verifiedAt !== null}
        identity={{
          fullNameAr: profile.fullNameAr,
          fullNameEn: profile.fullNameEn,
          idDocumentType: profile.idDocumentType,
        }}
        contact={{
          mobileE164: profile.mobileE164 ?? "",
          addressCityId: profile.addressCityId ?? "",
          addressLine: profile.addressLine ?? "",
          emergencyContact: profile.emergencyContact ?? "",
        }}
        cities={cities.map((city) => ({
          id: city.id,
          nameAr: city.nameAr,
          nameEn: city.nameEn,
        }))}
      />
    </section>
  );
}

/**
 * Its own tab title, from the same string this page renders as its heading.
 * `robots` comes from the route group's layout — see `PRIVATE_ROBOTS`.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/settings/profile">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "settings.profile.title");
}
