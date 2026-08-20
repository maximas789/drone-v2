import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { ClosureForm } from "@/components/admin/zone/closure-form";
import {
  ClosureList,
  type ClosureRow,
} from "@/components/admin/zone/closure-list";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import {
  getZoneForAdmin,
  listBookingsInClosureWindow,
  listZoneClosures,
} from "@/lib/data/zone-admin";
import { toLocale } from "@/lib/locale";
import { overlappingClosures } from "@/lib/validation/zone-closure";

/**
 * `/admin/zones/[id]/closures` — **the NOTAM analogue.**
 *
 * A closure is a window over a zone that already exists. While it stands the
 * engine refuses every flight inside it, and publishing one cancels every
 * booking the window covers — which is why it is written in two acts: draft it,
 * look at whose flights it takes, then publish.
 *
 * **The cancellation preview is computed here, on the server**, for every
 * unpublished closure, by the same half-open predicate `listBookingsOverlapping`
 * uses inside the fan-out. Asking the client to work out who is affected would
 * put a guess in front of the person deciding; asking the server on a button
 * press would show a list that could be stale by the time it is confirmed. This
 * list is the row's own, re-read on every render of the page.
 *
 * `requireAdmin`, like every other zone route: drawing and closing airspace is
 * not reviewing a submission, and a reviewer gets the same 404 a pilot does.
 */
export default async function ZoneClosuresPage({
  params,
}: PageProps<"/[locale]/admin/zones/[id]/closures">) {
  const locale = toLocale(await localeParam());
  const session = await requireAdmin();
  const t = await getTranslations("zoneAdmin");

  const { id } = await params;
  const zone = await getZoneForAdmin(session, id);
  if (!zone) notFound();

  const closures = await listZoneClosures(session, id);

  /**
   * One query per unpublished closure. There are rarely more than a handful,
   * and the alternative — one window query covering all of them, split in
   * memory — would be a second implementation of the overlap rule to keep in
   * step with the fan-out's.
   */
  const rows: ClosureRow[] = await Promise.all(
    closures.map(async (row) => {
      const impact = row.publishedAt
        ? []
        : await listBookingsInClosureWindow(
            session,
            id,
            row.startsAt,
            row.endsAt,
          );
      return {
        id: row.id,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        reasonAr: row.reasonAr,
        reasonEn: row.reasonEn,
        authorityRef: row.authorityRef,
        publishedAt: row.publishedAt?.toISOString() ?? null,
        impact: impact.map((booking) => ({
          bookingId: booking.bookingId,
          pilotName: booking.pilotName,
          droneNickname: booking.droneNickname,
          slotStart: booking.slotStart.toISOString(),
          slotEnd: booking.slotEnd.toISOString(),
          status: booking.status,
        })),
        overlaps: overlappingClosures(
          row,
          closures.filter((other) => other.id !== row.id),
        ).map((other) => other.id),
      };
    }),
  );

  /**
   * A closure can only be declared over airspace somebody could fly in.
   * Closing a draft closes something no pilot can see; closing an archived zone
   * closes something that no longer exists. Both would write a row that can
   * never refuse anything — so the form is not drawn, and
   * `createZoneClosure` refuses independently.
   */
  const closeable = zone.status === "active" || zone.status === "suspended";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <Link
          href={`/admin/zones/${zone.id}`}
          className="text-muted-foreground text-sm underline"
        >
          {t("backToZone")}
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("closuresTitle")}</h1>
          <p className="text-muted-foreground text-sm">
            {locale === "ar" ? zone.nameAr : zone.nameEn}
          </p>
          <p dir="ltr" className="text-muted-foreground font-mono text-sm">
            {zone.code}
          </p>
        </div>
        <Badge variant={zone.status === "active" ? "default" : "secondary"}>
          {t(`statuses.${zone.status}`)}
        </Badge>
      </header>

      <ClosureList
        closures={rows}
        locale={locale}
        now={new Date().toISOString()}
      />

      {closeable ? (
        <ClosureForm zoneId={zone.id} locale={locale} />
      ) : (
        <p className="text-muted-foreground rounded-lg border p-4 text-sm">
          {t("closureZoneNotCloseable")}
        </p>
      )}
    </main>
  );
}
