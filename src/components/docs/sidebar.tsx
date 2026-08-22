import { getTranslations } from "next-intl/server";
import { DocSelect } from "@/components/docs/doc-select";
import { Link } from "@/i18n/navigation";
import type { LoadedDoc } from "@/lib/docs";
import type { DocSlug } from "@/lib/docs/slugs";

/**
 * The six pages, in `order`, with the one being read marked.
 *
 * **Two controls, not one responsive one.** The list is a `<nav>` from `md` up
 * and a `<select>` below it, because a column of six links is a better control
 * where there is room and a worse one where there is not — and a list that
 * merely wraps at 375 px pushes the page's actual content below the fold on the
 * device most likely to be reading it in the field.
 *
 * `aria-current="page"` rather than styling alone: a screen-reader user gets
 * the same "you are here" the highlight gives everybody else.
 */
export async function DocsSidebar({
  docs,
  current,
}: {
  docs: readonly LoadedDoc[];
  current: DocSlug;
}) {
  const t = await getTranslations("docs");

  return (
    <>
      <DocSelect
        items={docs.map((doc) => ({ slug: doc.slug, title: doc.meta.title }))}
        current={current}
        label={t("sidebarLabel")}
      />

      <nav aria-label={t("sidebarLabel")} className="hidden md:block">
        <ul className="flex flex-col gap-1 border-s ps-4">
          {docs.map((doc) => {
            const active = doc.slug === current;
            return (
              <li key={doc.slug}>
                <Link
                  href={`/docs/${doc.slug}`}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "text-foreground block py-1 text-sm font-medium"
                      : "text-muted-foreground hover:text-foreground block py-1 text-sm"
                  }
                >
                  {doc.meta.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
