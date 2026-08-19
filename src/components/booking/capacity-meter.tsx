"use client";

import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * `2 / 4` — how many seats of a slot are gone.
 *
 * **A real count, not a word.** "Limited availability" is the phrasing that
 * lets a booking system be vague about the number it already knows; a pilot
 * deciding between two slots wants the number.
 *
 * The bar is `aria-hidden` and the figures carry the meaning, because a screen
 * reader cannot see a bar and a percentage read aloud is not the answer to
 * "how many seats are left".
 */
export function CapacityMeter({
  taken,
  capacity,
  locale,
}: {
  taken: number;
  capacity: number;
  locale: Locale;
}) {
  const t = useTranslations("booking");
  const full = capacity > 0 && taken >= capacity;
  const fraction = capacity > 0 ? Math.min(1, taken / capacity) : 1;

  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="bg-input h-1.5 w-10 shrink-0 overflow-hidden rounded-full"
      >
        <span
          className={`block h-full rounded-full ${full ? "bg-destructive" : "bg-primary"}`}
          style={{ inlineSize: `${fraction * 100}%` }}
        />
      </span>
      {/**
       * `dir="ltr"` on the fraction: `2 / 4` inside an Arabic paragraph
       * otherwise reorders to `4 / 2`, which reads as a slot with more seats
       * taken than it has.
       */}
      <span dir="ltr" className="text-xs tabular-nums">
        {t("capacityOf", {
          taken: formatNumber(taken, locale),
          capacity: formatNumber(capacity, locale),
        })}
      </span>
    </span>
  );
}
