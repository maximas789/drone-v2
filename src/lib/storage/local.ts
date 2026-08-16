import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PutFileInput, StoredBytes, StoredFile } from "./index";
import { fileUrlFor } from "./index";

/**
 * The no-token driver: writes under `./uploads`, gitignored.
 *
 * Files are **not** written into `public/`. That would serve them with no check
 * at all, and the whole point of routing both drivers through
 * `/api/files/[...path]` is that the ownership rule is written once.
 */

const ROOT = path.join(process.cwd(), "uploads");

export async function put({
  buffer,
  filename,
  prefix,
  contentType,
}: PutFileInput): Promise<StoredFile> {
  const pathname = `${trim(prefix)}/${trim(filename)}`;
  const target = resolveWithin(pathname);

  await mkdir(path.dirname(target), { recursive: true });
  // Overwrites deliberately: re-rendering a QR must land on the same pathname,
  // or every already-printed sticker points at a file that is no longer there.
  await writeFile(target, buffer);

  return {
    url: fileUrlFor(pathname),
    pathname,
    contentType,
    size: buffer.byteLength,
  };
}

/** Idempotent — `force` means a file already gone is not an error. */
export async function remove(pathname: string): Promise<void> {
  await rm(resolveWithin(pathname), { force: true });
}

export async function read(pathname: string): Promise<StoredBytes | null> {
  try {
    return { body: await readFile(resolveWithin(pathname)) };
  } catch {
    // Missing, unreadable, or outside the root — all the same answer to a
    // caller that is about to turn this into a 404.
    return null;
  }
}

/**
 * Keys are built by the app, never by an uploader — but `..` in one would
 * escape `uploads/` entirely, and this is the single place that could let it.
 */
function trim(segment: string): string {
  const clean = segment
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== "." && part !== "..")
    .join("/");

  if (!clean) throw new Error(`Refusing an empty storage path segment.`);
  return clean;
}

/**
 * Belt and braces on top of `trim`: the resolved absolute path must still be
 * inside `uploads/`. `trim` already strips `..`, but `read` and `remove` take a
 * pathname that came back out of the **database**, and a row is not a thing to
 * trust twice.
 */
function resolveWithin(pathname: string): string {
  const target = path.resolve(ROOT, ...trim(pathname).split("/"));
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    throw new Error(`Refusing a storage path outside uploads/: ${pathname}`);
  }
  return target;
}
