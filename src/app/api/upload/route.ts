import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-guards";
import {
  addDronePhoto,
  getDeclarationForUpload,
  getDroneForUpload,
  setDeclarationDoc,
} from "@/lib/data/upload";
import { enforceLimit } from "@/lib/rate-limit";
import {
  declarationPrefix,
  deleteFile,
  dronePrefix,
  isPhotoKind,
  isUploadKind,
  putFile,
  storageKeyFor,
  validateUpload,
} from "@/lib/storage";
import type { Reason } from "@/lib/actions/result";

/**
 * `POST /api/upload` — multipart, one file per request.
 *
 * The same shape as a server action, for the same reason: **a route handler is
 * an ordinary POST**, reachable directly with a cookie and any body the caller
 * cares to send. The UI is not a control.
 *
 * ```
 * signed in? → rate limit → parse → validate kind, size, magic bytes
 *            → the caller owns the target, and it is editable
 *            → putFile → row + audit event → StoredFile
 * ```
 *
 * **Refusals are answers, not exceptions**: `{ ok: false, reasons: Reason[] }`
 * with machine-readable codes, translated at render, so the same refusal reads
 * correctly in Arabic and in English.
 */

const MULTIPART = "multipart/form-data";

export async function POST(request: Request) {
  const session = await getSession();
  // 401, not a redirect: this is an endpoint, and its caller is `fetch`.
  if (!session) return refusal(401, [{ code: "unauthorized" }]);

  const limit = await enforceLimit("upload.request", "user", session.user.id);
  if (!limit.ok) {
    return refusal(429, [
      {
        code: "rate_limited",
        params: { retryAfterSeconds: limit.retryAfterSeconds },
      },
    ]);
  }

  if (!request.headers.get("content-type")?.includes(MULTIPART)) {
    return refusal(400, [{ code: "upload_not_multipart" }]);
  }

  const form = await request.formData();
  const file = form.get("file");
  const kind = form.get("kind");
  const targetId = form.get("targetId");

  if (!(file instanceof File) || typeof targetId !== "string" || !targetId) {
    return refusal(400, [{ code: "upload_missing_field" }]);
  }
  if (!isUploadKind(kind)) {
    return refusal(400, [{ code: "upload_kind_unknown" }]);
  }

  /**
   * Read once, into memory, and judge the bytes we hold. Streaming to storage
   * first and checking afterwards would mean a rejected file had already been
   * written — and the 8 MB ceiling is what keeps buffering honest.
   */
  const buffer = Buffer.from(await file.arrayBuffer());
  const verdict = validateUpload(kind, buffer);
  if (!verdict.ok) {
    const { refusal: r } = verdict;
    return refusal(
      r.code === "upload_too_large" ? 413 : 415,
      [
        r.code === "upload_too_large"
          ? { code: r.code, params: { maxBytes: r.maxBytes } }
          : { code: r.code },
      ],
    );
  }

  /**
   * Ownership is checked against the **target entity**, and a target that is
   * not the caller's answers exactly like one that does not exist. Anything
   * else enumerates other people's aircraft one status code at a time.
   *
   * The check happens **before** `putFile`. Storing first and asking after
   * would leave the bytes of a refused upload sitting in the bucket.
   */
  if (isPhotoKind(kind)) {
    const target = await getDroneForUpload(session, targetId);
    if (!target.ok) return targetRefusal(target.reason);

    const stored = await store(buffer, dronePrefix(targetId), verdict);
    await addDronePhoto(session, {
      droneId: target.droneId,
      kind,
      url: stored.url,
      pathname: stored.pathname,
    });
    return NextResponse.json({ ok: true, data: stored });
  }

  const target = await getDeclarationForUpload(session, targetId);
  if (!target.ok) return targetRefusal(target.reason);

  const stored = await store(buffer, declarationPrefix(targetId), verdict);
  await setDeclarationDoc(session, {
    declarationId: target.declarationId,
    droneId: target.droneId,
    pathname: stored.pathname,
  });
  // The document it replaced, gone from storage as well as from the row: a
  // superseded PDF nobody deletes stays readable to anyone holding its path.
  if (target.previousPath) await deleteFile(target.previousPath);

  return NextResponse.json({ ok: true, data: stored });
}

async function store(
  buffer: Buffer,
  prefix: string,
  verdict: { type: string; extension: string },
) {
  const key = storageKeyFor(prefix, randomUUID(), verdict.extension);
  return putFile({
    buffer,
    filename: key.filename,
    prefix: key.prefix,
    // The **sniffed** type, never the header the client sent.
    contentType: verdict.type,
  });
}

function targetRefusal(reason: "not_found" | "not_editable") {
  return reason === "not_found"
    ? refusal(404, [{ code: "not_found" }])
    : refusal(409, [{ code: "upload_target_locked" }]);
}

function refusal(status: number, reasons: Reason[]) {
  return NextResponse.json({ ok: false, reasons }, { status });
}
