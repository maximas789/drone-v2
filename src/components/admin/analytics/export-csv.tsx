import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import type { RangeKey } from "@/lib/analytics/range";
import type { Locale } from "@/lib/locale";

/**
 * The CSV download — **a real anchor**, styled from `buttonVariants`.
 *
 * Not `<Button render={<a/>}>`: Base UI's `Button` expects a genuine
 * `<button>` and logs a console error otherwise, and its escape hatch
 * `nativeButton={false}` puts `role="button"` on the anchor, so a screen reader
 * announces a download as a button. The same reasoning that produced
 * `ButtonLink` — which is not used here only because this href leaves the
 * locale-prefixed route tree and so must not go through `@/i18n/navigation`.
 *
 * `download` is set, so a browser that would otherwise render `text/csv` inline
 * saves it instead; the `Content-Disposition` header says the same thing from
 * the server's side, and either alone has been enough to surprise somebody.
 *
 * The **locale travels in the query string** because the handler cannot read it
 * any other way (thread 4), and it is what makes the exported column headings
 * and month names match the page they were exported from.
 */
export async function ExportCsv({
  range,
  locale,
}: {
  range: RangeKey;
  locale: Locale;
}) {
  const t = await getTranslations("analytics");

  return (
    <a
      href={`/api/admin/analytics?range=${range}&locale=${locale}`}
      download
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      {t("exportCsv")}
    </a>
  );
}
