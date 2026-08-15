# F19 — Digital ID Card & QR

**Wave:** 6 · **Depends on:** [F08](./F08-background-jobs.md), [F11](./F11-remote-id-redaction.md)

## Purpose

The physical artefact of the whole idea: a card the pilot can show, and a QR code they can print and stick on the airframe, that a field inspector scans to resolve the aircraft. This is the demo moment.

## Technical design

### The card — `/[locale]/drones/[id]/remote-id`

Owner-only. Designed to be readable on a phone held up to an inspector, and to print cleanly on one page.

Contains:

- **The Remote ID code**, largest element on the card, in a monospace face with the `AJN-XXXX-XXXX` grouping preserved. Latin characters in both locales — a code is a code, not text to be localised.
- A **status badge** — active / expired / suspended — using the same tokens as everywhere else.
- **Issued** and **valid-until** dates, Gregorian, Latin numerals, Riyadh time.
- Make, model, build type, weight class.
- **A tap-to-copy control** on the code, because reading it aloud over a phone is the fallback when a camera won't focus.
- The **QR**, sized large enough to scan from ~30 cm on a mid-range phone.
- Declared modules, if any, with their verification state.
- Owner name — **the owner's own card only**; the card is not a shareable link.

The card renders **the drone's own record**, not a redacted view — the viewer is the owner by definition. The public view is `/rid/[code]` ([F11](./F11-remote-id-redaction.md)), and the card links to it with a plain explanation of what a stranger would see, so a pilot understands their privacy before printing.

### The QR

Encodes `${APP_URL}/ar/rid/${code}` — the Arabic URL, with a language toggle on the landing page.

Rendered server-side as a PNG (~512 px, error correction level **H** so it still scans with a scratched or partly obscured sticker), stored via [F07](./F07-file-uploads.md), path in `remote_id.qrPathname`. Rendered by an Inngest job ([F08](./F08-background-jobs.md)) so a transient storage failure retries rather than leaving an approved drone with no code.

If `qrPathname` is null (job pending or failed), the card shows a **clear "generating…" state with a retry action** — never a broken image and never a blank space.

> **Deploy trap, stated on the card's help text and checked by [F29](./F29-system-ops-page.md):** the QR embeds `APP_URL` at render time. If `APP_URL` is still `localhost` when the first drone is approved in production, every printed sticker is dead. Changing `APP_URL` later requires re-rendering every QR — an admin action exists for exactly this.

### Print view

`/[locale]/drones/[id]/remote-id/print` — a print stylesheet producing:

1. A **wallet card** at roughly credit-card proportions.
2. A **sticker sheet** of QR codes at three sizes (50 mm, 30 mm, 20 mm) for different airframes.

Print CSS uses `@page` with explicit margins, forces the light palette regardless of theme (a dark-mode QR printed on white paper is unscannable), and hides all navigation. Arabic text keeps `dir="rtl"` in print.

### Download

A **Download PNG** action for the QR, and **Download card** producing a print-ready PNG. Both are generated server-side and served through `/api/files/…` with the owner check — not client-side canvas exports, which behave inconsistently with Arabic text and web fonts.

## Files

```
src/app/[locale]/(app)/drones/[id]/remote-id/page.tsx
src/app/[locale]/(app)/drones/[id]/remote-id/print/page.tsx
src/components/remote-id/{id-card,qr-display,copy-code,declared-modules,
                          privacy-explainer}.tsx
src/app/print.css
src/lib/qr/render.ts                   (shared with F08)
src/lib/actions/remote-id.ts           regenerateQr (admin + owner)
```

## Acceptance criteria

**The code and card**
- [ ] The card shows the Remote ID code as the largest element, monospace, dashes preserved.
- [ ] The code renders in Latin characters in **both** locales — never transliterated or converted to Arabic-Indic digits.
- [ ] Tap-to-copy copies the canonical `AJN-XXXX-XXXX` form.
- [ ] Issued and valid-until dates are Gregorian, Latin numerals, Riyadh time, in both locales.
- [ ] The status badge uses the same tokens as the drone list and the map.
- [ ] Declared modules appear with their verification state; an unverified one is clearly marked.

**The QR**
- [ ] Scanning the on-screen QR with a real phone opens `/ar/rid/{code}` and resolves the correct drone.
- [ ] The QR uses error correction level H.
- [ ] With `qrPathname` null, the card shows a "generating…" state with a retry action — **not** a broken image.
- [ ] Triggering the retry re-runs the job and the QR appears.
- [ ] Re-rendering an existing QR is idempotent — same code, same pathname, same scan target.
- [ ] The encoded URL uses `APP_URL`, and an admin action exists to re-render every QR after `APP_URL` changes.

**Print**
- [ ] The print view produces a wallet card and a sticker sheet at 50/30/20 mm.
- [ ] Printed output uses the **light** palette even when the app is in dark mode.
- [ ] Navigation, header, and footer are hidden in print.
- [ ] A **printed** 20 mm QR scans successfully from ~15 cm (test with real paper, or name this as unverified).
- [ ] Arabic text in the print view is right-aligned.

**Access**
- [ ] Pilot B opening pilot A's card gets **404**.
- [ ] The card is unreachable for a drone that is not `approved`.
- [ ] Downloads are served through the owner-checked file route, not a public blob URL.
- [ ] The privacy explainer accurately describes what an anonymous scanner sees — cross-checked against [F11](./F11-remote-id-redaction.md)'s masking table.
- [ ] The card is legible in Arabic RTL at 375 px — this is the primary viewport.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
