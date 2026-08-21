import { csvBody, csvFilename } from "@/lib/analytics/csv";
import { analyticsSections } from "@/lib/analytics/export";
import { getAnalytics } from "@/lib/analytics/queries";
import { toRangeKey } from "@/lib/analytics/range";
import { getSession } from "@/lib/auth-guards";
import { riyadhDayKey } from "@/lib/format";
import { toLocale } from "@/lib/locale";
import { isReviewer } from "@/lib/session";

/**
 * `GET /api/admin/analytics` — the current analytics view as a CSV file.
 *
 * **A route handler and a plain link, not an action and a Blob.** A download is
 * a navigation to a file: an `<a href>` works with the keyboard, with
 * middle-click, with "save link as", and with JavaScript disabled, and the URL
 * can be pasted to a colleague. Building the same thing out of a server action
 * that returns a string and a client component that manufactures an
 * `URL.createObjectURL` would be more code doing less.
 *
 * **The locale is a query parameter.** `next/root-params` throws in a Route
 * Handler (thread 4), so the one place that knows the reader's language — the
 * page that renders the link — passes it, and `analyticsSections` calls
 * `getTranslations({ locale })` with it. A bare `getTranslations()` here would
 * fail at runtime with every static check green.
 *
 * **Reviewer-level, and it answers 404 rather than 403.** Same rule as every
 * other guarded surface in this build: a 403 confirms the route exists.
 *
 * **This export is deliberately not audited.** F25's audited export is the
 * *audit browser's*, in F25b — a full dump of who decided what and why, which
 * is a serious act. This one is aggregate counts with no personal data in it at
 * all: no name, no Remote ID code, no document number, not even a zone a single
 * booking could be identified from. Writing an audit event every time a
 * reviewer downloaded a bar chart would bury the exports that matter, which is
 * the same reasoning F25 gives for not auditing plain audit-log browsing.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !isReviewer(session)) {
    return new Response(null, { status: 404 });
  }

  const url = new URL(request.url);
  const range = toRangeKey(url.searchParams.get("range") ?? undefined);
  const locale = toLocale(url.searchParams.get("locale") ?? undefined);

  const now = new Date();
  const data = await getAnalytics(session, range, now);
  const body = csvBody(await analyticsSections(data, locale));

  return new Response(body, {
    headers: {
      /**
       * `charset=utf-8` **and** the BOM the writer emits. The header is what a
       * browser and a text editor read; the BOM is what Excel reads, and Excel
       * is the reader this file exists for. Neither alone is enough.
       */
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(range, riyadhDayKey(now))}"`,
      /**
       * Private and uncached: this response was authorised for one session, and
       * it is a snapshot of a moment. A shared cache holding it would serve a
       * stale dashboard to whoever asked next.
       */
      "Cache-Control": "private, no-store",
    },
  });
}
