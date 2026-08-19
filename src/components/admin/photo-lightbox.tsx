"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * The photographs, full size and zoomable.
 *
 * A reviewer is checking a build against its description — "is that the weight
 * class this looks like", "is there a camera on it" — and a 112 px thumbnail
 * cannot answer either question. So the grid opens into an overlay, and the
 * overlay zooms.
 *
 * **Not `<dialog>` and not `window.open`.** A native modal dialog blocks the
 * page and, more to the point here, the browser tooling cannot dismiss one —
 * the same class of trap as `window.confirm` and `<input type="date">`, where
 * the browser rather than the app decides what the user sees. This is ordinary
 * markup with `role="dialog"`, so it is bilingual because the catalogue is, it
 * closes on Escape because this component says so, and a screenshot can prove
 * what it looked like.
 *
 * **A plain `<img>`, as everywhere else in this app.** The bytes stream through
 * `/api/files/…`, which re-checks access on every request; `next/image` would
 * need that route in `remotePatterns` and would then cache an owner-scoped
 * photograph at the edge, where the check no longer runs.
 *
 * Zoom is a CSS `scale`, not a canvas: the file served is already the full
 * upload, so there is nothing to fetch at a higher resolution and the browser
 * does the resampling.
 */

const ZOOM_STEPS = [1, 1.5, 2, 3] as const;

export function PhotoLightbox({
  photos,
}: {
  photos: ReadonlyArray<{ id: string; url: string; kind: string }>;
}) {
  const t = useTranslations("review");
  const tDrones = useTranslations("drones");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(0);

  const open = openIndex !== null ? photos[openIndex] : undefined;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenIndex(null);
      /*
       * Arrow keys move between photographs. **Logical, not physical**: in an
       * RTL page "next" is the left arrow, and a reviewer paging through a
       * build's photos expects the order they are reading in.
       */
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        setOpenIndex((current) => {
          if (current === null) return current;
          const rtl = document.documentElement.dir === "rtl";
          const forward = rtl
            ? event.key === "ArrowLeft"
            : event.key === "ArrowRight";
          const next = forward ? current + 1 : current - 1;
          if (next < 0 || next >= photos.length) return current;
          return next;
        });
        setZoom(0);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, photos.length]);

  if (photos.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("noPhotos")}</p>;
  }

  return (
    <>
      <ul className="flex flex-wrap gap-3">
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              className="focus-visible:ring-ring block cursor-pointer overflow-hidden rounded-md focus-visible:ring-3 focus-visible:outline-none"
              onClick={() => {
                setOpenIndex(index);
                setZoom(0);
              }}
              aria-label={t("openPhoto", {
                kind: tDrones(`photoKinds.${photo.kind}`),
              })}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={tDrones(`photoKinds.${photo.kind}`)}
                className="size-32 object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("photoViewer")}
          /*
            Opaque, not `bg-background/95`. The translucent version let the
            page beneath show through the photograph — distracting on any
            screen and actively wrong on this one, where the whole task is
            judging detail in the image. Seen in a screenshot.
          */
          className="bg-background fixed inset-0 z-50 flex flex-col gap-3 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium">
              {tDrones(`photoKinds.${open.kind}`)}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={zoom === 0}
                onClick={() => setZoom((z) => Math.max(0, z - 1))}
              >
                {t("zoomOut")}
              </Button>
              <span className="text-muted-foreground text-xs tabular-nums">
                {/*
                  `dir="ltr"` on the multiplier alone: `×3` is a single Latin
                  token, and left to an RTL paragraph the sign and the digit
                  swap. It contains no formatted Arabic date, so this is the
                  safe use of `dir` — see the note on `slot-time.tsx`.
                */}
                <span dir="ltr">×{ZOOM_STEPS[zoom]}</span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={zoom === ZOOM_STEPS.length - 1}
                onClick={() =>
                  setZoom((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))
                }
              >
                {t("zoomIn")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setOpenIndex(null)}
              >
                {t("closeViewer")}
              </Button>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={open.url}
              alt={tDrones(`photoKinds.${open.kind}`)}
              style={{ transform: `scale(${ZOOM_STEPS[zoom]})` }}
              className="max-h-full max-w-full origin-center object-contain transition-transform"
            />
          </div>

          <p className="text-muted-foreground text-center text-xs">
            {t("photoViewerHint")}
          </p>
        </div>
      ) : null}
    </>
  );
}
