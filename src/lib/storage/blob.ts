import "server-only";

import { del, head, put as putBlob } from "@vercel/blob";
import type { PutFileInput, StoredBytes, StoredFile } from "./index";
import { fileUrlFor } from "./index";

/**
 * Vercel Blob. Chosen by `BLOB_READ_WRITE_TOKEN` being present, never by
 * `NODE_ENV`, so the production path is exercisable locally by setting one
 * variable.
 *
 * **The blob's own URL is not what we hand out.** `StoredFile.url` is
 * `/api/files/{pathname}` in both drivers, so the ownership check in that route
 * is the only way in and there is one behaviour to reason about rather than two.
 * A public blob URL that leaked would still resolve — see the note on
 * `access` below.
 */

export async function put({
  buffer,
  filename,
  prefix,
  contentType,
}: PutFileInput): Promise<StoredFile> {
  const pathname = `${prefix}/${filename}`;

  const result = await putBlob(pathname, Buffer.from(buffer), {
    /**
     * `public`, and the consequence is stated rather than hidden: a blob URL is
     * unguessable but resolves for anyone who has it. Nothing in the app ever
     * emits one — `fileUrlFor` returns our own route — so a leak needs the URL
     * to escape by some other means. `access: 'private'` is the stronger
     * answer and the one to move to; it is not taken now because there is no
     * Blob store on this machine to prove it against, and shipping an
     * unverifiable privacy claim is worse than a stated limitation.
     */
    access: "public",
    /**
     * Our key is already `{prefix}/{uuid}.{ext}`. A random suffix on top would
     * make the stored pathname differ from the one we recorded, and
     * `deleteFile` would then miss it — an orphaned blob is a privacy leak,
     * not just waste.
     */
    addRandomSuffix: false,
    /**
     * Re-rendering a QR must land on the same pathname, or every sticker
     * already printed points at a file that is no longer there.
     */
    allowOverwrite: true,
    contentType,
  });

  return {
    url: fileUrlFor(result.pathname),
    pathname: result.pathname,
    contentType,
    size: buffer.byteLength,
  };
}

/**
 * Fetched **through** the app rather than redirected to.
 *
 * A redirect would hand the caller the blob's own URL, which then works for
 * anyone they pass it to and for ever after the row is gone — the ownership
 * check would become a formality that only holds for the first request.
 */
export async function read(pathname: string): Promise<StoredBytes | null> {
  try {
    const meta = await head(pathname);
    const response = await fetch(meta.url);
    if (!response.ok) return null;
    return { body: new Uint8Array(await response.arrayBuffer()) };
  } catch {
    // `head` throws `BlobNotFoundError` for a missing blob. Missing and
    // unreachable are the same answer to a caller about to return 404.
    return null;
  }
}

export async function remove(pathname: string): Promise<void> {
  // `del` takes a URL or a pathname and is idempotent — deleting something
  // already gone is not an error, which is what a retried delete needs.
  await del(pathname);
}
