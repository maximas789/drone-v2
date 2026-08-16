"use server";

import { revalidatePath } from "next/cache";
import { refuse, refuseWith, type ActionResult } from "@/lib/actions/result";
import { getSession } from "@/lib/auth-guards";
import {
  deleteDronePhoto,
  listDroneFilePathnames,
  reorderDronePhotos,
} from "@/lib/data/upload";
import { enforceLimit } from "@/lib/rate-limit";
import { deleteFile } from "@/lib/storage";

/**
 * What the dropzone does besides uploading. The upload itself is a route
 * handler because it carries multipart bytes; everything else is an action.
 *
 * The guard is repeated in each one **on purpose**: an action is an ordinary
 * POST to a URL, invokable with `fetch` by anyone holding the action id, and
 * whatever layout guards the page it was rendered on never runs.
 */

/**
 * Removes the row **and** the bytes.
 *
 * Both, in that order, and the order matters: if the file delete fails after
 * the row is gone we have leaked a blob, which is bad — but if the row survived
 * a successful file delete, the app would show a photo that 404s, which is
 * worse and is not recoverable by retrying.
 */
export async function deleteDronePhotoAction(
  photoId: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");

  const limit = await enforceLimit("upload.request", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const removed = await deleteDronePhoto(session, photoId);
  // Not yours, not there, or the drone is no longer editable — one answer, so
  // the refusal cannot be used to find out which.
  if (!removed) return refuse("not_found");

  await deleteFile(removed.pathname);

  revalidatePath("/[locale]/drones", "page");
  return { ok: true, data: { id: photoId } };
}

export async function reorderDronePhotosAction(
  droneId: string,
  photoIdsInOrder: string[],
): Promise<ActionResult<undefined>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");

  const limit = await enforceLimit("upload.request", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  if (photoIdsInOrder.length > 50) return refuse("validation");

  const result = await reorderDronePhotos(session, droneId, photoIdsInOrder);
  if (!result.ok) {
    return result.reason === "not_found"
      ? refuse("not_found")
      : refuse("upload_target_locked");
  }

  revalidatePath("/[locale]/drones", "page");
  return { ok: true, data: undefined };
}

/**
 * Every stored file a drone owns, deleted.
 *
 * **Exported for F18's drone-delete action to call before it deletes the row.**
 * The `drone_photo` rows go by cascade; the bytes do not, and nothing in the
 * database will ever tell you they were left behind. Called after the row is
 * gone it would find nothing — which is exactly the leak.
 */
export async function deleteDroneFiles(
  droneId: string,
): Promise<ActionResult<{ deleted: number }>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");

  const pathnames = await listDroneFilePathnames(session, droneId);
  for (const pathname of pathnames) {
    await deleteFile(pathname);
  }

  return { ok: true, data: { deleted: pathnames.length } };
}
