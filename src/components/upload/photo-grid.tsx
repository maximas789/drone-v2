"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  deleteDronePhotoAction,
  reorderDronePhotosAction,
} from "@/lib/actions/upload";
import { formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * The uploaded photographs, in the pilot's own order.
 *
 * **Reordering is buttons, not drag-and-drop.** Drag has no keyboard path and
 * no screen-reader story, and the two directions are *earlier* and *later* —
 * which in Arabic are physically the opposite way round from English. Naming
 * them by position in the sequence rather than by direction on screen is the
 * only version that reads correctly in both.
 */

export type PhotoRow = {
  id: string;
  url: string;
  kind: string;
  sortOrder: number;
};

/**
 * Optimism, expressed as an intent rather than as a new array.
 *
 * **`useState(props)` was the bug this replaces.** The rows are the server's,
 * and the dropzone above re-fetches the route after every upload precisely so
 * they arrive — but `useState` reads its argument on the first render only, so
 * the grid kept its mount-time copy for ever and swallowed each fresh payload.
 * The photograph was in the database, the refresh returned it, and the pilot
 * saw an empty grid telling them one was required. `useOptimistic` *derives*
 * from the prop, so a new payload wins and the intent survives only as long as
 * the transition that owns it — which is also the whole rollback story: a
 * refused action needs no manual restore, it just stops being applied.
 */
type Intent =
  | { type: "remove"; id: string }
  | { type: "reorder"; order: readonly string[] };

function applyIntent(current: PhotoRow[], intent: Intent): PhotoRow[] {
  if (intent.type === "remove") {
    return current.filter((photo) => photo.id !== intent.id);
  }
  // Reorder by id, so a payload that arrived mid-transition — one row fewer, or
  // one more — reorders what actually exists instead of indexing off the end.
  const byId = new Map(current.map((photo) => [photo.id, photo]));
  const moved = intent.order
    .map((id) => byId.get(id))
    .filter((photo): photo is PhotoRow => photo !== undefined);
  const rest = current.filter((photo) => !intent.order.includes(photo.id));
  return [...moved, ...rest];
}

export function PhotoGrid({
  droneId,
  photos: initial,
  locale,
  editable = true,
}: {
  droneId: string;
  photos: PhotoRow[];
  locale: Locale;
  editable?: boolean;
}) {
  const t = useTranslations("upload");
  const tErrors = useTranslations("errors");
  const [photos, intend] = useOptimistic(initial, applyIntent);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(
    null,
  );

  function report(reason: { code: string; params?: Record<string, unknown> }) {
    setNotice({
      tone: "error",
      text:
        reason.code === "rate_limited"
          ? tErrors("rateLimited", {
              duration: formatSeconds(
                Number(reason.params?.retryAfterSeconds ?? 0),
                locale,
              ),
            })
          : reason.code === "upload_target_locked"
            ? tErrors("uploadTargetLocked")
            : tErrors("generic"),
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      intend({ type: "remove", id });
      const result = await deleteDronePhotoAction(id);
      if (!result.ok) return report(result.reasons[0]);
      setNotice({ text: t("removed"), tone: "ok" });
    });
  }

  function move(index: number, delta: -1 | 1) {
    const next = [...photos];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const order = next.map((photo) => photo.id);

    startTransition(async () => {
      // Optimistic: the order is the pilot's own intent, and re-rendering it
      // only after a round trip makes the buttons feel broken. Applied inside
      // the transition, which is what scopes it — and what reverts it.
      intend({ type: "reorder", order });
      const result = await reorderDronePhotosAction(droneId, order);
      if (!result.ok) return report(result.reasons[0]);
      setNotice({ text: t("reordered"), tone: "ok" });
    });
  }

  if (photos.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm font-medium">{t("empty")}</p>
        <p className="mt-1 text-xs">{t("emptyHelp")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo, index) => (
          <li
            key={photo.id}
            className="border-border overflow-hidden rounded-lg border"
          >
            {/* Not next/image: these are user uploads behind an authenticated
                route, so there is nothing for the optimiser to pre-size and a
                loader would only add a second fetch path to the same bytes. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={t("photoAlt", { index: index + 1 })}
              className="aspect-square w-full object-cover"
            />
            {editable ? (
              <div className="flex items-center justify-between gap-1 p-1.5">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending || index === 0}
                    aria-label={t("moveEarlier")}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending || index === photos.length - 1}
                    aria-label={t("moveLater")}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </Button>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => remove(photo.id)}
                >
                  {pending ? t("removing") : t("remove")}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {notice ? (
        <p
          role="alert"
          className={
            notice.tone === "ok"
              ? "text-muted-foreground text-sm"
              : "text-destructive text-sm"
          }
        >
          {notice.text}
        </p>
      ) : null}
    </div>
  );
}
