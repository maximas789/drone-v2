import {
  isAgeBucket,
  matchesAgeBucket,
  matchesSearch,
  type AgeBucket,
} from "@/lib/admin/queue";
import {
  isUrgencyBucket,
  matchesUrgency,
  type UrgencyBucket,
} from "@/lib/admin/urgency";
import type { BookingQueueRow, DroneQueueRow } from "@/lib/data/review";
import { BUILD_TYPES } from "@/lib/validation/drone";

/**
 * Reading the queue's filters out of a URL, and applying them to a page of rows.
 *
 * Pure and server-safe — no `db`, no `react`, no `next-intl` — so the page can
 * call it and a test can too. The filters arrive as `searchParams`, which is to
 * say as **caller-supplied strings**: every one of them is narrowed against a
 * closed list here, and anything unrecognised falls back to "no filter" rather
 * than reaching a query. A `build=<script>` in the URL becomes an empty string
 * before anything renders it.
 */

export type QueueFilters = {
  /** Free text over pilot name, Remote ID and nickname. */
  q: string;
  /** A `BuildType`, or `""` for any. */
  build: string;
  /** A city id, or `""` for any. */
  city: string;
  age: AgeBucket;
};

export const EMPTY_FILTERS: QueueFilters = {
  q: "",
  build: "",
  city: "",
  age: "all",
};

/** `searchParams` hands back a string, an array, or nothing. Take the first. */
function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parseQueueFilters(
  params: Record<string, string | string[] | undefined>,
  cityIds: readonly string[],
): QueueFilters {
  const build = first(params.build);
  const city = first(params.city);
  const age = first(params.age);

  return {
    q: first(params.q).slice(0, 100),
    build: (BUILD_TYPES as readonly string[]).includes(build) ? build : "",
    // Narrowed against the cities that exist, so an id from elsewhere cannot
    // silently produce an empty queue that looks like "nothing is pending".
    city: cityIds.includes(city) ? city : "",
    age: isAgeBucket(age) ? age : "all",
  };
}

/** Whether anything is actually narrowing the list. Drives the reset link. */
export function isFiltered(filters: QueueFilters): boolean {
  return (
    filters.q.trim() !== "" ||
    filters.build !== "" ||
    filters.city !== "" ||
    filters.age !== "all"
  );
}

/**
 * Apply the filters to one page of queue rows.
 *
 * Every clause is an AND: a reviewer who has picked a city and typed a name
 * wants the rows that satisfy both. The search matches the pilot's name in
 * **either** language, the Remote ID, and the aircraft's nickname — see
 * `matchesSearch`.
 */
export function applyQueueFilters(
  rows: readonly DroneQueueRow[],
  filters: QueueFilters,
  now: Date,
): DroneQueueRow[] {
  return rows.filter((row) => {
    if (filters.build && row.buildType !== filters.build) return false;
    if (filters.city && row.pilotCityId !== filters.city) return false;
    if (!matchesAgeBucket(filters.age, row.submittedAt, now)) return false;
    return matchesSearch(filters.q, [
      row.pilotNameAr,
      row.pilotNameEn,
      row.remoteIdCode,
      row.nickname,
    ]);
  });
}

// --- The bookings tab -----------------------------------------------------

/**
 * The booking queue's filters. **A different shape from the drone queue's, on
 * purpose.**
 *
 * A booking is not narrowed by build type or by the pilot's city — it is
 * narrowed by *where* and *when* it is meant to happen. So the two controls are
 * zone and urgency, and the only thing the two queues share is the free-text
 * box. Collapsing them into one `QueueFilters` with four optional fields would
 * make every call site ask which half applied.
 */
export type BookingFilters = {
  /** Free text over pilot name, Remote ID and aircraft nickname. */
  q: string;
  /** A zone id, or `""` for any. */
  zone: string;
  urgency: UrgencyBucket;
};

export const EMPTY_BOOKING_FILTERS: BookingFilters = {
  q: "",
  zone: "",
  urgency: "all",
};

export function parseBookingFilters(
  params: Record<string, string | string[] | undefined>,
  zoneIds: readonly string[],
): BookingFilters {
  const zone = first(params.zone);
  const urgency = first(params.urgency);

  return {
    q: first(params.q).slice(0, 100),
    // Narrowed against the zones that exist, for `parseQueueFilters`' reason:
    // an id from elsewhere would silently empty the queue in a way that reads
    // as "nothing is pending".
    zone: zoneIds.includes(zone) ? zone : "",
    urgency: isUrgencyBucket(urgency) ? urgency : "all",
  };
}

export function isBookingFiltered(filters: BookingFilters): boolean {
  return (
    filters.q.trim() !== "" || filters.zone !== "" || filters.urgency !== "all"
  );
}

export function applyBookingFilters(
  rows: readonly BookingQueueRow[],
  filters: BookingFilters,
  now: Date,
): BookingQueueRow[] {
  return rows.filter((row) => {
    if (filters.zone && row.zoneId !== filters.zone) return false;
    if (!matchesUrgency(filters.urgency, row.slotStart, now)) return false;
    return matchesSearch(filters.q, [
      row.pilotNameAr,
      row.pilotNameEn,
      row.remoteIdCode,
      row.droneNickname,
    ]);
  });
}
