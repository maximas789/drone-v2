import { getTranslations } from "next-intl/server";
import { Select } from "@/components/ui/select";
import { EMAIL_STATUSES } from "@/lib/ops/email-log";

/**
 * Status and template, as a plain **GET form**.
 *
 * No client component and no JavaScript: the filters belong in the URL so an
 * operator can send somebody "look at this" and have them see the same rows.
 * A `<select onChange>` router push would give the same list and a link that
 * means nothing when pasted.
 *
 * `Select` is the native control — the same call F17's form made, and it
 * matters here for the same reason: the browser opens it correctly under
 * `dir="rtl"` with no work from us.
 *
 * The submit button is real and stays visible. A form that only submits on
 * change is a form a keyboard user has to guess at.
 */
export async function EmailFilters({
  templates,
  status,
  template,
}: {
  templates: string[];
  status?: string;
  template?: string;
}) {
  const t = await getTranslations("ops");

  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-lg border p-3"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="status" className="text-muted-foreground text-xs">
          {t("email.filterStatus")}
        </label>
        <Select
          id="status"
          name="status"
          defaultValue={status ?? ""}
          className="w-40"
        >
          <option value="">{t("email.filterAll")}</option>
          {EMAIL_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`email.status.${value}`)}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="template" className="text-muted-foreground text-xs">
          {t("email.filterTemplate")}
        </label>
        <Select
          id="template"
          name="template"
          defaultValue={template ?? ""}
          className="w-56"
        >
          <option value="">{t("email.filterAll")}</option>
          {/* Only templates that actually appear in the log — an option that
              matches nothing is a filter that looks broken when used. */}
          {templates.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </div>

      <button
        type="submit"
        className="bg-secondary text-secondary-foreground h-8 rounded-lg px-3 text-sm font-medium"
      >
        {t("email.filterApply")}
      </button>
    </form>
  );
}
