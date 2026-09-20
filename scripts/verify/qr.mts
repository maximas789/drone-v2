/**
 * F31b, step 7 — **the QR actually on the sticker.**
 *
 *   node --conditions=react-server --import tsx scripts/verify/qr.mts
 *
 * CLAUDE.md names this trap by itself: *"QR codes embed `APP_URL` at render
 * time. If it still says `localhost` in production, every printed sticker is
 * dead."* A stored PNG is opaque — looking at it tells you it is a QR code and
 * nothing about where it points.
 *
 * **Decoding it would need a decoder this project does not have**, and adding a
 * dependency to check a dependency is not a verification. So instead: render the
 * payload URL fresh through the app's own `renderQrPng` and **byte-compare**
 * against what is on disk. `qrcode` is deterministic for a given string, size,
 * error-correction level and margin — so a byte-identical PNG is proof the
 * stored file encodes that exact URL, and a differing one is proof it does not.
 *
 * The comparison is only as good as its negative control, so this also renders
 * a **deliberately wrong** URL and asserts that it does *not* match. Without
 * that, a renderer that ignored its argument would pass every assertion here.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

if (existsSync(".env")) process.loadEnvFile(".env");

/**
 * **`--blob <store-url> <code>...` checks the stickers a deployment actually
 * holds**, which the disk mode cannot: on Vercel nothing is on disk, the PNGs
 * are in the Blob store, and that is what gets printed.
 *
 *   APP_URL=https://drone-v2.vercel.app pnpm verify:qr \
 *     --blob https://<store-id>.public.blob.vercel-storage.com \
 *     AJN-XXXX-XXXX AJN-YYYY-YYYY
 *
 * It needs **no secret**: the store is public-read and the key is
 * `qr/{code}.png`. `APP_URL` must be given inline — `.env` says `localhost`,
 * and a comparison against a localhost render would fail for a reason that has
 * nothing to do with the stickers. In this mode a local origin is therefore a
 * **failure**, not a note: it is the one thing the mode exists to catch.
 *
 * The codes are arguments because a public store cannot be listed without its
 * token; take them from the drones' Remote ID cards or `/admin`.
 */
const cliArgs = process.argv.slice(2);
const blobIndex = cliArgs.indexOf("--blob");
const blobMode = blobIndex !== -1;
const blobBase = blobMode ? cliArgs[blobIndex + 1]?.replace(/\/+$/, "") : undefined;
const blobCodes = blobMode ? cliArgs.slice(blobIndex + 2) : [];

const { renderQrPng, qrPayloadUrl, qrPathnameFor, QR_SIZE_PX } = await import(
  "@/lib/qr/render"
);

const results: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

/** One sticker to check: where it came from, and its bytes (null if it was not there). */
type Sticker = { code: string; file: string; stored: Buffer | null };
const stickers: Sticker[] = [];

if (blobMode) {
  check(
    "--blob was given an https store URL and at least one code",
    Boolean(blobBase?.startsWith("https://")) && blobCodes.length > 0,
    `${blobCodes.length} code(s)`,
  );
  for (const code of blobCodes) {
    const file = qrPathnameFor(code);
    let stored: Buffer | null = null;
    try {
      const res = await fetch(`${blobBase}/qr/${file}`);
      const type = res.headers.get("content-type") ?? "";
      const ok = res.ok && type.startsWith("image/png");
      check(
        `${code} · is in the Blob store (HTTP 200, image/png)`,
        ok,
        `HTTP ${res.status}, ${type || "no content-type"}`,
      );
      if (ok) stored = Buffer.from(await res.arrayBuffer());
    } catch (error) {
      check(`${code} · is in the Blob store (HTTP 200, image/png)`, false, String(error));
    }
    stickers.push({ code, file, stored });
  }
} else {
  const QR_DIR = path.join(process.cwd(), "uploads", "qr");
  const files = existsSync(QR_DIR)
    ? readdirSync(QR_DIR).filter((f) => f.endsWith(".png"))
    : [];

  check("QR files exist on disk", files.length > 0, `${files.length} file(s)`);
  for (const file of files) {
    stickers.push({
      code: file.replace(/\.png$/, ""),
      file,
      stored: readFileSync(path.join(QR_DIR, file)),
    });
  }
}

for (const { code, file, stored } of stickers) {
  // Missing from the store: already reported above, nothing to compare.
  if (!stored) continue;
  const fresh = await renderQrPng(code);

  check(
    `${code} · the stored PNG encodes ${qrPayloadUrl(code)}`,
    stored.equals(fresh),
    stored.equals(fresh)
      ? `${stored.length} bytes, byte-identical`
      : `stored ${stored.length} B vs fresh ${fresh.length} B — the sticker points somewhere else`,
  );

  check(`${code} · the storage key is what the app asks for`, qrPathnameFor(code) === file);

  // A PNG, and the right size — 512 px is what makes a 20 mm sticker readable.
  check(
    `${code} · is a PNG`,
    stored.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  );
  /**
   * **About 512, not exactly 512.** `qrcode` rounds the requested width down to
   * a whole number of modules, and how many modules there are depends on the
   * URL's length: a `localhost` payload lands on 512 and the production one on
   * 511. An exact-equality check passed locally by luck of the hostname and
   * failed on the real stickers, which were byte-identical to a fresh render —
   * found by pointing this at them. Square, and within 2 px, is what the
   * assertion was ever for.
   */
  const width = stored.readUInt32BE(16);
  const height = stored.readUInt32BE(20);
  check(
    `${code} · is about ${QR_SIZE_PX} px square`,
    width === height && Math.abs(width - QR_SIZE_PX) <= 2,
    `${width}×${height}`,
  );
}

/**
 * **The negative control.** If this matched, every assertion above would be
 * meaningless — it would mean the renderer does not depend on its argument.
 */
const control = stickers.find((s) => s.stored);
if (control?.stored) {
  const wrong = await renderQrPng(`${control.code}-WRONG`);
  check("a different code renders a different PNG", !control.stored.equals(wrong));
}

/**
 * The trap itself. This is a **development** origin, so the check below is
 * expected to report `localhost` — it is recorded, not passed off as production
 * readiness. F29a's system page carries the same check for the operator.
 */
const sample = stickers[0]?.code ?? "AJN-0000-0000";
const payload = qrPayloadUrl(sample);
const isLocal = /localhost|127\.0\.0\.1/.test(payload);
if (blobMode && isLocal) {
  // Deployed stickers compared against a localhost render: either APP_URL was
  // not given inline, or the stickers really do point at localhost. Both are
  // reasons to stop, so this is a failure rather than a note.
  check(
    "the payload origin is a real domain",
    false,
    `${payload} — pass APP_URL=https://<your-domain> inline`,
  );
} else {
  results.push(
    `${isLocal ? "NOTE" : "OK  "} the payload origin is ${isLocal ? "a LOCAL origin" : "a real domain"} — ${payload}`,
  );
}

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL"));
console.log(
  `\n${results.filter((r) => r.startsWith("OK")).length} passed, ${failed.length} failed` +
    (isLocal && !blobMode
      ? "\n\nEvery sticker rendered so far points at localhost. That is correct for this\nmachine and fatal in production: re-render after APP_URL is set to a real domain."
      : ""),
);
process.exit(failed.length === 0 ? 0 : 1);
