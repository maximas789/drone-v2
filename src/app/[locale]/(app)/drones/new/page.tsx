import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { DroneWizard } from "@/components/drones/wizard";
import { requirePilotProfile } from "@/lib/auth-guards";
import { getDroneById, getDronePhotos } from "@/lib/data/drone";
import { toLocale } from "@/lib/locale";
import type { BuildType } from "@/lib/validation/drone";

/**
 * `/drones/new` — registering an aircraft.
 *
 * **`requirePilotProfile` with a `next`, which is the second caller F17 built
 * that parameter for.** A pilot with no complete profile is sent to the wizard
 * and returned here afterwards. The guard is the reason a pilot can never reach
 * the submission gate only to be refused with `profile_incomplete` — although
 * the gate still checks, because the action is reachable without this page ever
 * rendering.
 *
 * The draft id lives in the **query string**, not in client state: a closed tab,
 * a refresh, or an upload that refreshes the route all return to the same draft
 * rather than starting a second one for the same aircraft.
 */
export default async function NewDronePage({
  searchParams,
}: PageProps<"/[locale]/drones/new">) {
  const locale = toLocale(await localeParam());
  const { session } = await requirePilotProfile(locale, "/drones/new");
  const t = await getTranslations("drones");

  const { draft } = await searchParams;
  const draftId = typeof draft === "string" ? draft : null;

  /**
   * The draft is re-read through the ownership-scoped reader, so a `?draft=` id
   * belonging to somebody else resolves to nothing and the wizard simply starts
   * fresh — it never renders another pilot's aircraft.
   *
   * A draft that has already been submitted is treated the same way: `pending`
   * is read-only, and F18b owns the screen that says so.
   */
  const existing = draftId ? await getDroneById(session, draftId) : null;
  const editable =
    existing && existing.ownerUserId === session.user.id && existing.status === "draft"
      ? existing
      : null;
  const photos = editable ? await getDronePhotos(session, editable.id) : [];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("newTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("newIntro")}</p>
      </header>

      <DroneWizard
        locale={locale}
        draftId={editable?.id ?? null}
        photos={photos.map((photo) => ({
          id: photo.id,
          url: photo.url,
          kind: photo.kind,
          sortOrder: photo.sortOrder,
        }))}
        initial={{
          nickname: editable?.nickname ?? "",
          buildType: (editable?.buildType as BuildType | undefined) ?? "",
          manufacturer: editable?.manufacturer ?? "",
          model: editable?.model ?? "",
          propulsion: editable?.propulsion ?? "",
          weightGrams: editable ? String(editable.weightGrams) : "",
          hasCamera: editable?.hasCamera ?? false,
          serialNumber: editable?.serialNumber ?? "",
        }}
      />
    </main>
  );
}
