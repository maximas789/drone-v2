import { headers } from "next/headers";
import { auditCsvFilename, auditSections } from "@/lib/admin/audit-export";
import {
  auditFiltersFromSearch,
  auditFilterQuery,
} from "@/lib/admin/audit-filters";
import { csvBody } from "@/lib/analytics/csv";
import { audit, type Actor } from "@/lib/audit";
import { getSession } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import {
  AUDIT_EXPORT_LIMIT,
  listAuditEvents,
} from "@/lib/data/audit";
import { riyadhDayKey } from "@/lib/format";
import { clientIpFrom, hashIp } from "@/lib/ip-hash";
import { toLocale } from "@/lib/locale";
import { isAdmin, roleOf } from "@/lib/session";

/**
 * `GET /api/admin/audit` — **the filtered log as a CSV file, and an audit event
 * saying who took it.**
 *
 * **Admin only**, unlike `/api/admin/analytics` beside it, which a reviewer may
 * download. That file is aggregate counts with no person in it; this one names
 * who revealed whose identity and why, which is the whole reason the browser it
 * comes from is admin-only too. 404 rather than 403, like every other guarded
 * surface here: a 403 confirms the route exists.
 *
 * **A GET that writes, which is a deviation and worth naming.** The rule of
 * thumb is that a GET is safe and repeatable, and this one appends a row.
 * The alternative — an action returning a string and a client component
 * manufacturing an object URL — would be more code doing less, would break
 * middle-click and "save link as", and would still write the same row. So the
 * shape stays a link and the write is the deliberate exception. It is not a
 * mutation of anything a reader can observe: the export is repeatable, and each
 * repetition is honestly recorded as another export.
 *
 * **The filters travel, the cursor does not.** The file is the *filtered log*,
 * not the fifty rows that happened to be on screen. A regulator asking for
 * "every decision this reviewer made in August" wants all of them, capped at
 * `AUDIT_EXPORT_LIMIT` so a request cannot ask the database for the whole table.
 *
 * **The locale is a query parameter** because `next/root-params` throws in a
 * Route Handler (thread 4). The page that renders the link passes it, and it is
 * what makes the column headings and month names match the page they came from.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return new Response(null, { status: 404 });
  }

  const url = new URL(request.url);
  const filters = auditFiltersFromSearch(url.searchParams);
  const locale = toLocale(url.searchParams.get("locale") ?? undefined);

  const page = await listAuditEvents(session, filters, null, AUDIT_EXPORT_LIMIT);
  const body = csvBody(await auditSections(page.rows, locale));

  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders);
  const actor: Actor = {
    userId: session.user.id,
    role: roleOf(session),
    isSystem: false,
  };

  /**
   * The event is written **after** the rows are read and before the response
   * goes out, in a transaction of its own — the same `db.transaction` wrapper
   * `logLookup` uses, so `audit()` gets the executor it always requires. What
   * it records is the *scope* of the export: which filters, how many rows. Not
   * the rows themselves — the log must not double in size every time somebody
   * downloads it.
   */
  await db.transaction(async (tx) => {
    await audit(tx, {
      actor,
      entityType: "user",
      entityId: session.user.id,
      action: "user.audit_exported",
      after: {
        filters: auditFilterQuery(filters),
        rowCount: page.rows.length,
        truncated: page.nextCursor !== null,
      },
      ipHash: ip ? hashIp(ip) : null,
      userAgent: requestHeaders.get("user-agent"),
    });
  });

  return new Response(body, {
    headers: {
      /**
       * `charset=utf-8` **and** the BOM `csvBody` writes. The header is what a
       * browser and a text editor read; the BOM is what Excel reads, and Excel
       * is the reader an Arabic export exists for. Neither alone is enough.
       */
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${auditCsvFilename(riyadhDayKey(new Date()))}"`,
      /** Authorised for one session, and a snapshot of a moment. A shared cache
          holding this would serve one administrator's audit log to whoever
          asked next. */
      "Cache-Control": "private, no-store",
    },
  });
}
