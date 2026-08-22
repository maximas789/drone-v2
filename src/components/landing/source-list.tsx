import { getLocale, getTranslations } from "next-intl/server";
import { REMOTE_ID_SOURCES } from "@/lib/landing/sources";
import { formatDate } from "@/lib/format";
import { toLocale } from "@/lib/locale";

/**
 * The regulatory documents behind a claim, with the date each one was read.
 *
 * **Shared by `/remote-id` and `docs/remote-id`**, which argue the same case
 * from the same seven documents. The "cited for" line under each entry lives in
 * the `remoteIdPage` catalogue namespace and is read from there rather than
 * copied into a `docs` one: two translations of "what this document is cited
 * for" is two chances for one of them to describe a source the page no longer
 * uses.
 *
 * `getLocale()` rather than a prop, because MDX cannot pass one — a component
 * used inside a content file has to be able to answer the question itself.
 * `next/root-params` would work in a page and throw in a Server Action, and
 * this component has no business knowing which of those it is inside.
 */
export async function SourceList() {
  const locale = toLocale(await getLocale());
  const t = await getTranslations("remoteIdPage");

  return (
    <ol className="flex flex-col gap-4">
      {REMOTE_ID_SOURCES.map((source) => (
        <li key={source.id} className="flex flex-col gap-1">
          <a
            href={source.url}
            /**
             * `noopener` because these open a new tab; `noreferrer` because a
             * regulator's server log has no business learning that the visitor
             * came from a page arguing about their own rules.
             */
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
            className="text-primary text-start text-sm underline underline-offset-4"
          >
            {source.title}
          </a>
          <p className="text-muted-foreground text-xs">
            {locale === "ar" ? source.publisherAr : source.publisherEn}
            {" · "}
            {t("retrievedOn", {
              date: formatDate(new Date(source.retrievedOn), locale),
            })}
          </p>
          <p className="text-muted-foreground text-sm">
            {t(`sources.${source.id}`)}
          </p>
        </li>
      ))}
    </ol>
  );
}
