import QRCode from "qrcode";
import { absoluteUrl } from "@/lib/url";
import { DEFAULT_LOCALE } from "@/lib/locale";

/**
 * The QR code a field inspector scans off an airframe.
 *
 * **It encodes `APP_URL` at render time.** If that still says `localhost` when
 * the first drone is approved in production, every printed sticker is dead and
 * nothing in the app would otherwise say so — which is why F29's health check
 * flags a non-production `APP_URL`, and why this module is the one place the
 * payload is built.
 */

/** ~512 px: readable from a 20 mm printed sticker on a phone camera. */
export const QR_SIZE_PX = 512;

/**
 * High error correction. A sticker on an airframe collects dust, scratches and
 * sunlight, and `H` tolerates roughly 30 % of the symbol being unreadable. The
 * cost is a denser code, which the 512 px render absorbs.
 */
const ERROR_CORRECTION = "H" as const;

/**
 * Arabic is the default locale, so the sticker points at the Arabic page.
 * A reader who wants English switches there — the reverse would put the app's
 * second language on every printed airframe in the country.
 */
export function qrPayloadUrl(code: string): string {
  return absoluteUrl(`/${DEFAULT_LOCALE}/rid/${code}`);
}

/** The storage key. Stable per code, so re-rendering overwrites in place. */
export function qrPathnameFor(code: string): string {
  return `${code}.png`;
}

export async function renderQrPng(code: string): Promise<Buffer> {
  return QRCode.toBuffer(qrPayloadUrl(code), {
    type: "png",
    width: QR_SIZE_PX,
    errorCorrectionLevel: ERROR_CORRECTION,
    // Four modules is the quiet zone the spec requires; below it, scanners
    // that expect a border start failing on busy backgrounds.
    margin: 4,
    color: { dark: "#000000ff", light: "#ffffffff" },
  });
}
