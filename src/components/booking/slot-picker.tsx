"use client";

import { useTranslations } from "next-intl";
import type { Slot, SlotState } from "@/lib/airspace/types";
import { formatTime } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { CapacityMeter } from "./capacity-meter";

/**
 * The day's grid, derived by [F13](../../../.claude/plans/features/F13-slots-and-concurrency.md)
 * and never stored.
 *
 * **Unavailable slots are shown, not hidden, and are genuinely unclickable.**
 * A grid that quietly drops full and closed slots looks like a zone with fewer
 * hours than it has, and a pilot cannot tell "nobody may fly then" from
 * "everybody already is". Each unavailable state says which it is.
 *
 * They are real `<button disabled>` elements rather than dimmed `<div>`s, so a
 * keyboard skips them, a screen reader announces them as unavailable, and a
 * pointer cannot activate one by accident. F20's criterion is that they be
 * *visually distinct and not clickable* — "never merely dimmed".
 */

/** The four ways a slot can be unavailable, each with its own sentence. */
const UNAVAILABLE: Record<SlotState, string> = {
  // Never read — `available` renders the capacity meter instead. Present so the
  // record is exhaustive over `SlotState` and a new state fails to compile.
  available: "slotAvailable",
  full: "slotFull",
  closed: "slotClosed",
  past: "slotPast",
  blocked: "slotBlocked",
};

export function SlotPicker({
  slots,
  capacity,
  selected,
  onSelect,
  locale,
  loading,
}: {
  slots: readonly Slot[];
  capacity: number;
  /** ISO `slotStart`, or `null` before one is chosen. */
  selected: string | null;
  onSelect: (slotStart: string) => void;
  locale: Locale;
  loading: boolean;
}) {
  const t = useTranslations("booking");

  if (loading) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t("slotsLoading")}
      </p>
    );
  }

  if (slots.length === 0) {
    /**
     * Not an error and not an empty box: a zone genuinely has no grid on a day
     * it does not open, and saying so is the answer.
     */
    return <p className="text-muted-foreground text-sm">{t("slotsNone")}</p>;
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {slots.map((slot) => {
        const available = slot.state === "available";
        const isSelected = slot.slotStart === selected;

        return (
          <li key={slot.slotStart}>
            <button
              type="button"
              disabled={!available}
              aria-pressed={isSelected}
              onClick={() => onSelect(slot.slotStart)}
              className={[
                "flex w-full flex-col gap-1.5 rounded-lg border p-3 text-start transition-colors",
                available
                  ? "hover:border-ring cursor-pointer"
                  : // Struck through and desaturated: two signals, because
                    // opacity alone is the "merely dimmed" this must not be.
                    "border-dashed opacity-70 cursor-not-allowed",
                isSelected ? "border-primary ring-3 ring-ring/40" : "",
              ].join(" ")}
            >
              {/**
               * `dir="ltr"` on the range — `06:00 – 08:00` inside an Arabic
               * page otherwise reads as ending before it starts.
               */}
              <span
                dir="ltr"
                className={`text-start font-medium tabular-nums ${available ? "" : "line-through"}`}
              >
                {formatTime(new Date(slot.slotStart), locale)} –{" "}
                {formatTime(new Date(slot.slotEnd), locale)}
              </span>

              {slot.state === "available" ? (
                <CapacityMeter
                  taken={slot.taken}
                  capacity={capacity}
                  locale={locale}
                />
              ) : (
                <span className="text-muted-foreground text-xs">
                  {t(UNAVAILABLE[slot.state] as never)}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
