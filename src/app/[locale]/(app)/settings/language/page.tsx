import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { LanguageForm } from "@/components/settings/language-form";
import { requireUser } from "@/lib/auth-guards";
import { getMyPreferredLocale } from "@/lib/data/user";
import { toLocale } from "@/lib/locale";
import type { Metadata } from "next";
import { privatePageTitle } from "@/lib/site/metadata";

/**
 * `/settings/language` — the language emails follow.
 *
 * **The stored preference is what this page shows, not the URL's locale.** They
 * can differ, and the difference is the whole point: someone reading in Arabic
 * because they clicked the header switcher has not thereby chosen to receive
 * Arabic mail. Showing the URL locale here would report a choice the person
 * never made, and would make the control appear already set to whatever they
 * happened to be reading.
 */
export default async function LanguageSettingsPage() {
  const urlLocale = toLocale(await localeParam());
  const session = await requireUser(urlLocale);
  const t = await getTranslations("settings");

  const preferred = await getMyPreferredLocale(session);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{t("language.title")}</h2>
        <p className="text-muted-foreground text-sm">{t("language.intro")}</p>
      </header>

      <LanguageForm current={preferred} />

      {/**
       * The sentence F28 asks for in as many words: this is not only the
       * interface. A pilot who switches to English and then cannot read their
       * own rejection notice has been failed by a control that looked cosmetic.
       */}
      <p className="text-muted-foreground text-sm">{t("language.affectsMail")}</p>
      <p className="text-muted-foreground text-sm">{t("language.headerNote")}</p>
    </section>
  );
}

/**
 * Its own tab title, from the same string this page renders as its heading.
 * `robots` comes from the route group's layout — see `PRIVATE_ROBOTS`.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/settings/language">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "settings.language.title");
}
