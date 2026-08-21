import { useTranslations } from "next-intl";
import { GeometryDiffMount } from "./geometry-diff-mount";
import { diffFields, geometryDiff } from "@/lib/admin/audit-diff";
import type { Locale } from "@/lib/locale";

/**
 * What one event changed — **field by field, not a JSON dump.**
 *
 * F25's criterion is one sentence: *"the diff is field-level, not raw JSON"*.
 * The reason is that an administrator reading why a booking was cancelled
 * should not have to spot a changed character inside two pretty-printed blobs.
 * Only the rows that differ are listed; a key repeated identically on both
 * sides is context the reader already has from the row above.
 *
 * **A boundary change is the exception, and it renders as a map.** That is the
 * one value where the textual diff is genuinely unreadable and also the one
 * where the change matters most — moving a boundary can put an already-approved
 * flight inside a no-fly area.
 *
 * A key with no catalogue entry renders as its **raw JSON key**, not as a
 * missing-message error. Thirty-odd call sites write these payloads and a
 * future one will write a field this build has never named; an untranslated
 * `slotDurationMinutes` on the screen is ugly, and a 500 on the append-only log
 * is a great deal worse.
 *
 * Values are shown verbatim with `dir="auto"`: a stored value may be an Arabic
 * zone name, an ISO instant, or a uuid, and imposing the page's direction on
 * all three sets the wrong one at the wrong end for two of them.
 */
export function DiffView({
  before,
  after,
  locale,
}: {
  before: unknown;
  after: unknown;
  locale: Locale;
}) {
  const t = useTranslations("audit");
  const rows = diffFields(before, after);
  const geometry = geometryDiff(before, after);

  if (rows.length === 0 && !geometry) {
    return <p className="text-muted-foreground text-sm">{t("diffEmpty")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {geometry ? (
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">{t("geometryTitle")}</h4>
          <GeometryDiffMount
            before={geometry.before}
            after={geometry.after}
            locale={locale}
          />
        </section>
      ) : null}

      {rows.length > 0 ? (
        /*
          `overflow-x-auto` on the wrapper, never on the page. A stored value
          can be a long uuid list, and a table that widens the document makes
          the whole screen scroll sideways — which under RTL is the failure
          that is hardest to notice and hardest to undo (thread 62).
        */
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{t("diffTitle")}</caption>
            <thead>
              <tr className="text-muted-foreground text-start text-xs">
                <th scope="col" className="py-1 pe-3 text-start font-medium">
                  {t("diffField")}
                </th>
                <th scope="col" className="py-1 pe-3 text-start font-medium">
                  {t("diffBefore")}
                </th>
                <th scope="col" className="py-1 text-start font-medium">
                  {t("diffAfter")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.field} className="border-t align-top">
                  <th
                    scope="row"
                    className="py-1.5 pe-3 text-start font-medium whitespace-nowrap"
                  >
                    {t.has(`fields.${row.field}`)
                      ? t(`fields.${row.field}`)
                      : /* The raw key, in mono so it reads as data. */
                        <span dir="ltr" className="font-mono text-xs">
                          {row.field}
                        </span>}
                  </th>
                  <td className="text-muted-foreground py-1.5 pe-3">
                    <Value text={row.before} absent={t("diffAbsent")} />
                  </td>
                  <td className="py-1.5">
                    <Value text={row.after} absent={t("diffAbsent")} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/**
 * `null` here means **the key was absent on that side** — not that its value
 * was JSON `null`, which `diffValue` renders as the literal string `null`. The
 * two are different facts about an event and the table must not conflate them.
 */
function Value({ text, absent }: { text: string | null; absent: string }) {
  if (text === null) {
    return <span className="text-muted-foreground">{absent}</span>;
  }
  return (
    <span dir="auto" className="break-words whitespace-pre-wrap">
      {text}
    </span>
  );
}
