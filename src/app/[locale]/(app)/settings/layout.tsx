import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { SettingsSectionNav } from "@/components/settings/section-nav";
import { requireUser } from "@/lib/auth-guards";
import { toLocale } from "@/lib/locale";
import { roleOf } from "@/lib/session";
import { sectionsFor } from "@/lib/settings/sections";

/**
 * The settings shell: a section list beside the section being read.
 *
 * **The guard is repeated here even though `(app)/layout.tsx` already ran
 * one.** A layout guard protects a page and never an action, and this one earns
 * its place for a second reason: it is where the *role* is read, and the role
 * decides which sections exist for this person. Reading it in the layout means
 * one read for the whole subtree rather than one per page.
 *
 * `sectionsFor` filters for **visibility only**. Every page under here calls
 * its own guard — hiding a link from a pilot is a courtesy, not a boundary.
 */
export default async function SettingsLayout({
  children,
}: LayoutProps<"/[locale]/settings">) {
  const locale = toLocale(await localeParam());
  const session = await requireUser(locale);
  const t = await getTranslations("settings");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("intro")}</p>
      </header>

      {/**
       * `minmax(0, 1fr)` on the content column, not `1fr`: a grid item's
       * default minimum is its content, so one wide child would push the whole
       * page sideways instead of scrolling inside its own box.
       */}
      <div className="grid gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
        <SettingsSectionNav sections={sectionsFor(roleOf(session))} />
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </div>
    </main>
  );
}
