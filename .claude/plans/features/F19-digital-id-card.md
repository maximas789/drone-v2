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

---

## Corrections after F19a (Session 17)

The build log is the truth; these are the places this file was wrong, or was
changed by a decision taken with the user before building.

**F19 is being built in two halves**, settled up front rather than mid-flight:

- **F19a** — the card route, the QR display with its generating/retry state,
  tap-to-copy, the privacy explainer, and owner-only access. *Done.*
- **F19b** — the print view (wallet card and the 50/30/20 mm sticker sheet),
  the downloads, and the declared-modules **form**. The card already *renders*
  declared modules with their verification state; what F19b adds is the control
  that creates one.

### "Download card as a print-ready PNG" is cut

Replaced by **"print the card, and save as PDF from the browser's own print
dialog"** — F19b's print view is what delivers it.

Nothing installed can rasterise styled Arabic server-side, so this was a choice
between adding a dependency and cutting the feature, and it was taken with the
user before the print stylesheet was written rather than discovered afterwards:

- **satori has no HarfBuzz.** It does not do complex-script shaping, so Arabic
  comes out with its letters unjoined — the same class of defect as calling
  `setRTLTextPlugin()` wrongly, and one that would ship looking *almost* right.
  It would also mean bundling an Arabic TTF and hoping.
- **resvg or puppeteer** buys a native binary or a Chromium download for one
  button.
- The browser's print pipeline already shapes Arabic correctly, with the app's
  real fonts, and produces **vector** output — which prints better than a
  512 px PNG anyway. The thing the criterion actually wanted, a pilot ending up
  with a printable file, is delivered better by the path that was already being
  built.

**Download QR PNG stays** (F19b): `qrcode` renders it and it is already stored,
so it is an owner-checked link to bytes that exist, not a new renderer.

### The rest

- **The route is `/drones/[id]/remote-id`.** The approval email had been linking
  to `/drones/{id}/card`, which was never a route — every approval email ever
  sent pointed at a 404. Fixed in `qr-render.ts` and in the template's sample.
- **The retry renders inline; it does not enqueue a job.** The *approval* render
  stays an Inngest job, because nobody is watching it and a transient storage
  failure has to retry itself. The retry is a person pressing a button, and
  queueing that answers them with a spinner and no outcome — including when
  Inngest is the thing that is down, which is exactly when a QR goes missing.
  Both call one function, `storeQrForRemoteId`, so there is no second renderer.
- **"An admin action exists to re-render every QR after `APP_URL` changes" is
  not built.** `regenerateQrAction` is per-aircraft (owner or admin). The
  fleet-wide sweep belongs with [F29](./F29-system-ops-page.md), which is where
  the `APP_URL` check that would prompt it lives.
- **The card renders declared modules but does not add them.** The empty state
  says what is true — no external module is declared, and the Ajniha code is the
  aircraft's Remote ID — and promises no control, because F19b owns the form.

---

## Corrections after F19b (Session 18)

**F19 is complete.** The print view, the downloads and the declared-modules form.

### The declaration upload was unreachable code, and had been since F07

`getDeclarationForUpload` gated on `acceptsUploads`, which is `isDroneEditable`,
which is `draft | rejected`. But a `remote_id_declaration` row references
`remote_id`, and `remote_id` is minted **inside the approval transition**. The
two conditions cannot both hold for any row that has ever existed — so F07's
whole declaration-document path (a kind rule, a storage prefix, a data helper,
a route branch) sat behind a condition nothing could satisfy.

The gate is now **`acceptsDeclarations`** — `approved` only — in
`src/lib/validation/drone.ts` beside `isDroneEditable`, with a test asserting
the two lists stay **disjoint** and saying why. F19b is the first time a
declaration document has ever been uploaded in this build.

### Consequences of making it reachable

- **`listDroneFilePathnames` did not collect declaration documents.**
  `remote_id_declaration` cascades away with the drone, taking every `docPath`
  with it and leaving the PDF in storage with nothing able to name it — the
  orphaned-blob leak, not merely waste. Harmless while no `docPath` could
  exist; fixed here, superseded rows included.

### Decisions

- **The form does not collect `validFrom` / `validUntil`.** Those describe when
  a *certificate* is valid, and a pilot typing them before anybody has read the
  certificate would put an unchecked claim on the card beside the verified ones.
  **F22's reviewer sets them when verifying.** The columns stay nullable and
  pilot-unwritten.
- **Declaring supersedes; it never edits.** The table is history on purpose, so
  a new declaration marks the old row `supersededAt` and inserts a new one.
  Supersede happens **before** the insert, or re-declaring the same module would
  collide with the row it is replacing.
- **A declaration must identify the module** — at least one of manufacturer,
  serial or certificate reference. A row carrying only a kind asserts that a
  module exists without saying which, which no reviewer can check.
- **No notification.** The only person to tell is the one who pressed the
  button; the reviewer-facing side is F22's queue. The audit event is written
  regardless — a declaration is a regulator-facing claim.
- **`DECLARATION_KINDS` lives in `src/lib/validation/declaration.ts`, not in the
  action.** A `"use server"` module may export only async functions, so an array
  exported from one reaches the browser as a callable proxy —
  `DECLARATION_KINDS.map is not a function`, thrown at render with every static
  check green.

### The print view

- `@page { size: A4; margin: 12mm }`, chrome hidden, sizes in **millimetres on
  screen as well as in print** so the preview is the artefact.
- The **proposal notice is on the printed artefact itself**, not only on the
  page that made it. A card in a wallet outlives the browser tab and must never
  be mistaken for a GACA-issued document.
- **"Printed output uses the light palette even in dark mode" is currently
  vacuous**: nothing in this app ever applies the `.dark` class — there is no
  theme toggle yet. The print override is written for when one arrives, and the
  printed surfaces additionally use explicit `bg-white` / `text-black` rather
  than theme tokens. Re-check when a toggle ships (F28).
- **Download QR PNG** is an owner-checked `/api/files/…` link with a `download`
  attribute naming the file after the code. There is no card PNG — see the F19a
  corrections above.

### Still unverified

- **Nothing has been printed.** No paper, no phone camera, so the criterion
  *"a printed 20 mm QR scans from ~15 cm"* is **unverified**, as F19 permits it
  to be named. Thread 47.

