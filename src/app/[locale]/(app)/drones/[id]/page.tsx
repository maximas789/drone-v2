import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { DroneSpecTable } from "@/components/drones/spec-table";
import { DroneStatusBadge } from "@/components/drones/status-badge";
import { DroneStatusPanel } from "@/components/drones/status-panel";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth-guards";
import { getMyDroneDetail } from "@/lib/data/drone";
import { toLocale } from "@/lib/locale";
import { isDroneEditable } from "@/lib/validation/drone";
import type { Metadata } from "next";
import { privatePageTitle } from "@/lib/site/metadata";

/**
 * `/drones/[id]` — one aircraft, and what its status means.
 *
 * **`getMyDroneDetail`, not `getDroneById`.** The latter also answers for a
 * reviewer, and this page offers Submit, Edit, Renew and Delete: a reviewer
 * opening somebody else's aircraft here would be handed the owner's controls
 * over a registration that is not theirs. Reviewing is F22's job with F22's
 * screen. So a drone that is not yours 404s, whoever you are — and "not yours"
 * and "does not exist" answer identically, because distinguishing them lets
 * anyone holding an id learn whether it is real.
 *
 * `notFound()` rather than a redirect: the id is in the URL and a wrong one is
 * a wrong URL, which is what a 404 is for.
 */
export default async function DroneDetailPage({
  params,
}: PageProps<"/[locale]/drones/[id]">) {
  const locale = toLocale(await localeParam());
  const session = await requireUser(locale);
  const t = await getTranslations("drones");

  const { id } = await params;
  const detail = await getMyDroneDetail(session, id);
  if (!detail) notFound();

  const { drone, photos, remoteId } = detail;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <Link href="/drones" className="text-muted-foreground text-sm underline">
          {t("backToList")}
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">{drone.nickname}</h1>
        <DroneStatusBadge status={drone.status} />
      </header>

      <DroneStatusPanel
        drone={drone}
        remoteIdCode={remoteId?.code ?? null}
        photoCount={photos.length}
        locale={locale}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("detailsHeading")}</h2>
        <DroneSpecTable drone={drone} locale={locale} />
        {isDroneEditable(drone.status) ? (
          <div>
            <Link
              href={`/drones/${drone.id}/edit`}
              className="text-sm underline"
            >
              {t("editDetails")}
            </Link>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("photosHeading")}</h2>
        {photos.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noPhotos")}</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {photos.map((photo) => (
              <li key={photo.id}>
                {/**
                 * A plain `<img>`, as on the list card. The bytes stream
                 * through `/api/files/…`, which re-checks ownership on every
                 * request; `next/image` would need that route in
                 * `remotePatterns` and would then cache an owner-scoped
                 * photograph at the edge, where the check no longer runs.
                 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={t(`photoKinds.${photo.kind}`)}
                  className="size-28 rounded-md object-cover"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

/**
 * Its own tab title, from the same string this page renders as its heading.
 * `robots` comes from the route group's layout — see `PRIVATE_ROBOTS`.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/drones/[id]">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "drones.title");
}
