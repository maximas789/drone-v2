import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth-guards";
import { toLocale } from "@/lib/locale";
import { roleOf } from "@/lib/session";
import { sectionsFor } from "@/lib/settings/sections";

/**
 * `/settings` — the index.
 *
 * **A page, not a redirect to `/settings/profile`.** A redirect would make the
 * URL somebody bookmarks or is sent by support land somewhere other than where
 * it points, and it would leave the section list with no home of its own on a
 * phone, where the nav is a scrolling row rather than a column always in view.
 *
 * Each card carries the section's one-line description — the same string the
 * section's own page shows under its heading, from one message key, so the
 * promise made here and the page reached cannot drift apart.
 */
export default async function SettingsIndexPage() {
  const locale = toLocale(await localeParam());
  const session = await requireUser(locale);
  const t = await getTranslations("settings");

  return (
    <ul className="flex flex-col gap-3">
      {sectionsFor(roleOf(session)).map((section) => (
        <li key={section.slug}>
          <Link
            href={section.href}
            className="hover:bg-muted/50 flex flex-col gap-1 rounded-lg border p-4 transition-colors"
          >
            <span className="text-sm font-medium">
              {t(`${section.slug}.title`)}
            </span>
            <span className="text-muted-foreground text-sm">
              {t(`${section.slug}.intro`)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
