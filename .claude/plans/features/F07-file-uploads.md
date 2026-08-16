# F07 — File Uploads & Document Storage

**Wave:** 4 · **Depends on:** [F05](./F05-auth-roles-access.md) · **Skill reference:** `references/storage.md`

## Purpose

Drone photographs and compliance documents, stored the same way in development and production so nothing has to be rewritten at deploy time.

## Technical design

### One interface, two drivers

```ts
// src/lib/storage/index.ts
type StoredFile = { url: string; pathname: string; contentType: string; size: number }

putFile(input: { buffer, filename, contentType, prefix }): Promise<StoredFile>
deleteFile(pathname: string): Promise<void>
readFile(pathname: string): Promise<{ body: Uint8Array } | null>
```

> **Built:** `readFile` is the third member, and it is what `/api/files` streams.
> The blob driver **fetches through the app** rather than redirecting — a
> redirect hands the caller the blob's own URL, which then works for anyone they
> pass it to and long after the row is gone, so the ownership check would hold
> only for the first request.
>
> The driver is loaded by **dynamic import**, so `@vercel/blob` is never
> evaluated on a machine with no token and `node:fs` is never pulled in on one
> that has it.

Driver chosen by env, **not by `NODE_ENV`** — so production behaviour is testable locally:

| `BLOB_READ_WRITE_TOKEN` | Driver |
|---|---|
| absent | `local.ts` — writes under `./uploads`, served by a route handler |
| present | `blob.ts` — Vercel Blob |

> **Blob access is `public`, with the consequence stated rather than hidden.** A
> blob URL is unguessable but resolves for anyone holding it; nothing in the app
> ever emits one, because `fileUrlFor` returns our own route. `access: 'private'`
> is the stronger answer and the one to move to — it is not taken now because
> there is no Blob store on this machine to prove it against, and shipping an
> unverifiable privacy claim is worse than a stated limitation.

`uploads/` is gitignored. The local driver serves through `/api/files/[...path]` rather than `public/`, so the same ownership check applies in both drivers.

### What gets uploaded

| Kind | Accepts | Max | Notes |
|---|---|---|---|
| `overall` | JPEG, PNG, WebP | 8 MB | The drone as a whole. At least one required to submit. |
| `serial_plate` | JPEG, PNG, WebP | 8 MB | Optional — commercial drones only |
| `remote_id_module` | JPEG, PNG, WebP | 8 MB | Photo of a declared broadcast module |
| `payload` | JPEG, PNG, WebP | 8 MB | Camera / gimbal |
| `declaration_doc` | **PDF only** | 10 MB | FAA Declaration of Compliance or GACA approval ([F10](./F10-remote-id-issuance.md)) |
| `qr` | PNG, written by the system | — | Rendered by [F08](./F08-background-jobs.md) |

### Validation — server-side, always

The endpoint never trusts the client's `Content-Type` header or the file extension. It reads the **magic bytes** and rejects anything whose sniffed type doesn't match an allowed type for that `kind`. An SVG uploaded as a "photo" is a stored-XSS vector; PDFs and rasters only.

Filenames are never used as storage keys. The key is `{prefix}/{uuid}.{ext}` where `prefix` is `drones/{droneId}` or `declarations/{declarationId}` — so the original filename can't traverse paths or collide.

### The upload route — `/api/upload`

```
requireUser()
  → rateLimit()               20/hour per user (F09)
  → parse multipart
  → validate kind, size, magic bytes
  → verify the caller owns the target entity, and it is in an editable state
  → putFile()
  → insert drone_photo / update declaration
  → audit event
  → return StoredFile
```

**Ownership is checked against the target entity, not just "is signed in".** Uploading a photo to someone else's drone must fail with 404. A drone in `pending` or `approved` state accepts no new photos — only `draft` and `rejected` do.

### Deletion

Removing a photo deletes the row **and** calls `deleteFile(pathname)`. Deleting a drone (only legal in `draft`) cascades the rows and deletes every blob. An orphaned blob is a privacy leak, not just waste — the URL keeps working.

### Access to stored files

Blob URLs are unguessable but **public if known**. Drone photos are therefore treated as semi-public and are never surfaced in the anonymous Remote ID view ([F11](./F11-remote-id-redaction.md)). Declaration PDFs, which can carry identifying detail, are served **only** through `/api/files/[...path]` behind `requireUser()` + an ownership-or-reviewer check, in both drivers.

### Client component

`<FileDropzone kind={...} targetId={...} locale={...} />` — `targetId`, not
`entityId`: it is a drone for a photograph and a declaration for a PDF, and
naming it after the *kind*'s target says which without a comment.

**Reordering is buttons, not drag-and-drop.** Drag has no keyboard path and no
screen-reader story, and the two directions are *earlier* and *later* — which in
Arabic are physically the opposite way round from English. Naming them by
position in the sequence is the only version that reads correctly in both.

`<FileDropzone kind={...} entityId={...} />` — shadcn-based, bilingual, RTL-aware, with drag-and-drop, per-file progress, client-side size and type pre-checks (a courtesy, not a control), a preview grid with reorder, and remove. Empty state reads as intentional in both languages.

## Files

```
src/lib/storage/{index,local,blob,validate}.ts
src/lib/storage/validate.test.ts
src/lib/data/upload.ts              ownership, session first (rule 8)
src/lib/actions/upload.ts           delete a photo, reorder, sweep a drone's files
src/app/api/upload/route.ts
src/app/api/files/[...path]/route.ts
src/components/upload/file-dropzone.tsx
src/components/upload/photo-grid.tsx
uploads/                     (gitignored)
```

Two files the original list did not name:

- **`src/lib/data/upload.ts`** — rule 8 binds the upload route too. A route
  handler is an ordinary POST, reachable directly with a cookie and any body the
  caller likes, exactly like a server action.
- **`src/lib/actions/upload.ts`** — deleting and reordering are mutations from a
  client component, so they are actions; only the upload itself is a route,
  because it carries multipart bytes. `deleteDroneFiles` is exported here for
  **F18's drone-delete action to call before it deletes the row**: the
  `drone_photo` rows go by cascade, the bytes do not, and called afterwards it
  would find nothing.

## Acceptance criteria

- [ ] With no `BLOB_READ_WRITE_TOKEN`, an upload writes into `./uploads` and the returned `url` renders in the browser.
- [ ] With a token set, the same code path writes to Vercel Blob with **no source change**.
- [ ] `uploads/` is gitignored.
- [ ] A `.svg` renamed to `.png` is **rejected** — magic-byte sniffing, not extension.
- [ ] A 20 MB file is rejected with a bilingual error, not a crash or a truncated write.
- [ ] A non-PDF uploaded as `declaration_doc` is rejected.
- [ ] Pilot B uploading to pilot A's drone gets **404**.
- [ ] Uploading to a drone in `pending` state is refused.
- [ ] Deleting a photo removes both the database row and the stored blob — the URL 404s afterwards.
- [ ] Deleting a draft drone removes every associated blob.
- [ ] A declaration PDF URL fetched **signed out** is refused; fetched as its owner it succeeds; fetched as a reviewer it succeeds.
- [ ] The dropzone renders correctly in Arabic RTL, including drag-target and progress bars.
- [ ] Uploading 5 photos and reordering them persists `sortOrder`.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
