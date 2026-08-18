import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { DroneEditor } from "@/components/drones/editor";
import { StepPhotos } from "@/components/drones/step-photos";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth-guards";
import { getMyDroneDetail } from "@/lib/data/drone";
import { toLocale } from "@/lib/locale";
import { isDroneEditable, type BuildType } from "@/lib/validation/drone";

/**
 * `/drones/[id]/edit` — correcting an aircraft's details.
 *
 * Two statuses reach this page: `draft`, and `rejected`. **A rejection that
 * cannot be answered is a dead end**, which is the one thing F18 says this flow
 * must never be — so the fields a reviewer queried are the fields the pilot can
 * change, and the photographs with them.
 *
 * `pending` 404s here rather than rendering a disabled form. A form the pilot
 * can fill in and not submit is worse than no form: it invites the work and
 * then refuses it. The status is re-checked in `saveDroneDraftAction` too,
 * because this page not rendering is not a check — the action is an ordinary
 * POST, and F18a proved that refusal over HTTP.
 */
export default async function EditDronePage({
  params,
}: PageProps<"/[locale]/drones/[id]/edit">) {
  const locale = toLocale(await localeParam());
  const session = await requireUser(locale);
  const t = await getTranslations("drones");

  const { id } = await params;
  const detail = await getMyDroneDetail(session, id);
  if (!detail) notFound();

  const { drone, photos } = detail;
  if (!isDroneEditable(drone.status)) notFound();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <Link
          href={`/drones/${drone.id}`}
          className="text-muted-foreground text-sm underline"
        >
          {t("backToDrone")}
        </Link>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
        <p className="text-muted-foreground text-sm">
          {drone.status === "rejected" ? t("editIntroRejected") : t("editIntro")}
        </p>
      </header>

      <DroneEditor
        droneId={drone.id}
        locale={locale}
        initial={{
          nickname: drone.nickname,
          buildType: drone.buildType as BuildType,
          manufacturer: drone.manufacturer ?? "",
          model: drone.model ?? "",
          propulsion: drone.propulsion ?? "",
          weightGrams: String(drone.weightGrams),
          hasCamera: drone.hasCamera,
          serialNumber: drone.serialNumber ?? "",
        }}
      />

      {/**
       * Photographs are edited **on this page too**, and saved as they change
       * rather than by the form's button. F07's upload route and delete action
       * each commit on their own — a dropzone that queued files until a Save
       * press would be a second, divergent upload path, and the one thing a
       * rejection most often asks for is a clearer photograph.
       */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">{t("photosHeading")}</h2>
        <StepPhotos
          droneId={drone.id}
          locale={locale}
          photos={photos.map((photo) => ({
            id: photo.id,
            url: photo.url,
            kind: photo.kind,
            sortOrder: photo.sortOrder,
          }))}
        />
      </section>
    </main>
  );
}
