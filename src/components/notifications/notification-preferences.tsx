"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { setNotificationPreferenceAction } from "@/lib/actions/notification";

/**
 * Which notifications arrive, and — just as importantly — **which ones cannot
 * be switched off**.
 *
 * Only three categories exist, and they are the three that are genuinely
 * optional. A decision (approved, rejected, revoked) carries no category at
 * all, so it is unswitchable by construction rather than by a rule somebody has
 * to remember. The page says so in plain words instead of leaving a pilot to
 * discover it: letting someone unsubscribe from "your registration was
 * rejected" would be a compliance failure dressed as a preference.
 *
 * Rendered here rather than on a settings page because **F28 owns account
 * settings and does not exist yet** — a Settings section with one panel in it
 * would be a claim about a page the app does not have. F28 can move this.
 */

export type PreferenceRow = {
  category: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
};

/** The only categories that exist. Mirrors the `notification_category` enum. */
const CATEGORIES = [
  "booking_reminder",
  "registration_expiry",
  "zone_closure",
] as const;

export function NotificationPreferences({
  preferences,
}: {
  preferences: PreferenceRow[];
}) {
  const t = useTranslations("notifications");
  const [rows, setRows] = useState(() =>
    CATEGORIES.map((category) => {
      // Absent means on. Somebody who has never opened this page has no rows,
      // and defaulting those to off would silently mute every reminder.
      const stored = preferences.find((row) => row.category === category);
      return {
        category,
        emailEnabled: stored?.emailEnabled ?? true,
        inAppEnabled: stored?.inAppEnabled ?? true,
      };
    }),
  );
  const [pending, startTransition] = useTransition();
  const groupId = useId();

  function toggle(category: string, field: "emailEnabled" | "inAppEnabled") {
    const next = rows.map((row) =>
      row.category === category ? { ...row, [field]: !row[field] } : row,
    );
    setRows(next);

    const changed = next.find((row) => row.category === category);
    startTransition(async () => {
      const result = await setNotificationPreferenceAction(category, {
        emailEnabled: changed?.emailEnabled,
        inAppEnabled: changed?.inAppEnabled,
      });
      // Put the switch back if the server refused, rather than showing a
      // setting that is not the setting.
      if (!result.ok) setRows(rows);
    });
  }

  return (
    <section aria-labelledby={groupId} className="flex flex-col gap-3">
      <h2 id={groupId} className="text-sm font-medium">
        {t("preferencesTitle")}
      </h2>

      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.category}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
          >
            <span className="text-sm">{t(`category.${row.category}`)}</span>
            <span className="flex items-center gap-4">
              <Toggle
                label={t("inApp")}
                checked={row.inAppEnabled}
                disabled={pending}
                onChange={() => toggle(row.category, "inAppEnabled")}
              />
              <Toggle
                label={t("byEmail")}
                checked={row.emailEnabled}
                disabled={pending}
                onChange={() => toggle(row.category, "emailEnabled")}
              />
            </span>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground text-sm">{t("alwaysOnNotice")}</p>
    </section>
  );
}

/**
 * A real checkbox with a real label. Not a styled `div` with a click handler —
 * this is a control a screen reader has to be able to find and announce, and
 * the native element is the only version that comes with that for free.
 */
function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  const id = useId();
  return (
    <span className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="size-4 accent-current"
      />
      <label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </label>
    </span>
  );
}
