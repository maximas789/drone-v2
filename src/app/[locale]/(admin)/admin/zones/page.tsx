import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { QueueTabs } from "@/components/admin/queue-tabs";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { ProposalNotice } from "@/components/proposal-notice";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { countPendingReviews } from "@/lib/data/review";
import { listZonesForAdmin } from "@/lib/data/zone-admin";
import { formatDate, formatNumber } from "@/lib/format";
import { toLocale } from "@/lib/locale";

/**
 * `/admin/zones` — the airspace itself, drafts included.
 *
 * **`requireAdmin`, not `requireReviewer`.** Every other admin surface in this
 * build is a reviewer's: a queue of things pilots submitted. This one is where
 * somebody decides where anybody may fly at all, and a reviewer gets the same
 * 404 a pilot does — from the guard here, and independently from every zone
 * action.
 *
 * **Drafts first.** The list is a working surface, not a catalogue: a zone
 * somebody drew half of yesterday is the row they came back for. The order is
 * in `listZonesForAdmin`, by the status enum's own declaration order.
 *
 * The **future-booking count** is on every row because it is what decides
 * whether a zone can be suspended or archived at all — F23b's business, and
 * knowing the number before opening anything is the point of showing it here.
 */
export default async function AdminZonesPage() {
  const locale = toLocale(await localeParam());
  const session = await requireAdmin();
  const tZones = await getTranslations("zoneAdmin");
  const tReview = await getTranslations("review");

  const [zones, counts] = await Promise.all([
    listZonesForAdmin(session),
    countPendingReviews(session),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{tZones("title")}</h1>
          <p className="text-muted-foreground text-sm">{tZones("intro")}</p>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <SignOutButton />
        </div>
      </header>

      <ProposalNotice />

      <QueueTabs
        active="zones"
        droneCount={formatNumber(counts.drones, locale)}
        bookingCount={formatNumber(counts.bookings, locale)}
      />

      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink href="/admin/zones/new">{tZones("newZone")}</ButtonLink>
        {/* A zone belongs to a city, so the list of cities is one click away. */}
        <Link href="/admin/cities" className="text-sm underline">
          {tZones("citiesLink")}
        </Link>
        <p className="text-muted-foreground text-sm">{tZones("newZoneHint")}</p>
      </div>

      {zones.length === 0 ? (
        <p className="text-muted-foreground text-sm">{tZones("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <caption className="sr-only">{tZones("title")}</caption>
            <thead className="bg-muted/50">
              <tr className="text-start">
                <Th>{tZones("colZone")}</Th>
                <Th>{tZones("colKind")}</Th>
                <Th>{tZones("colStatus")}</Th>
                <Th>{tZones("colGeometry")}</Th>
                <Th>{tZones("colBookings")}</Th>
                <Th>
                  <span className="sr-only">{tReview("review")}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {zones.map((row) => (
                <tr key={row.id} className="border-t align-top">
                  <Td>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">
                        {locale === "ar" ? row.nameAr : row.nameEn}
                      </span>
                      <span dir="ltr" className="text-muted-foreground font-mono text-xs">
                        {row.code}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {(locale === "ar" ? row.cityNameAr : row.cityNameEn) ??
                          "—"}
                      </span>
                    </div>
                  </Td>
                  <Td>{tZones(`kinds.${row.kind}`)}</Td>
                  <Td>
                    <Badge
                      variant={row.status === "active" ? "default" : "secondary"}
                    >
                      {tZones(`statuses.${row.status}`)}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-1 text-xs">
                      <span>
                        {tZones("vertices", {
                          count: formatNumber(row.vertexCount, locale),
                        })}
                      </span>
                      <span className="text-muted-foreground">
                        {tZones("version", {
                          version: formatNumber(row.geometryVersion, locale),
                        })}
                      </span>
                      <span className="text-muted-foreground">
                        {formatDate(row.updatedAt, locale)}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    {row.futureBookings > 0 ? (
                      <Badge variant="outline">
                        {formatNumber(row.futureBookings, locale)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/zones/${row.id}`}
                      className="text-sm underline"
                    >
                      {tZones("open")}
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ButtonLink variant="outline" href="/admin">
        {tReview("queueTitle")}
      </ButtonLink>
    </main>
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
