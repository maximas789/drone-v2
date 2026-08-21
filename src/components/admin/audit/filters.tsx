import { useTranslations } from "next-intl";
import { DateFilter } from "./date-filter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { hasTrailLabel, trailLabelKey } from "@/lib/admin/audit-actions";
import type { AuditFilters as Filters } from "@/lib/admin/audit-filters";
import type { AuditActor } from "@/lib/data/audit";
import type { Locale } from "@/lib/locale";
import { ROLES } from "@/lib/session";

/**
 * The audit browser's filters, as an ordinary **GET form** — the same shape as
 * `QueueFilters`, and for the same three reasons: a filtered log is a **link**
 * an administrator can send to a colleague, the back button returns to the
 * previous filter rather than the previous page, and the whole control ships no
 * JavaScript.
 *
 * `action` is omitted deliberately: a GET form with no action submits to the
 * current URL, so this component does not need to know the locale prefix it is
 * rendered under.
 *
 * **The cursor is not a field.** Submitting the form must return to page one —
 * a cursor from the old filter set points at a row the new one may not contain,
 * and paging on from it would silently skip everything above it. Leaving it out
 * of the form is what drops it from the resulting URL.
 *
 * **Native `required` appears nowhere**, per the standing rule: it cancels the
 * submit and speaks the browser's language, so the app's own bilingual refusal
 * never runs. Nothing here is required anyway — every empty value means "no
 * filter", which is the whole point of the control.
 *
 * The **actions offered are the ones the table actually holds**, read from the
 * data rather than from the catalogue. An action this build can write but
 * nothing ever has is a filter option guaranteed to return nothing.
 */
export function AuditFilters({
  filters,
  filtered,
  actors,
  actions,
  entityTypes,
  years,
  locale,
}: {
  filters: Filters;
  filtered: boolean;
  actors: readonly AuditActor[];
  actions: readonly string[];
  entityTypes: readonly string[];
  /** The years the log can span, newest first. Computed on the page. */
  years: readonly number[];
  locale: Locale;
}) {
  const t = useTranslations("audit");
  const tReview = useTranslations("review");
  const tRoles = useTranslations("roles");
  /**
   * The three part labels come from `review`, where F22 wrote them for the
   * module validity window and F23b reused them for a closure. Three one-word
   * labels copied into `audit` would be another catalogue to keep in step for
   * no gain — the words are the same words.
   */
  const dateLabels = {
    day: tReview("dateDay"),
    month: tReview("dateMonth"),
    year: tReview("dateYear"),
  };

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border p-4"
      role="search"
      aria-label={t("filtersLabel")}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-actor">{t("filterActor")}</Label>
          <Select
            id="audit-actor"
            name="actor"
            defaultValue={filters.actor ?? ""}
          >
            <option value="">{t("filterAny")}</option>
            {actors.map((actor) => (
              <option key={actor.userId} value={actor.userId}>
                {actor.name ?? actor.email ?? t("actorUnnamed")}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-role">{t("filterRole")}</Label>
          <Select id="audit-role" name="role" defaultValue={filters.role ?? ""}>
            <option value="">{t("filterAny")}</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {tRoles(role)}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-action">{t("filterAction")}</Label>
          <Select
            id="audit-action"
            name="action"
            defaultValue={filters.action ?? ""}
          >
            <option value="">{t("filterAny")}</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {/* Labelled where this build knows the action, raw where it
                    does not — a row written by an earlier release must still be
                    selectable. */}
                {hasTrailLabel(action)
                  ? tReview(`auditActions.${trailLabelKey(action)}`)
                  : action}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-entity-type">{t("filterEntityType")}</Label>
          <Select
            id="audit-entity-type"
            name="entityType"
            defaultValue={filters.entityType ?? ""}
          >
            <option value="">{t("filterAny")}</option>
            {entityTypes.map((value) => (
              <option key={value} value={value}>
                {t.has(`entityTypes.${value}`) ? t(`entityTypes.${value}`) : value}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-entity-id">{t("filterEntityId")}</Label>
          <Input
            id="audit-entity-id"
            name="entityId"
            type="search"
            /* An id is never Arabic and never right-to-left. */
            dir="ltr"
            className="font-mono"
            defaultValue={filters.entityId ?? ""}
            maxLength={64}
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-from">{t("filterFrom")}</Label>
          {/*
            **Three selects, never `<input type="date">`** — thread 46, and
            `DateFilter` carries the full account of what the native control did
            to the Arabic page. The value it writes is `yyyy-mm-dd`, and the
            boundary that becomes is the **start of the Riyadh civil day**:
            filtering "from 19 August" at midnight UTC would drop three hours of
            a working evening onto the wrong side of the line.
          */}
          <DateFilter
            id="audit-from"
            name="from"
            value={filters.from ?? ""}
            years={years}
            labels={dateLabels}
            locale={locale}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-to">{t("filterTo")}</Label>
          {/* Inclusive: the predicate is `< riyadhDayEnd(to)`, so choosing the
              same day at both ends returns that day's events. */}
          <DateFilter
            id="audit-to"
            name="to"
            value={filters.to ?? ""}
            years={years}
            labels={dateLabels}
            locale={locale}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-system">{t("filterSystem")}</Label>
          {/*
            Three states, not a checkbox. "Show me what the sweep did overnight"
            and "show me what staff did" are different questions, and a
            two-state control can only ask one of them.
          */}
          <Select
            id="audit-system"
            name="system"
            defaultValue={
              filters.actorIsSystem === null
                ? ""
                : filters.actorIsSystem
                  ? "yes"
                  : "no"
            }
          >
            <option value="">{t("filterAny")}</option>
            <option value="yes">{t("systemOnly")}</option>
            <option value="no">{t("peopleOnly")}</option>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="audit-q">{t("filterSearch")}</Label>
          <Input
            id="audit-q"
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            maxLength={100}
            autoComplete="off"
            placeholder={t("filterSearchPlaceholder")}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline">
          {t("filterApply")}
        </Button>
        {filtered ? (
          /*
            A plain link back to the unfiltered path, not a button that clears
            the fields — clearing them leaves the URL saying one thing and the
            form another until somebody presses submit again.
          */
          <Link href="/admin/audit" className="text-sm underline">
            {t("filterReset")}
          </Link>
        ) : null}
      </div>
    </form>
  );
}
