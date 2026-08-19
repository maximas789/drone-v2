import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";

/**
 * The two review queues, as a tab strip.
 *
 * **It arrives with the bookings tab, not before it.** F22a rendered the drone
 * queue with no strip around it deliberately: a two-tab control whose second
 * tab links to a route that does not exist is worse than one tab. The strip is
 * therefore part of F22b, and every tab on it goes somewhere from the moment it
 * is drawn.
 *
 * **Three routes, not one page with a `?tab=`.** Each queue has its own filters,
 * its own ordering and its own detail route; sharing a URL would mean one
 * page's `searchParams` carrying the other's controls, and a reviewer who
 * bookmarks "the bookings I have to decide" would get the drones.
 *
 * **Real links, not buttons.** A tab that navigates is a navigation, so it must
 * be middle-clickable, openable in a new tab, and reachable by a screen reader
 * as a link inside a `nav`. `aria-current="page"` — not `aria-selected`, which
 * belongs to the ARIA tab pattern this deliberately is not.
 *
 * The counts are **pre-formatted strings**, not numbers: a bare numeric ICU
 * argument is formatted by next-intl under the page locale and renders `٣`
 * under `ar` (thread 22). They are also the *unfiltered* totals — a reviewer
 * who has narrowed one queue still needs to know what is waiting in the other.
 */
export function QueueTabs({
  active,
  droneCount,
  bookingCount,
}: {
  active: "drones" | "bookings" | "pilots";
  droneCount: string;
  bookingCount: string;
}) {
  const t = useTranslations("review");

  return (
    <nav aria-label={t("tabsLabel")} className="border-b">
      <ul className="-mb-px flex flex-wrap gap-1">
        <Tab href="/admin" current={active === "drones"} count={droneCount}>
          {t("tabDrones")}
        </Tab>
        <Tab
          href="/admin/bookings"
          current={active === "bookings"}
          count={bookingCount}
        >
          {t("tabBookings")}
        </Tab>
        {/*
          **No count on the pilots tab, deliberately.** The other two are
          queues, and their number is the work waiting; this one is a
          directory, and a badge reading "1" beside it would look like one
          pilot needs attention rather than that one pilot exists.
        */}
        <Tab href="/admin/pilots" current={active === "pilots"}>
          {t("tabPilots")}
        </Tab>
      </ul>
    </nav>
  );
}

function Tab({
  href,
  current,
  count,
  children,
}: {
  href: string;
  current: boolean;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        /*
          `border-b-2` on both states, transparent when inactive, so the label
          does not shift by two pixels as a reviewer moves between the tabs.
        */
        className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm ${
          current
            ? "border-foreground font-medium"
            : "text-muted-foreground hover:text-foreground border-transparent"
        }`}
      >
        {children}
        {count === undefined ? null : (
          <Badge variant={current ? "default" : "secondary"}>{count}</Badge>
        )}
      </Link>
    </li>
  );
}
