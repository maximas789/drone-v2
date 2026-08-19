import { useTranslations } from "next-intl";
import { AgeBadge } from "@/components/admin/age-badge";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { DroneQueueRow } from "@/lib/data/review";
import { formatDate, formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { serialRequiredFor, type BuildType } from "@/lib/validation/drone";

/**
 * The pending-registration queue.
 *
 * **A real `<table>`.** Every row here is the same eight facts about a
 * different submission, which is what a table is for; a grid of cards would
 * make a reviewer re-find the age column on every row. It is wrapped in an
 * `overflow-x-auto` container so the page body never scrolls sideways at a
 * narrow width — the table scrolls inside its own box instead.
 *
 * **"No serial number" is a badge, not an empty cell.** This is the product's
 * whole premise showing up in the reviewer's list: an empty cell reads as
 * missing data and invites a reviewer to reject for incompleteness, when in
 * fact the aircraft has no manufacturer serial to give and the Remote ID is
 * what identifies it. `serialRequiredFor` is the same predicate the wizard and
 * the spec table use, so the three cannot drift.
 *
 * At 375 px the wrapper measures 328 px and the 46 rem table scrolls inside it:
 * `document.body.scrollWidth` equals `clientWidth` and `scrollTo(9999, 0)`
 * leaves `scrollX` at 0. Note that `document.documentElement.scrollWidth`
 * reports **696** here and is simply wrong under RTL with a clipped overflowing
 * descendant — the reliable signals are `body.scrollWidth` and whether the page
 * will actually scroll.
 *
 * `now` is a prop for `AgeBadge`'s reason: one instant per page, read where the
 * query happens rather than in a render.
 */
export function QueueTable({
  rows,
  now,
  locale,
}: {
  rows: readonly DroneQueueRow[];
  now: Date;
  locale: Locale;
}) {
  const t = useTranslations("review");
  const tDrones = useTranslations("drones");

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <caption className="sr-only">{t("queueDronesCaption")}</caption>
        <thead className="bg-muted/50">
          <tr className="text-start">
            <Th>{t("colAircraft")}</Th>
            <Th>{t("colPilot")}</Th>
            <Th>{t("colSubmitted")}</Th>
            <Th>{t("colIdentification")}</Th>
            <Th>{t("colPhotos")}</Th>
            <Th>
              <span className="sr-only">{t("colOpen")}</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const needsSerial = serialRequiredFor(row.buildType as BuildType);
            return (
              <tr key={row.id} className="border-t align-top">
                <Td>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{row.nickname}</span>
                    <span className="text-muted-foreground text-xs">
                      {tDrones(`buildTypes.${row.buildType}`)}
                    </span>
                    {row.rejectionCount > 0 ? (
                      <span className="text-muted-foreground text-xs">
                        {t("priorRejections", {
                          count: formatNumber(row.rejectionCount, locale),
                        })}
                      </span>
                    ) : null}
                  </div>
                </Td>

                <Td>
                  <div className="flex flex-col gap-1">
                    <span>
                      {(locale === "ar" ? row.pilotNameAr : row.pilotNameEn) ??
                        t("pilotUnnamed")}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {(locale === "ar"
                        ? row.pilotCityNameAr
                        : row.pilotCityNameEn) ?? t("cityUnknown")}
                    </span>
                  </div>
                </Td>

                <Td>
                  <div className="flex flex-col items-start gap-1.5">
                    <span>
                      {row.submittedAt
                        ? formatDate(row.submittedAt, locale)
                        : "—"}
                    </span>
                    <AgeBadge
                      submittedAt={row.submittedAt}
                      now={now}
                      locale={locale}
                    />
                  </div>
                </Td>

                <Td>
                  {needsSerial && row.serialNumber ? (
                    <span dir="ltr" className="font-mono text-xs">
                      {row.serialNumber}
                    </span>
                  ) : (
                    /*
                     * The badge, not a dash. See the note at the top: an empty
                     * cell here is the one place the product's premise would
                     * read as missing paperwork.
                     */
                    <Badge variant="outline" className="whitespace-normal">
                      {t("noSerialBadge")}
                    </Badge>
                  )}
                  {row.remoteIdCode ? (
                    <div dir="ltr" className="mt-1.5 font-mono text-xs">
                      {row.remoteIdCode}
                    </div>
                  ) : null}
                </Td>

                <Td>{formatNumber(row.photoCount, locale)}</Td>

                <Td>
                  <Link
                    href={`/admin/drones/${row.id}`}
                    className="text-sm underline"
                  >
                    {t("review")}
                  </Link>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="text-muted-foreground p-3 text-start font-medium">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="p-3 text-start">{children}</td>;
}
