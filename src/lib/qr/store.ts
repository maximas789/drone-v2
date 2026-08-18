import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { remoteId } from "@/lib/db/schema";
import { qrPathnameFor, renderQrPng } from "@/lib/qr/render";
import { putFile } from "@/lib/storage";

/**
 * Render this code's QR, store the bytes, and record where they went.
 *
 * **The one path that writes `remote_id.qrPathname`.** Two callers need it —
 * F08's `qr-render` job on approval, and F19's retry when a pilot opens a card
 * whose QR is still missing — and a second copy of these four lines is exactly
 * the drift F11's single-projection rule exists to stop. `render.ts` stays the
 * pure encoder above it; this is the half that touches storage and the row, and
 * so it is the half that is `server-only`.
 *
 * **Idempotent by construction.** `qrPathnameFor` is a function of the code
 * alone, so re-rendering overwrites in place and the pathname does not move — a
 * sticker already on an airframe keeps pointing at the same object. Nothing
 * here mints a second file, and nothing here changes the payload: that is
 * `qrPayloadUrl`, which reads `APP_URL`. Re-running after `APP_URL` changes is
 * therefore how a fleet of dead stickers gets fixed.
 */
export async function storeQrForRemoteId({
  remoteIdId,
  code,
}: {
  remoteIdId: string;
  code: string;
}): Promise<string> {
  const png = await renderQrPng(code);

  const file = await putFile({
    buffer: png,
    filename: qrPathnameFor(code),
    contentType: "image/png",
    prefix: "qr",
  });

  /**
   * The row is written **after** the bytes land. The other order would leave a
   * pathname in the database pointing at nothing, which renders as a broken
   * image on the card — and a broken image is the one thing F19 says the
   * missing-QR state must never be.
   */
  await db
    .update(remoteId)
    .set({ qrPathname: file.pathname, updatedAt: new Date() })
    .where(eq(remoteId.id, remoteIdId));

  return file.pathname;
}
