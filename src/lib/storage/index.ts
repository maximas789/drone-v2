import "server-only";

import { put as putLocal } from "./local";

/**
 * Where a stored file goes.
 *
 * **This is F07's module, built early because F08's QR job has to put a PNG
 * somewhere.** Only what F08 needs exists: the local driver and `putFile`.
 *
 * F07 still owns everything else it specifies — `blob.ts` (Vercel Blob),
 * `deleteFile`, `validate.ts`'s magic-byte sniffing, `/api/upload`,
 * `/api/files/[...path]` and the dropzone — and must build them **on top of**
 * this seam rather than beside it. The `StoredFile` shape and the
 * `{prefix}/{uuid}.{ext}` key rule are F07's, reproduced here unchanged so
 * there is nothing to reconcile later.
 */

export type StoredFile = {
  /** What a browser fetches. Driver-specific; never parse it. */
  url: string;
  /** The key `deleteFile` will take. Not derivable from `url` — store both. */
  pathname: string;
  contentType: string;
  size: number;
};

export type PutFileInput = {
  buffer: Buffer;
  /**
   * Used for its **extension only**. An uploaded filename is never a storage
   * key: it can traverse paths and it can collide.
   */
  filename: string;
  contentType: string;
  /** `drones/{droneId}`, `qr`, … The key is `{prefix}/{filename}`. */
  prefix: string;
};

/**
 * The driver is chosen by the **env var, not by `NODE_ENV`**, so the production
 * path is exercisable locally and nothing has to be remembered at deploy time.
 */
export const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function putFile(input: PutFileInput): Promise<StoredFile> {
  if (blobConfigured) {
    /**
     * Refusing beats falling back. A token is set, which means somebody expects
     * these bytes to survive a serverless restart; writing them quietly to
     * `./uploads` instead would look like it worked right up until the QR codes
     * vanished after a deploy.
     */
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is set but the Vercel Blob driver does not exist yet — F07 owns src/lib/storage/blob.ts. Unset the token to use the local driver.",
    );
  }
  return putLocal(input);
}

/**
 * The URL a stored pathname is served at.
 *
 * Both drivers go through `/api/files/…` rather than handing out a blob URL, so
 * the **same** ownership check applies in development and in production. F07
 * builds that route; until it does these URLs 404 — which is the honest
 * outcome, a QR PNG that is stored but not yet servable.
 */
export function fileUrlFor(pathname: string): string {
  return `/api/files/${pathname}`;
}
