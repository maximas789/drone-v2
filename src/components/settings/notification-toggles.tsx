"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { setNotificationPreferenceAction } from "@/lib/actions/notification";

/**
 * The three categories a pilot may actually switch off.
 *
 * **Three, because three is how many the app sends optionally.** They are the
 * `notification_category` enum, and that enum is the same list `notify()`
 * checks — so a fourth toggle cannot appear here without a fourth category
 * existing, and a category cannot exist without something sending it. F28's
 * criterion *"no category for anything it doesn't send"* is that enum, not a
 * promise.
 *
 * **Decisions have no toggle because they have no category.** `notify()` takes
 * `category` as optional and skips the preference check when it is absent;
 * approval, rejection, revocation and expiry pass nothing. So "you cannot turn
 * off a rejection notice" is true by construction rather than by a rule
 * somebody has to keep remembering — and the page says so in words above,
 * rather than showing a disabled switch that implies it is nearly possible.
 *
 * `useOptimistic`, so a switch moves under the finger. If the write refuses,
 * React reverts it on the next render and the error appears — which is the
 * right pairing: the control must never be left showing a state the server
 * did not accept.
 */

export type CategoryPreference = {
  category: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
};

type Channel = "emailEnabled" | "inAppEnabled";

export function NotificationToggles({
  preferences,
}: {
  preferences: readonly CategoryPreference[];
}) {
  const t = useTranslations("settings");
  const tErrors = useTranslations("errors");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useOptimistic(
    preferences,
    (state, next: { category: string; channel: Channel; value: boolean }) =>
      state.map((row) =>
        row.category === next.category
          ? { ...row, [next.channel]: next.value }
          : row,
      ),
  );

  function toggle(category: string, channel: Channel, value: boolean) {
    startTransition(async () => {
      setError(null);
      setShown({ category, channel, value });
      const result = await setNotificationPreferenceAction(category, {
        [channel]: value,
      });
      if (!result.ok) setError(tErrors("generic"));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {shown.map((row) => (
        <div
          key={row.category}
          className="flex flex-col gap-3 rounded-lg border p-4"
        >
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              {t(`notifications.category.${row.category}.title`)}
            </span>
            <span className="text-muted-foreground text-sm">
              {t(`notifications.category.${row.category}.body`)}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {(
              [
                ["inAppEnabled", "notifications.inApp"],
                ["emailEnabled", "notifications.email"],
              ] as const
            ).map(([channel, label]) => (
              <label
                key={channel}
                className="flex items-center gap-2 text-sm"
              >
                <Switch
                  checked={row[channel]}
                  disabled={pending}
                  onChange={(event) =>
                    toggle(row.category, channel, event.target.checked)
                  }
                />
                {t(label)}
              </label>
            ))}
          </div>
        </div>
      ))}

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
