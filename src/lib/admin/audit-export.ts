import "server-only";

import { getTranslations } from "next-intl/server";
import { hasTrailLabel, trailLabelKey } from "@/lib/admin/audit-actions";
import { diffFields } from "@/lib/admin/audit-diff";
import type { CsvSection } from "@/lib/analytics/csv";
import type { AuditBrowserRow } from "@/lib/data/audit";
import { formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * The filtered log as one CSV section.
 *
 * **The writer is F25a's** — `src/lib/analytics/csv.ts` already owns the BOM
 * that keeps Arabic readable in Excel, the CRLF line endings RFC 4180 asks for,
 * the quoting, and the tab that defuses a leading `=` so a rejection reason
 * beginning with one is not executed as a formula on open. This file only
 * decides what the columns say. That defusing matters more here than it did
 * there: every row of this export carries free text a member of staff typed.
 *
 * **`getTranslations({ locale })` with the locale passed in.**
 * `next/root-params` throws in a Route Handler (thread 4), so the page that
 * renders the download link puts the locale in the query string and it arrives
 * here as an argument. A bare `getTranslations()` would fail at runtime with
 * every static check green.
 *
 * **The changes column is the same field-level diff the screen shows**, flattened
 * to one cell — `field: before → after`, semicolon separated. Not the raw JSON:
 * a spreadsheet cell holding a serialised object is a cell nobody reads, and the
 * export is meant to be the screen, portable.
 */
export async function auditSections(
  rows: readonly AuditBrowserRow[],
  locale: Locale,
): Promise<CsvSection[]> {
  const t = await getTranslations({ locale, namespace: "audit" });
  const tReview = await getTranslations({ locale, namespace: "review" });
  const tRoles = await getTranslations({ locale, namespace: "roles" });

  return [
    {
      title: t("title"),
      head: [
        t("colWhen"),
        t("colActor"),
        t("filterRole"),
        t("filterSystem"),
        t("colAction"),
        t("colEntity"),
        t("filterEntityId"),
        t("colReason"),
        t("diffTitle"),
      ],
      rows: rows.map((row) => [
        formatDateTime(row.createdAt, locale),
        row.actorIsSystem
          ? t("actorSystem")
          : (row.actorName ??
            (row.actorUserId ? t("actorUnnamed") : t("actorDeleted"))),
        /* The role **at the time**, verbatim from the row. Unrecognised values
           pass through as themselves rather than through a missing key. */
        row.actorRole && tRoles.has(row.actorRole)
          ? tRoles(row.actorRole)
          : (row.actorRole ?? ""),
        row.actorIsSystem ? t("systemOnly") : t("peopleOnly"),
        hasTrailLabel(row.action)
          ? tReview(`auditActions.${trailLabelKey(row.action)}`)
          : row.action,
        t.has(`entityTypes.${row.entityType}`)
          ? t(`entityTypes.${row.entityType}`)
          : row.entityType,
        row.entityId,
        row.reason ?? "",
        changesCell(row, t),
      ]),
    },
  ];
}

type Translator = Awaited<ReturnType<typeof getTranslations<"audit">>>;

function changesCell(row: AuditBrowserRow, t: Translator): string {
  const fields = diffFields(row.before, row.after);
  const parts = fields.map((field) => {
    const label = t.has(`fields.${field.field}`)
      ? t(`fields.${field.field}`)
      : field.field;
    const absent = t("diffAbsent");
    return `${label}: ${field.before ?? absent} → ${field.after ?? absent}`;
  });
  /**
   * A boundary change is a **map** on screen and has no honest one-cell form,
   * so the export names it rather than pasting four hundred coordinates into a
   * spreadsheet. `diffFields` already drops the `geometry` key for this reason.
   */
  if (row.action === "zone.geometry_changed") {
    parts.unshift(t("geometryTitle"));
  }
  return parts.join("; ");
}

/** Latin only and no spaces — a `Content-Disposition` carrying Arabic needs
    RFC 5987 encoding, and a filename is not where this app's bilingualism has
    to be proved. Same rule as `csvFilename`. */
export function auditCsvFilename(day: string): string {
  return `ajniha-audit-${day}.csv`;
}
