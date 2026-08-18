import { RESERVED_CODES } from "@/lib/remote-id/codec";
import { renderQrPng } from "@/lib/qr/render";

/**
 * The example card's code and its QR, for the landing page.
 *
 * **The QR comes from `renderQrPng`** — F08's encoder, the one that writes the
 * sticker on a real airframe. Same payload builder, same error correction H,
 * same quiet zone. So the thing on the front door is not a picture of a QR: it
 * is the product, pointed at a code that belongs to nobody.
 *
 * **A data URI rather than a stored blob.** Nothing here is owned by anybody,
 * so there is no row to check ownership against and no pathname to sweep when
 * it changes; `/api/files` exists to guard *someone's* file. Inlining also
 * means the front page makes no second request for its own centrepiece.
 *
 * It is rendered per request and memoised for the process, because the payload
 * depends on `APP_URL` — the same deploy trap as every other QR in this app.
 */

/**
 * Reserved in the codec, so `issueRemoteId` can never mint it. If this is ever
 * changed, change `RESERVED_CODES` with it — the assertion below fails loudly
 * rather than letting the landing page point at an issuable code.
 */
export const DEMO_CARD_CODE = "AJN-DEM0-CARD";

if (!RESERVED_CODES.includes(DEMO_CARD_CODE)) {
  throw new Error(
    `${DEMO_CARD_CODE} is on the public landing page but is not reserved — the generator could issue it to a real aircraft, and the front door would then point at a stranger's registration.`,
  );
}

let cached: string | null = null;

export async function demoQrDataUri(): Promise<string> {
  if (cached) return cached;
  const png = await renderQrPng(DEMO_CARD_CODE);
  cached = `data:image/png;base64,${png.toString("base64")}`;
  return cached;
}
