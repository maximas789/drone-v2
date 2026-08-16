"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatBytes, formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { KIND_RULES, type UploadKind } from "@/lib/storage/validate";

/**
 * Drag, drop, or choose. One request per file.
 *
 * **The client-side checks here are a courtesy, not a control.** They exist so
 * somebody does not wait through an 18 MB upload to be told no; the server
 * sniffs the magic bytes of everything regardless, and a caller who skips this
 * component entirely gets exactly the same answers.
 *
 * Layout is logical-property only, so the drag target, the progress bar and the
 * button row all mirror in Arabic without a second stylesheet.
 */

export type UploadedFile = {
  url: string;
  pathname: string;
  contentType: string;
  size: number;
};

type Refusal = { code: string; params?: Record<string, string | number> };

export function FileDropzone({
  kind,
  targetId,
  locale,
  onUploaded,
  disabled = false,
}: {
  kind: UploadKind;
  /** The drone, or the declaration, the file belongs to. */
  targetId: string;
  locale: Locale;
  onUploaded?: (file: UploadedFile) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("upload");
  const tErrors = useTranslations("errors");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rule = KIND_RULES[kind];
  const isDocument = kind === "declaration_doc";
  const accept = isDocument
    ? "application/pdf"
    : "image/jpeg,image/png,image/webp";

  function messageFor(reason: Refusal): string {
    switch (reason.code) {
      case "upload_too_large":
        return tErrors("uploadTooLarge", {
          max: formatBytes(Number(reason.params?.maxBytes ?? rule.maxBytes), locale),
        });
      case "upload_type_rejected":
      case "upload_kind_unknown":
        return tErrors("uploadTypeRejected");
      case "upload_target_locked":
        return tErrors("uploadTargetLocked");
      case "not_found":
        return tErrors("notFound");
      case "network":
        return tErrors("networkError");
      case "unauthorized":
        return tErrors("unauthorized");
      case "rate_limited":
        return tErrors("rateLimited", {
          // Pre-formatted: a bare number in an ICU message is formatted by
          // next-intl in the page locale and comes out in Arabic-Indic digits.
          duration: formatSeconds(
            Number(reason.params?.retryAfterSeconds ?? 0),
            locale,
          ),
        });
      default:
        return tErrors("uploadFailed");
    }
  }

  async function upload(files: FileList | File[]) {
    setError(null);
    const list = Array.from(files);
    if (list.length === 0) return;

    setBusy(true);
    for (const [index, file] of list.entries()) {
      // The courtesy check. Same ceiling as the server's, read from the same
      // table, so the two can never drift apart into different numbers.
      if (file.size > rule.maxBytes) {
        setError(
          tErrors("uploadTooLarge", { max: formatBytes(rule.maxBytes, locale) }),
        );
        continue;
      }

      setProgress(Math.round((index / list.length) * 100));
      const result = await send(file);
      if (!result.ok) {
        setError(messageFor(result.reason));
        continue;
      }
      onUploaded?.(result.file);
    }

    setProgress(null);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function send(
    file: File,
  ): Promise<
    { ok: true; file: UploadedFile } | { ok: false; reason: Refusal }
  > {
    const body = new FormData();
    body.set("file", file);
    body.set("kind", kind);
    body.set("targetId", targetId);

    try {
      const response = await fetch("/api/upload", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        return {
          ok: false,
          reason: payload?.reasons?.[0] ?? { code: "generic" },
        };
      }
      return { ok: true, file: payload.data };
    } catch {
      // The network, not the server. A different sentence, because "try again"
      // is the right advice here and is not the right advice for a refusal.
      return { ok: false, reason: { code: "network" } };
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) void upload(event.dataTransfer.files);
        }}
        data-dragging={dragging || undefined}
        className={[
          "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center",
          "border-muted-foreground/30 data-dragging:border-primary data-dragging:bg-primary/5",
          disabled ? "opacity-50" : "",
        ].join(" ")}
      >
        <p className="text-sm font-medium">{t("dropHere")}</p>
        <p className="text-muted-foreground text-xs">{t("or")}</p>

        <Button
          type="button"
          variant="secondary"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? t("uploading") : t("browse")}
        </Button>

        <p className="text-muted-foreground text-xs">
          {isDocument
            ? t("hintDocument", { max: formatBytes(rule.maxBytes, locale) })
            : t("hint", { max: formatBytes(rule.maxBytes, locale) })}
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={!isDocument}
          className="sr-only"
          disabled={disabled || busy}
          onChange={(event) => {
            if (event.target.files) void upload(event.target.files);
          }}
        />
      </div>

      {progress !== null ? (
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
        >
          {/* `me-auto` rather than `mr-auto`: the bar fills from the start edge,
              which is the right edge in Arabic. */}
          <div
            className="bg-primary me-auto h-full transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
