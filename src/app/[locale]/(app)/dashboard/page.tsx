import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import {
  BookingRow,
  type BookingRowData,
} from "@/components/booking/booking-row";
import {
  ActionRequired,
  buildActions,
} from "@/components/dashboard/action-required";
import {
  DroneSummary,
  type DroneSummaryRow,
} from "@/components/dashboard/drone-summary";
import { NextFlight } from "@/components/dashboard/next-flight";
import { Onboarding, type OnboardingStep } from "@/components/dashboard/onboarding";
import { ButtonLink } from "@/components/ui/button-link";
import { Link } from "@/i18n/navigation";
import { riyadhYmd } from "@/lib/airspace/time";
import { countdownParts, formatCountdown } from "@/lib/dashboard/countdown";
import { requireUser } from "@/lib/auth-guards";
import {
  listMyPastBookings,
  listMyUpcomingBookings,
  listZoneAndRemoteIdForBookings,
} from "@/lib/data/booking";
import { listMyDrones, listPhotoAndRemoteIdForDrones } from "@/lib/data/drone";
import { getMyProfile } from "@/lib/data/pilot";
import { toLocale } from "@/lib/locale";
import { isReviewer } from "@/lib/session";
import type { Metadata } from "next";
import { privatePageTitle } from "@/lib/site/metadata";

/**
 * `/dashboard` — where a pilot lands, showing what is actually happening.
 *
 * **Wave 3's placeholder is gone.** It said hello and printed the account's
 * role; this reads the pilot's real state and answers the three questions they
 * arrive with: is anything blocking me, when am I next flying, and what do I
 * own.
 *
 * **Day one gets onboarding, not an empty grid.** A signed-up account with no
 * profile, no aircraft and no flights sees three numbered steps with the first
 * one live — because a page of empty cards reads as a broken product rather
 * than as a journey not yet started.
 *
 * **Every read is session-scoped**, through `src/lib/data/*`. Nothing on this
 * page can render another pilot's aircraft or flights, and the ownership is
 * answerable by reading that folder rather than this one.
 */

/** How many recent flights the summary shows before deferring to `/bookings`. */
const RECENT_LIMIT = 5;
/** Check-in opens a quarter of an hour early — F13's window, restated. */
const CHECK_IN_LEAD_MS = 15 * 60_000;

export default async function DashboardPage() {
  const locale = toLocale(await localeParam());
  // The guard runs in the layout too. Repeated here because this page reads the
  // session, and a page that needs a session should say so rather than trust
  // that something above it happened to check.
  const session = await requireUser(locale);
  const t = await getTranslations("dashboard");

  const now = new Date();
  const [profile, drones, upcoming, past] = await Promise.all([
    getMyProfile(session),
    listMyDrones(session),
    listMyUpcomingBookings(session, now),
    listMyPastBookings(session, now),
  ]);

  const droneMeta = await listPhotoAndRemoteIdForDrones(
    session,
    drones.map((drone) => drone.id),
    now,
  );

  const approvedUpcoming = upcoming.filter((row) => row.status === "approved");
  const nextFlight = approvedUpcoming[0] ?? null;

  const recent = [...upcoming, ...past]
    .sort((a, b) => b.slotStart.getTime() - a.slotStart.getTime())
    .slice(0, RECENT_LIMIT);

  const bookingContext = await listZoneAndRemoteIdForBookings(
    session,
    [...recent, ...(nextFlight ? [nextFlight] : [])].map((row) => row.id),
  );

  const profileComplete = Boolean(profile?.completedAt);
  const hasDrones = drones.length > 0;
  const hasBookings = upcoming.length + past.length > 0;

  /**
   * **Onboarding replaces the dashboard only while the journey is untouched.**
   * The moment a pilot owns an aircraft or a booking, the real cards are more
   * useful than the tutorial — and a tutorial that lingers is a tutorial people
   * learn to scroll past.
   */
  const dayOne = !hasDrones && !hasBookings;

  const expiring = drones
    .filter((drone) => droneMeta[drone.id]?.expiringSoon && drone.registrationExpiresAt)
    .sort(
      (a, b) =>
        (a.registrationExpiresAt?.getTime() ?? 0) -
        (b.registrationExpiresAt?.getTime() ?? 0),
    )[0];

  const today = riyadhYmd(now);
  const bookingToday =
    approvedUpcoming.find((row) => riyadhYmd(row.slotStart) === today) ?? null;

  const actions = buildActions({
    profileComplete,
    identityVerified: Boolean(profile?.verifiedAt),
    rejectedDroneCount: drones.filter((drone) => drone.status === "rejected").length,
    expiringSoon:
      expiring && expiring.registrationExpiresAt
        ? {
            nickname: expiring.nickname,
            expiresAt: expiring.registrationExpiresAt,
          }
        : null,
    bookingToday,
    locale,
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("welcome", { name: session.user.name })}
        </p>
      </header>

      <ActionRequired items={actions} />

      {dayOne ? (
        <Onboarding steps={onboardingSteps(profileComplete)} />
      ) : (
        <>
          {nextFlight ? (
            <NextFlight
              bookingId={nextFlight.id}
              zoneName={
                (locale === "ar"
                  ? bookingContext[nextFlight.id]?.zoneNameAr
                  : bookingContext[nextFlight.id]?.zoneNameEn) ?? ""
              }
              remoteIdCode={bookingContext[nextFlight.id]?.remoteIdCode ?? null}
              slotStart={nextFlight.slotStart.toISOString()}
              slotEnd={nextFlight.slotEnd.toISOString()}
              /**
               * Formatted here, on the server's clock, so the first paint
               * matches what the browser will render a moment later. See
               * `NextFlight` — the alternative is a hydration mismatch papered
               * over with `suppressHydrationWarning`.
               */
              initialCountdown={formatCountdown(
                countdownParts(nextFlight.slotStart.getTime() - now.getTime()),
                locale,
                t,
              )}
              checkInOpensAt={new Date(
                nextFlight.slotStart.getTime() - CHECK_IN_LEAD_MS,
              ).toISOString()}
              locale={locale}
            />
          ) : (
            <section className="flex flex-col gap-3 rounded-lg border p-5">
              <h2 className="text-lg font-medium">{t("nextFlight")}</h2>
              <p className="text-muted-foreground text-sm">{t("noUpcoming")}</p>
              <ButtonLink href="/bookings/new" size="sm" className="self-start">
                {t("bookAFlight")}
              </ButtonLink>
            </section>
          )}

          <DroneSummary drones={droneRows(drones, droneMeta)} locale={locale} />

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">{t("recentBookings")}</h2>
              <Link
                href="/bookings"
                className="text-sm underline underline-offset-4"
              >
                {t("seeAll")}
              </Link>
            </div>

            {recent.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noBookings")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {recent.map((row) => (
                  <BookingRow
                    key={row.id}
                    locale={locale}
                    booking={
                      {
                        id: row.id,
                        status: row.status,
                        slotStart: row.slotStart,
                        slotEnd: row.slotEnd,
                        zoneNameAr: bookingContext[row.id]?.zoneNameAr ?? null,
                        zoneNameEn: bookingContext[row.id]?.zoneNameEn ?? null,
                        remoteIdCode: bookingContext[row.id]?.remoteIdCode ?? null,
                      } satisfies BookingRowData
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("quickActions")}</h2>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/drones/new">{t("registerDrone")}</ButtonLink>
          <ButtonLink variant="outline" href="/zones">
            {t("openMap")}
          </ButtonLink>
          <ButtonLink variant="outline" href="/bookings/new">
            {t("bookAFlight")}
          </ButtonLink>
          {/**
           * The reviewer's door, and only for a reviewer. It was on the Wave 3
           * placeholder and stays — F22 builds what is behind it.
           */}
          {isReviewer(session) ? (
            <ButtonLink variant="outline" href="/admin">
              {t("adminArea")}
            </ButtonLink>
          ) : null}
        </div>
      </section>
    </main>
  );
}

/**
 * The three steps of the journey, with the live one carrying a link.
 *
 * Exactly one step is actionable at a time: registering an aircraft before the
 * profile is complete is a route F18's guard would bounce, and offering it
 * would be offering a door that closes in your face.
 */
function onboardingSteps(profileComplete: boolean): OnboardingStep[] {
  return [
    {
      key: "profile",
      done: profileComplete,
      href: profileComplete ? undefined : "/profile/complete?next=/dashboard",
    },
    {
      key: "drone",
      done: false,
      href: profileComplete ? "/drones/new" : undefined,
    },
    // Never live on day one: a booking needs an approved aircraft, and this
    // card disappears the moment one exists.
    { key: "book", done: false },
  ];
}

function droneRows(
  drones: Awaited<ReturnType<typeof listMyDrones>>,
  meta: Awaited<ReturnType<typeof listPhotoAndRemoteIdForDrones>>,
): DroneSummaryRow[] {
  return drones.map((drone) => ({
    id: drone.id,
    nickname: drone.nickname,
    status: drone.status,
    remoteIdCode: meta[drone.id]?.remoteIdCode ?? null,
    expiringSoon: meta[drone.id]?.expiringSoon ?? false,
    expiresAt: drone.registrationExpiresAt ?? null,
  }));
}

/**
 * Its own tab title, from the same string this page renders as its heading.
 * `robots` comes from the route group's layout — see `PRIVATE_ROBOTS`.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dashboard">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "dashboard.title");
}
