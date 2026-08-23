import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { DroneCard } from "@/components/drones/card";
import { ButtonLink } from "@/components/ui/button-link";
import { requireUser } from "@/lib/auth-guards";
import { listMyDrones } from "@/lib/data/drone";
import { listPhotoAndRemoteIdForDrones } from "@/lib/data/drone";
import { toLocale } from "@/lib/locale";
import type { Metadata } from "next";
import { privatePageTitle } from "@/lib/site/metadata";

/**
 * `/drones` — the pilot's own aircraft, and nobody else's.
 *
 * `listMyDrones` filters on the session's user id, so the scoping lives in
 * `src/lib/data/` where rule 8 says it does. There is no route parameter here
 * through which another pilot's list could be named.
 *
 * No header of its own — the shell in `(app)/layout.tsx` holds the bell, the
 * locale switcher and sign-out.
 */
export default async function DronesPage() {
  const locale = toLocale(await localeParam());
  const session = await requireUser(locale);
  const t = await getTranslations("drones");

  const drones = await listMyDrones(session);
  const extras = await listPhotoAndRemoteIdForDrones(
    session,
    drones.map((row) => row.id),
  );

  /**
   * The 30-day expiry flag arrives from the data layer as a boolean. Reading the
   * clock during a render is impure — eslint's `react-hooks/purity` rule catches
   * it — and a component that did would render one way on the server and another
   * in the browser the moment the boundary fell between the two.
   */

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <ButtonLink href="/drones/new">{t("addDrone")}</ButtonLink>
      </header>

      {drones.length === 0 ? (
        /**
         * **A real invitation, and it names the serial-less case.** An empty
         * panel saying "no drones yet" would waste the one screen where the
         * product can say what it is for — the pilot most likely to be here is
         * the one who could not register anywhere else.
         */
        <section className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
          <h2 className="text-lg font-medium">{t("emptyTitle")}</h2>
          <p className="text-muted-foreground text-sm">{t("emptyBody")}</p>
          <ButtonLink href="/drones/new">{t("addDrone")}</ButtonLink>
        </section>
      ) : (
        <ul className="flex flex-col gap-4">
          {drones.map((row) => {
            const extra = extras[row.id];
            return (
              <DroneCard
                key={row.id}
                locale={locale}
                drone={row}
                photoUrl={extra?.photoUrl ?? null}
                remoteIdCode={extra?.remoteIdCode ?? null}
                expiringSoon={extra?.expiringSoon ?? false}
              />
            );
          })}
        </ul>
      )}
    </main>
  );
}

/**
 * Its own tab title, from the same string this page renders as its heading.
 * `robots` comes from the route group's layout — see `PRIVATE_ROBOTS`.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/drones">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "drones.title");
}
