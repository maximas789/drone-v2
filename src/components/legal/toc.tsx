import { getTranslations } from "next-intl/server";
import type { LegalSection } from "@/lib/legal";

/**
 * The table of contents for a legal document.
 *
 * **Every link is a plain in-page `<a href="#…">`, and there is no JavaScript
 * here at all.** F26's sidebar swaps its list for a `<select>` on a phone,
 * which needs a client component to navigate on change; that trade is worth it
 * for six *pages* and wrong for twelve *anchors*, where the browser already
 * does the whole job for free. Below `md` the list becomes a `<details>` — a
 * disclosure, not a control — so a phone reader sees the policy's first
 * paragraph rather than a screen of contents.
 *
 * Deliberately **not** `@/i18n/navigation`'s `Link`: a fragment is this page,
 * and prefixing it with a locale would turn a jump into a navigation. That is
 * the same exception `Anchor` in `src/mdx-components.tsx` already makes.
 *
 * `sticky top-6` only from `md` up, where the aside is a column beside the
 * text. Stuck to the top of a phone it would be a floating box over the words
 * it indexes.
 */
export async function LegalToc({
  sections,
}: {
  sections: readonly LegalSection[];
}) {
  const t = await getTranslations("legal");

  const list = (
    <ul className="flex flex-col gap-1 border-s ps-4">
      {sections.map((section) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="text-muted-foreground hover:text-foreground block py-1 text-sm"
          >
            {section.title}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <details className="rounded-lg border p-4 md:hidden">
        <summary className="cursor-pointer text-sm font-medium">
          {t("tocLabel")}
        </summary>
        <nav aria-label={t("tocLabel")} className="pt-3">
          {list}
        </nav>
      </details>

      <nav
        aria-label={t("tocLabel")}
        className="sticky top-6 hidden md:block"
      >
        <p className="mb-2 text-sm font-medium">{t("tocLabel")}</p>
        {list}
      </nav>
    </>
  );
}
