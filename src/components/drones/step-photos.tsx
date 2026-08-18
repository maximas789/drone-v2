"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { FileDropzone } from "@/components/upload/file-dropzone";
import { PhotoGrid, type PhotoRow } from "@/components/upload/photo-grid";
import type { Problems } from "@/components/form/field";
import type { Locale } from "@/lib/locale";

/**
 * Step 4: photographs.
 *
 * **F07's components, unchanged.** The dropzone and the grid already handle the
 * upload, the refusals, the reordering and the delete — writing a second
 * uploader here would be two places that disagree about what a valid file is.
 *
 * The one seam: `FileDropzone` reports an uploaded *file* (url, pathname, type,
 * size) and `PhotoGrid` renders `drone_photo` *rows*, which carry an id the
 * upload response does not. So a successful upload refreshes the route and the
 * page hands the grid the rows the database actually holds. Inventing a local
 * id would put a row in the grid that no delete could ever address.
 */
export function StepPhotos({
  droneId,
  photos,
  problems,
  locale,
}: {
  droneId: string;
  photos: PhotoRow[];
  problems: Problems;
  locale: Locale;
}) {
  const t = useTranslations("drones");
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <FileDropzone
        kind="overall"
        targetId={droneId}
        locale={locale}
        onUploaded={() => router.refresh()}
      />

      <PhotoGrid droneId={droneId} photos={photos} locale={locale} />

      {/**
       * **The refusal, not just the standing hint.** Submitting with no photos
       * sends the pilot back to this pane — but landing on a pane whose text has
       * not changed reads as the button having done nothing. Found by pressing
       * submit with an empty grid and watching exactly that.
       */}
      {problems.has("photo_required") ? (
        <p role="alert" className="text-destructive text-sm">
          {t("errors.photo_required")}
        </p>
      ) : null}

      <p className="text-muted-foreground text-xs">{t("photosRequired")}</p>
    </div>
  );
}
