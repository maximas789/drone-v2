import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { NotificationToggles } from "@/components/settings/notification-toggles";
import { requireUser } from "@/lib/auth-guards";
import { getMyPreferences } from "@/lib/data/notification";
import { SWITCHABLE_CATEGORIES } from "@/lib/settings/notification-categories";
import { toLocale } from "@/lib/locale";

/**
 * `/settings/notifications` — the categories that are genuinely optional.
 *
 * **Absent means on.** Someone who has never opened this page has no preference
 * rows at all, and `notify()` reads a missing row as enabled — so the page
 * projects the enum over whatever rows exist rather than listing the rows.
 * Listing the rows would show a new account an empty page and imply nothing is
 * being sent.
 *
 * **Two switches, not three.** `notification_category` has three values and
 * only two of them are ever handed to `notify()`: F23c's closure fan-out passes
 * none, on purpose — *"a pilot who muted it would turn up to a closed zone."*
 * Offering a `zone_closure` switch would put a control here that changes
 * nothing, which is the failure F28 exists to avoid. Closures are named in the
 * always-sent sentence instead. `SWITCHABLE_CATEGORIES` carries the reasoning
 * and `notification-categories.test.ts` reads the source to stop it drifting.
 */
export default async function NotificationSettingsPage() {
  const locale = toLocale(await localeParam());
  const session = await requireUser(locale);
  const t = await getTranslations("settings");

  const rows = await getMyPreferences(session);
  const byCategory = new Map(rows.map((row) => [row.category, row]));

  const preferences = SWITCHABLE_CATEGORIES.map((category) => {
    const row = byCategory.get(category);
    return {
      category,
      emailEnabled: row?.emailEnabled ?? true,
      inAppEnabled: row?.inAppEnabled ?? true,
    };
  });

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{t("notifications.title")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("notifications.intro")}
        </p>
      </header>

      {/**
       * **Said in words, not shown as a disabled switch.** A greyed-out toggle
       * for "registration rejected" would imply the setting nearly exists and
       * invite somebody to ask for it to be enabled. There is no such setting,
       * because a decision notice carries no category for `notify()` to check —
       * so the page states the fact and leaves the controls to the three
       * things that really are optional.
       */}
      <p className="rounded-lg border p-4 text-sm">
        {t("notifications.decisionsAlways")}
      </p>

      <NotificationToggles preferences={preferences} />
    </section>
  );
}
