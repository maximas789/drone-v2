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
 * **Four routes, not one page with a `?tab=`.** Each queue has its own filters,
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
  active: "drones" | "bookings" | "pilots" | "lookup" | "zones" | "analytics";
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
        {/*
          **No count on the lookup tab either, and for a different reason.**
          There is nothing to count: it is not a queue and not a directory, it
          is a box you type into. A badge beside it would be inventing a number
          to keep the strip symmetrical.
        */}
        <Tab href="/admin/lookup" current={active === "lookup"}>
          {t("tabLookup")}
        </Tab>
        {/*
          **Zones is admin-only, and the tab is drawn for everybody.** A
          reviewer following it gets the same 404 a pilot does, from
          `requireAdmin` on the page and independently from every zone action.
          Hiding it instead would mean this strip needed the session, and a
          navigation control that changes shape by role is one more thing to get
          wrong than a route that refuses.
        */}
        <Tab href="/admin/zones" current={active === "zones"}>
          {t("tabZones")}
        </Tab>
        {/*
          **Analytics is reviewer-level, unlike the zones tab beside it**, and
          it carries no count for the reason the lookup tab carries none: it is
          not a queue. The number a reviewer would want from it — what is
          waiting — is already on the two tabs at the start of this strip, and
          repeating it here as a badge would imply the analytics screen was
          somewhere work accumulates.
        */}
        <Tab href="/admin/analytics" current={active === "analytics"}>
          {t("tabAnalytics")}
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
