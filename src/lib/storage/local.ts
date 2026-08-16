import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PutFileInput, StoredFile } from "./index";
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
  const target = path.join(ROOT, ...pathname.split("/"));

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
