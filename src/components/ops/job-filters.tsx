import { getTranslations } from "next-intl/server";
import { Select } from "@/components/ui/select";
import { JOB_STATUSES } from "@/lib/ops/jobs";

/**
 * Status and function, as a plain **GET form** — `EmailFilters`' shape exactly,
 * for its reasons: the filters belong in the URL so an operator can send
 * somebody "look at this" and have them see the same rows, and the native
 * `Select` opens correctly under `dir="rtl"` with no work from us.
 *
 * **Its own parameter names.** `runStatus` and `runFunction` rather than
 * `status` and `template`, because the two panels sit on one page and are read
 * together when something has gone wrong — filtering the runs must not silently
 * reset a filtered view of the mail beside it.
 *
 * The panel needed this more than the email log did. `booking-closeout` runs
 * every fifteen minutes, so an unfiltered newest-50 spans about eight hours: an
 * operator asking why last night's sweep failed would find the scheduled table
 * saying **Failed** and the row holding the message already gone.
 */
export async function JobFilters({
  functionIds,
  status,
  functionId,
}: {
  functionIds: string[];
  status?: string;
  functionId?: string;
}) {
  const t = await getTranslations("ops");

  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-lg border p-3"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="runStatus" className="text-muted-foreground text-xs">
          {t("jobs.filterStatus")}
        </label>
        <Select
          id="runStatus"
          name="runStatus"
          defaultValue={status ?? ""}
          className="w-40"
        >
          <option value="">{t("jobs.filterAll")}</option>
          {JOB_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`jobs.status.${value}`)}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="runFunction" className="text-muted-foreground text-xs">
          {t("jobs.filterFunction")}
        </label>
        <Select
          id="runFunction"
          name="runFunction"
          defaultValue={functionId ?? ""}
          className="w-56"
        >
          <option value="">{t("jobs.filterAll")}</option>
          {/* Only functions that have actually produced a run — an option that
              matches nothing is a filter that looks broken when used. */}
          {functionIds.map((value) => (
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
        {t("jobs.filterApply")}
      </button>
    </form>
  );
}
