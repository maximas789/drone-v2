import "server-only";

/**
 * Where a stored file goes.
 *
 * **One interface, two drivers, chosen by an env var rather than `NODE_ENV`** —
 * so the production path is exercisable locally by setting one variable, and
 * nothing has to be remembered at deploy time.
 *
 * Both drivers hand back `/api/files/{pathname}` as the URL, never a
 * driver-specific one. That is what keeps the ownership check in a single
 * place: whichever driver is running, a file is reached the same way.
 */

export * from "./validate";

export type StoredFile = {
  /** What a browser fetches. Always our own route. Never parse it. */
  url: string;
  /** The key `deleteFile` will take. Not derivable from `url` — store both. */
  pathname: string;
  contentType: string;
  size: number;
};

export type PutFileInput = {
  buffer: Buffer;
  /**
   * The **whole** filename, already built by the caller as `{uuid}.{ext}`. An
   * uploaded filename is never a storage key: it can traverse paths, it can
   * collide, and it can carry a name the uploader did not mean to publish.
   */
  filename: string;
  contentType: string;
  /** `drones/{droneId}`, `declarations/{id}`, `qr`. Key is `{prefix}/{filename}`. */
  prefix: string;
};

/**
 * The bytes of a stored file, for `/api/files/[...path]` to stream back once it
 * has decided the caller may have them.
 */
export type StoredBytes = { body: Uint8Array };

export const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function putFile(input: PutFileInput): Promise<StoredFile> {
  const driver = await loadDriver();
  return driver.put(input);
}

/**
 * **Called wherever a row is removed.** An orphaned blob is a privacy leak, not
 * just waste: the bytes stay reachable to anyone who holds the pathname long
 * after the app has forgotten the file existed.
 *
 * Idempotent in both drivers — deleting something already gone is not an error,
 * which is what a retried delete needs.
 */
export async function deleteFile(pathname: string): Promise<void> {
  const driver = await loadDriver();
  await driver.remove(pathname);
}

/**
 * The bytes, or `null` if there are none. **Never called before the caller has
 * decided who may read them** — this function knows nothing about ownership,
 * and reading it as though it did is how a files route becomes an open one.
 */
export async function readFile(pathname: string): Promise<StoredBytes | null> {
  const driver = await loadDriver();
  return driver.read(pathname);
}

/**
 * Dynamic, so `@vercel/blob` is never loaded on a machine with no token, and
 * `node:fs` is never pulled in on one that has it.
 */
async function loadDriver() {
  return blobConfigured ? import("./blob") : import("./local");
}

/**
 * The URL a stored pathname is served at.
 *
 * `/api/files/…` in both drivers, so the **same** ownership check applies in
 * development and in production. Handing out a blob URL directly would make
 * that check a development-only formality.
 */
export function fileUrlFor(pathname: string): string {
  return `/api/files/${pathname}`;
}
