"use client";

import { useTranslations } from "next-intl";
import type { Locale } from "@/lib/locale";
import { formatDate } from "@/lib/format";

/**
 * Which aircraft is flying.
 *
 * **Ineligible drones are shown, disabled, with the reason** — never filtered
 * out. A pilot whose only aircraft is awaiting review opens this list, sees it
 * greyed with *"awaiting review"* beside it, and knows what to do. The same
 * list with that drone removed is an empty picker and a mystery, and the pilot
 * goes looking for a bug in the registration they completed yesterday.
 *
 * Radio buttons rather than a `<select>`, because each option carries two lines
 * — the Remote ID and the reason — and an `<option>` holds only text. The
 * Remote ID is shown because it is what the booking actually binds to and what
 * an inspector will ask for.
 */

export type BookableDrone = {
  id: string;
  nickname: string;
  /** `null` when the aircraft has never been approved, so has no code yet. */
  remoteIdCode: string | null;
  /** `null` when it is selectable; otherwise the catalogue key saying why not. */
  blockedReason: string | null;
  /** Shown when the registration expires inside the booking horizon. */
  expiresAt: string | null;
};

export function DroneSelect({
  drones,
  selected,
  onSelect,
  locale,
}: {
  drones: readonly BookableDrone[];
  selected: string | null;
  onSelect: (droneId: string) => void;
  locale: Locale;
}) {
  const t = useTranslations("booking");

  if (drones.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("dronesNone")}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {drones.map((drone) => {
        const blocked = drone.blockedReason !== null;
        return (
          <li key={drone.id}>
            <label
              className={[
                "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                blocked
                  ? "cursor-not-allowed border-dashed opacity-70"
                  : "hover:border-ring cursor-pointer",
                selected === drone.id ? "border-primary ring-3 ring-ring/40" : "",
              ].join(" ")}
            >
              <input
                type="radio"
                name="booking-drone"
                className="mt-1"
                value={drone.id}
                checked={selected === drone.id}
                disabled={blocked}
                onChange={() => onSelect(drone.id)}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{drone.nickname}</span>
                {drone.remoteIdCode ? (
                  /**
                   * `dir="ltr"` and monospace: a Remote ID is a code to be read
                   * character by character and compared against a sticker, not
                   * prose to be reflowed by the page's direction.
                   */
                  <span dir="ltr" className="text-muted-foreground font-mono text-xs">
                    {drone.remoteIdCode}
                  </span>
                ) : null}
                {blocked ? (
                  <span className="text-muted-foreground text-xs">
                    {t(drone.blockedReason as never)}
                  </span>
                ) : drone.expiresAt ? (
                  <span className="text-muted-foreground text-xs">
                    {t("droneExpiresOn", {
                      date: formatDate(new Date(drone.expiresAt), locale),
                    })}
                  </span>
                ) : null}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
