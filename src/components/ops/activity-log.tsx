import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button-link";
import { formatDateTime } from "@/lib/format";
import { trailLabelKey } from "@/lib/admin/audit-actions";
import type { AuditBrowserRow } from "@/lib/data/audit";
import type { Locale } from "@/lib/locale";

/**
 * The operational slice of the audit trail — **not a second log**.
 *
 * F25b's browser is the full-power view: nine filters, keyset pagination, a
 * field-level diff. This is the newest events and a link through to it, because
 * an operator on the system page wants *"what has been happening"* and not a
 * query builder. The rows come from the same `listAuditEvents` reader, so there
 * is one table, one query and no possibility of the two disagreeing — which is
 * the whole of F14's "one log, not two".
 *
 * **The actor may be `null`**, and that is not a rendering gap: F28c's account
 * deletion clears `actor_user_id` and leaves the event. A row that reads
 * "deleted account" is the trail doing exactly what the privacy policy promises.
 */
export async function ActivityLog({
  rows,
  locale,
}: {
  rows: AuditBrowserRow[];
  locale: Locale;
}) {
  const t = await getTranslations("ops");
  const tAudit = await getTranslations("review.auditActions");
  const tBrowser = await getTranslations("audit");

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border p-4 text-sm">
        {t("activity.none")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-2 text-sm"
          >
            <span className="font-medium">
              {/* The label table is F25b's, keyed the same way. A future action
                  with no label falls back to its code rather than to a blank. */}
              {tAudit.has(trailLabelKey(row.action))
                ? tAudit(trailLabelKey(row.action))
                : row.action}
            </span>
            <span className="text-muted-foreground text-xs">
              {row.actorIsSystem
                ? tBrowser("actorSystem")
                : (row.actorName ??
                  row.actorEmail ??
                  tBrowser("actorDeleted"))}
              {" · "}
              {formatDateTime(row.createdAt, locale)}
            </span>
          </li>
        ))}
      </ul>

      <ButtonLink href="/admin/audit" size="sm" variant="outline" className="self-start">
        {t("activity.openBrowser")}
      </ButtonLink>
    </div>
  );
}
