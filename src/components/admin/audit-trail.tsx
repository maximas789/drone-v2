import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { hasTrailLabel, trailLabelKey } from "@/lib/admin/audit-actions";
import { formatDateTime } from "@/lib/format";
import { isRole } from "@/lib/session";
import type { Locale } from "@/lib/locale";

export type TrailEvent = {
  id: string;
  action: string;
  entityType: string;
  reason: string | null;
  actorRole: string | null;
  actorIsSystem: boolean;
  actorUserId: string | null;
  createdAt: Date;
};

/**
 * This aircraft's history, as the regulator sees it.
 *
 * **One log, not two** — `audit_event` backs both the approval trail and the
 * ops activity log, and this is the approval-trail view of it. Append-only:
 * there is no edit control here and there must never be one, because the value
 * of the table is that nothing in the app can rewrite it.
 *
 * Three things are on every row and they are the three a regulator asks for:
 * **what happened**, **who did it in what role at the time**, and **why**. The
 * role is `actorRole` from the row, not a join to the user's current role — a
 * reviewer later promoted to admin must not retroactively appear to have acted
 * as one, which is the whole reason the column exists.
 *
 * **The reason is quoted verbatim.** It is the same text the pilot received; a
 * summarised or truncated version here would mean the trail and the email
 * disagree about what was said.
 *
 * An action with no catalogue entry renders as its raw dotted code rather than
 * throwing. `audit-actions.test.ts` makes that path a failing test rather than
 * a screen a reviewer meets, but the trail must render whatever the table
 * holds — a 500 on the approval log is far worse than an untranslated code.
 */
export function AuditTrail({
  events,
  locale,
}: {
  events: readonly TrailEvent[];
  locale: Locale;
}) {
  const t = useTranslations("review");
  const tRoles = useTranslations("roles");

  if (events.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("trailEmpty")}</p>;
  }

  return (
    <ol className="flex flex-col gap-4">
      {events.map((event) => (
        <li key={event.id} className="border-s-2 ps-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium">
              {hasTrailLabel(event.action)
                ? t(`auditActions.${trailLabelKey(event.action)}`)
                : event.action}
            </span>
            <span className="text-muted-foreground text-xs">
              {formatDateTime(event.createdAt, locale)}
            </span>
            {event.actorIsSystem ? (
              /*
                "The clock decided" versus "a person decided" is the split
                `actorIsSystem` exists for, and it must be visible: an expiry
                swept by a job is not a decision anybody is answerable for.
              */
              <Badge variant="outline">{t("actorSystem")}</Badge>
            ) : isRole(event.actorRole) ? (
              /*
                Through `isRole`, not straight into the catalogue.
                `audit_event.actorRole` is `text`, written from whatever
                `roleOf` returned at the time, and a row hand-edited or left by
                a role this build no longer has must not take the trail down
                with a missing key.
              */
              <Badge variant="secondary">{tRoles(event.actorRole)}</Badge>
            ) : null}
          </div>
          {event.reason ? (
            <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">
              {event.reason}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
