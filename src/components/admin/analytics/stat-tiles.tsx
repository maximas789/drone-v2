import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { countLabel } from "@/lib/analytics/labels";
import { TURNAROUND_WINDOW_DAYS, type Tiles } from "@/lib/analytics/queries";
import { formatDays, formatHours } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * The six header tiles — **current state, not vanity metrics.**
 *
 * F25 is explicit about which six, and the choice is the point: what is
 * waiting, how long deciding takes, what is valid, what is about to stop being
 * valid, and what is flying today. There is no "total registrations ever" here,
 * because nobody has ever done anything differently on account of one.
 *
 * **They do not follow the date range**, and the sentence under the range
 * control says so. Five of them are a *now*, which has no range; the sixth is
 * pinned to 30 days by F25. A reader who switches to 7 days and watches the
 * tiles hold still should be able to find out why without guessing.
 *
 * **Three of them are links.** A tile reading "4 pending registrations" whose
 * only affordance is to be read is a tile that makes a reviewer go and find the
 * queue themselves. The three that name a queue link to it; the three that name
 * a fact do not, because there is no honest destination for "median turnaround".
 *
 * No sparkline, no delta arrow, no colour. A tile that turns red is asserting a
 * threshold, and nothing in this build defines one.
 */
export async function StatTiles({
  tiles,
  locale,
}: {
  tiles: Tiles;
  locale: Locale;
}) {
  const t = await getTranslations("analytics");

  /**
   * Hours below a day, days above — and both through `format.ts`, which carries
   * the unit itself. An ICU `{n} hours` would print `٤ hours` under `ar`
   * (thread 22) and would need Arabic's six plural categories written out by
   * hand (thread 23); CLDR already knows them.
   */
  const turnaround =
    tiles.medianTurnaroundHours === null
      ? "—"
      : tiles.medianTurnaroundHours < 48
        ? formatHours(Math.round(tiles.medianTurnaroundHours), locale)
        : formatDays(Math.round(tiles.medianTurnaroundHours / 24), locale);

  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <Tile
        label={t("tilePendingDrones")}
        value={countLabel(tiles.pendingDrones, locale)}
        href="/admin"
      />
      <Tile
        label={t("tilePendingBookings")}
        value={countLabel(tiles.pendingBookings, locale)}
        href="/admin/bookings"
      />
      <Tile
        label={t("tileTurnaround")}
        value={turnaround}
        /*
          The sample size is not decoration. A median of "3 days" over two
          decisions and over two hundred are different claims, and only one of
          them is worth quoting — so the tile always says which it is, including
          when the answer is that nothing was decided at all.
        */
        hint={
          tiles.turnaroundSampleSize === 0
            ? t("tileTurnaroundNone", { days: formatDays(TURNAROUND_WINDOW_DAYS, locale) })
            : t("tileTurnaroundHint", {
                count: countLabel(tiles.turnaroundSampleSize, locale),
                days: formatDays(TURNAROUND_WINDOW_DAYS, locale),
              })
        }
      />
      <Tile
        label={t("tileActive")}
        value={countLabel(tiles.activeRegistrations, locale)}
      />
      <Tile
        label={t("tileExpiring")}
        value={countLabel(tiles.expiringWithin30Days, locale)}
        hint={t("tileExpiringHint")}
      />
      <Tile
        label={t("tileAuthorisedToday")}
        value={countLabel(tiles.authorisedToday, locale)}
        href="/admin/bookings"
      />
    </ul>
  );
}

function Tile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="text-muted-foreground text-sm">{label}</span>
      {/*
        `tabular-nums` so a column of tiles does not shuffle sideways as the
        digits change, and `<bdi>` because the value can be a formatted Arabic
        duration — `٣ أيام` is fine, but `3 days` inside an Arabic paragraph
        needs isolating or the neutral digits reorder around it.
      */}
      <span className="text-2xl font-semibold tabular-nums">
        <bdi>{value}</bdi>
      </span>
      {hint === undefined ? null : (
        <span className="text-muted-foreground text-xs">
          <bdi>{hint}</bdi>
        </span>
      )}
    </>
  );

  return (
    <li>
      {href === undefined ? (
        <div className="bg-card flex h-full flex-col gap-1 rounded-lg border p-4">
          {body}
        </div>
      ) : (
        <Link
          href={href}
          className="bg-card hover:border-foreground/30 focus-visible:ring-ring flex h-full flex-col gap-1 rounded-lg border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {body}
        </Link>
      )}
    </li>
  );
}
