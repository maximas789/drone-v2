import { getTranslations } from "next-intl/server";
import { DroneStatusBadge } from "@/components/drones/status-badge";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * The pilot's aircraft, compactly.
 *
 * **The Remote ID is on every card**, because it is the thing a pilot is asked
 * for and the thing they will come here to look up. Same reasoning as the
 * booking rows: making somebody open each aircraft in turn to find a code turns
 * a summary into an index.
 *
 * **An expiring registration is flagged here as well as in "action required".**
 * The two are not duplicates: the action list says *do something*, and this
 * says *which aircraft*. A pilot with four drones needs both.
 */

export type DroneSummaryRow = {
  id: string;
  nickname: string;
  status: string;
  remoteIdCode: string | null;
  expiringSoon: boolean;
  expiresAt: Date | null;
};

export async function DroneSummary({
  drones,
  locale,
}: {
  drones: readonly DroneSummaryRow[];
  locale: Locale;
}) {
  const t = await getTranslations("dashboard");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">{t("myDrones")}</h2>
        <Link href="/drones" className="text-sm underline underline-offset-4">
          {t("seeAll")}
        </Link>
      </div>

      {drones.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noDrones")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {drones.map((drone) => (
            <li key={drone.id}>
              <Link
                href={`/drones/${drone.id}`}
                className="hover:border-ring flex flex-col gap-2 rounded-lg border p-4 transition-colors"
              >
                <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <span className="font-medium">{drone.nickname}</span>
                  <DroneStatusBadge status={drone.status} />
                </span>

                {drone.remoteIdCode ? (
                  <span dir="ltr" className="text-muted-foreground text-start font-mono text-xs">
                    {drone.remoteIdCode}
                  </span>
                ) : null}

                {drone.expiringSoon && drone.expiresAt ? (
                  <span className="text-destructive text-xs">
                    {t("expiresOn", { date: formatDate(drone.expiresAt, locale) })}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
