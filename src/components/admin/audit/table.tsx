import { useTranslations } from "next-intl";
import { Fragment } from "react";
import { DiffView } from "./diff-view";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { hasTrailLabel, trailLabelKey } from "@/lib/admin/audit-actions";
import type { AuditBrowserRow } from "@/lib/data/audit";
import { formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { isRole } from "@/lib/session";

/**
 * The audit stream — **every row in the table, newest first.**
 *
 * A `<table>`, not a list of cards. This screen is read by somebody comparing
 * rows: what did this reviewer do at 14:05 against what the sweep did at 14:06.
 * Columns line those up and cards do not. It is wrapped in an
 * `overflow-x-auto` so the *table* scrolls at 1024 px rather than the page —
 * under RTL a horizontally scrolling document is the failure hardest to notice
 * (thread 62).
 *
 * **Each event is two rows**: the data, then a full-width row holding the
 * expandable diff. See the note at the map for why the detail cannot live in
 * the reason cell.
 *
 * **`actorRole` comes from the row, never from a join.** A reviewer later
 * promoted to admin must not retroactively appear to have acted as one; that
 * asymmetry is the entire reason the column exists. The actor's *name* is
 * joined, because a name is not a claim about authority — and when the account
 * has been deleted the join gives null and the row says so, which is the
 * criterion "a deleted user's events remain".
 *
 * **There is no edit control here, and no delete control, and there must never
 * be one.** No server action in this codebase updates or deletes an
 * `audit_event`; `audit-integrity.test.ts` greps for one and fails if it
 * appears. The value of this table is that nothing in the app can rewrite it,
 * and a UI affordance would be the first step to making that untrue.
 */
export function AuditTable({
  rows,
  locale,
}: {
  rows: readonly AuditBrowserRow[];
  locale: Locale;
}) {
  const t = useTranslations("audit");
  const tReview = useTranslations("review");
  const tRoles = useTranslations("roles");

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <caption className="sr-only">{t("tableCaption")}</caption>
        <thead>
          <tr className="text-muted-foreground border-b text-xs">
            <th scope="col" className="px-2 py-2 text-start font-medium">
              {t("colWhen")}
            </th>
            <th scope="col" className="px-2 py-2 text-start font-medium">
              {t("colActor")}
            </th>
            <th scope="col" className="px-2 py-2 text-start font-medium">
              {t("colAction")}
            </th>
            <th scope="col" className="px-2 py-2 text-start font-medium">
              {t("colEntity")}
            </th>
            <th scope="col" className="px-2 py-2 text-start font-medium">
              {t("colReason")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            /*
              **Two rows per event, not one.** The detail lives in a row of its
              own spanning every column, because the boundary diff is a *map*
              and a map inside the reason cell gets that column's width — which
              at this table's proportions is seventy-five pixels. The first
              version put the `<details>` in the last cell and the map rendered
              as a sliver; found by measuring the canvas, not from a screenshot,
              because a 75×254 MapLibre canvas looks like a scrollbar.
            */
            <Fragment key={row.id}>
            <tr className="align-top">
              <td className="px-2 py-2 whitespace-nowrap">
                {/*
                  `<bdi>`, never `dir="ltr"`. `formatDateTime` puts an Arabic
                  month name between Latin numerals, and a forced direction
                  sets `19 أغسطس 2026 15:00` backwards — the month is a strong
                  RTL run and the numerals around it are neutral. `innerText`
                  stays correct either way, so only a screenshot catches it.
                */}
                <bdi className="text-muted-foreground text-xs">
                  {formatDateTime(row.createdAt, locale)}
                </bdi>
              </td>

              <td className="px-2 py-2">
                <div className="flex flex-col gap-1">
                  {row.actorIsSystem ? (
                    /*
                      "The clock decided" versus "a person decided" is the split
                      `actorIsSystem` exists for. An expiry swept by a job is
                      not a decision anybody is answerable for, and the log must
                      not let the two look alike.
                    */
                    <Badge variant="outline">{t("actorSystem")}</Badge>
                  ) : (
                    <>
                      <span className="font-medium">
                        {row.actorName ??
                          (row.actorUserId
                            ? t("actorUnnamed")
                            : t("actorDeleted"))}
                      </span>
                      {isRole(row.actorRole) ? (
                        /* Through `isRole`: `actorRole` is `text`, and a row
                           left by a role this build no longer has must not take
                           the append-only log down with a missing key. */
                        <Badge variant="secondary" className="w-fit">
                          {tRoles(row.actorRole)}
                        </Badge>
                      ) : null}
                    </>
                  )}
                </div>
              </td>

              <td className="px-2 py-2">
                <span className="font-medium">
                  {hasTrailLabel(row.action) ? (
                    tReview(`auditActions.${trailLabelKey(row.action)}`)
                  ) : (
                    /* A future action this build has not caught up with renders
                       as its raw code rather than throwing. */
                    <span dir="ltr" className="font-mono text-xs">
                      {row.action}
                    </span>
                  )}
                </span>
              </td>

              <td className="px-2 py-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs">
                    {t.has(`entityTypes.${row.entityType}`)
                      ? t(`entityTypes.${row.entityType}`)
                      : row.entityType}
                  </span>
                  <EntityId
                    entityType={row.entityType}
                    entityId={row.entityId}
                    open={t("openEntity")}
                  />
                </div>
              </td>

              <td className="px-2 py-2">
                {row.reason ? (
                  /* Verbatim, and `dir="auto"`: a reviewer's sentence is the
                     one string here whose direction is not the page's.
                     Summarising it would mean the log and the email the pilot
                     received disagree about what was said. */
                  <p dir="auto" className="whitespace-pre-wrap">
                    {row.reason}
                  </p>
                ) : null}
              </td>
            </tr>

            <tr className="border-b">
              <td colSpan={5} className="px-2 pb-2">
                {/*
                  **A `<details>`, and that is not a shortcut.** Expanding a row
                  needs no JavaScript at all, works with the keyboard by
                  default, is announced correctly by a screen reader, and
                  survives the page being printed. A `useState` toggle would
                  ship a client bundle to do worse.
                */}
                <details className="text-xs">
                  <summary className="text-muted-foreground cursor-pointer select-none">
                    {t("details")}
                  </summary>
                  <div className="mt-2">
                    <DiffView
                      before={row.before}
                      after={row.after}
                      locale={locale}
                    />
                  </div>
                </details>
              </td>
            </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The entity id, linked **only where the id is genuinely the route's id.**
 *
 * `pilot_profile` events carry the *profile's* id while `/admin/pilots/[id]`
 * takes a **user** id, and `remote_id`, `zone_closure`, `city` and
 * `drone_report` have no detail route at all. A link that 404s on an
 * append-only log reads as a fault in the log rather than as a missing screen,
 * so those render as a plain code. The id is still shown and still filterable —
 * clicking the code narrows the browser to that record's own timeline, which is
 * the thing a reader actually wants.
 */
function EntityId({
  entityType,
  entityId,
  open,
}: {
  entityType: string;
  entityId: string;
  open: string;
}) {
  const href = entityHref(entityType, entityId);
  const code = (
    <span dir="ltr" className="font-mono text-xs break-all">
      {entityId}
    </span>
  );

  return (
    <div className="flex flex-col gap-0.5">
      {/*
        Every id links to its own filtered view of the log. `entityId` alone,
        not `entityType` as well: a drone and its Remote ID are different types
        with different ids, and a reader chasing one record wants the id.
      */}
      <Link
        href={{ pathname: "/admin/audit", query: { entityId } }}
        className="underline decoration-dotted"
      >
        {code}
      </Link>
      {href ? (
        <Link href={href} className="text-xs underline">
          {open}
        </Link>
      ) : null}
    </div>
  );
}

function entityHref(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case "drone":
      return `/admin/drones/${entityId}`;
    case "booking":
      return `/admin/bookings/${entityId}`;
    case "zone":
      return `/admin/zones/${entityId}`;
    /** `/admin/pilots/[id]` takes a **user** id, which is exactly what a
        `user` event carries — and exactly what a `pilot_profile` event does
        not. */
    case "user":
      return `/admin/pilots/${entityId}`;
    default:
      return null;
  }
}
