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

const { renderQrPng, qrPayloadUrl, qrPathnameFor, QR_SIZE_PX } = await import(
  "@/lib/qr/render"
);

const results: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

const QR_DIR = path.join(process.cwd(), "uploads", "qr");
const files = existsSync(QR_DIR)
  ? readdirSync(QR_DIR).filter((f) => f.endsWith(".png"))
  : [];

check("QR files exist on disk", files.length > 0, `${files.length} file(s)`);

for (const file of files) {
  const code = file.replace(/\.png$/, "");
  const stored = readFileSync(path.join(QR_DIR, file));
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
  check(
    `${code} · is ${QR_SIZE_PX} px square`,
    stored.readUInt32BE(16) === QR_SIZE_PX && stored.readUInt32BE(20) === QR_SIZE_PX,
    `${stored.readUInt32BE(16)}×${stored.readUInt32BE(20)}`,
  );
}

/**
 * **The negative control.** If this matched, every assertion above would be
 * meaningless — it would mean the renderer does not depend on its argument.
 */
if (files.length > 0) {
  const code = files[0]!.replace(/\.png$/, "");
  const stored = readFileSync(path.join(QR_DIR, files[0]!));
  const wrong = await renderQrPng(`${code}-WRONG`);
  check("a different code renders a different PNG", !stored.equals(wrong));
}

/**
 * The trap itself. This is a **development** origin, so the check below is
 * expected to report `localhost` — it is recorded, not passed off as production
 * readiness. F29a's system page carries the same check for the operator.
 */
const sample = files[0]?.replace(/\.png$/, "") ?? "AJN-0000-0000";
const payload = qrPayloadUrl(sample);
const isLocal = /localhost|127\.0\.0\.1/.test(payload);
results.push(
  `${isLocal ? "NOTE" : "OK  "} the payload origin is ${isLocal ? "a LOCAL origin" : "a real domain"} — ${payload}`,
);

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL"));
console.log(
  `\n${results.filter((r) => r.startsWith("OK")).length} passed, ${failed.length} failed` +
    (isLocal
      ? "\n\nEvery sticker rendered so far points at localhost. That is correct for this\nmachine and fatal in production: re-render after APP_URL is set to a real domain."
      : ""),
);
process.exit(failed.length === 0 ? 0 : 1);
