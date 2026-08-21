import { RIYADH_OFFSET_MINUTES } from "@/lib/format";

/**
 * The audit browser's filter state, and the cursor it pages with.
 *
 * **A plain module.** The page resolves the filters from `searchParams` on the
 * server; the filter bar is a client component that has to build the same query
 * string, and the CSV route handler has to parse the identical shape. A
 * `"use client"` module's exports are client *references* and a Server
 * Component calling one throws at request time with every static check green
 * (thread 59), so anything all three touch lives here. Nothing below imports
 * React, `next-intl`, `server-only` or the database.
 *
 * Free of `Intl` too — `AUDIT_DAY` parses a `yyyy-mm-dd` from `<input
 * type="date">` with arithmetic, so rule 6 (no bare `Intl` outside
 * `format.ts`) is not even in play.
 */

/** Every filter the browser offers, already narrowed out of `searchParams`. */
export type AuditFilters = {
  /** A user id, or `"system"` — see `actorIsSystem` below. */
  actor: string | null;
  role: string | null;
  action: string | null;
  entityType: string | null;
  entityId: string | null;
  /** Riyadh civil days, inclusive at both ends. `yyyy-mm-dd` or null. */
  from: string | null;
  to: string | null;
  /**
   * `true` = only the events no person performed, `false` = only the ones a
   * person did, `null` = both. Three states, not a checkbox: "show me what the
   * sweep did overnight" and "show me what staff did" are different questions
   * and a two-state control can only ask one of them.
   */
  actorIsSystem: boolean | null;
  /** Free text over `reason`, case-insensitive. */
  q: string | null;
};

export const EMPTY_FILTERS: AuditFilters = {
  actor: null,
  role: null,
  action: null,
  entityType: null,
  entityId: null,
  from: null,
  to: null,
  actorIsSystem: null,
  q: null,
};

/** The URL keys, in the order the filter bar draws them. */
export const AUDIT_FILTER_KEYS = [
  "actor",
  "role",
  "action",
  "entityType",
  "entityId",
  "from",
  "to",
  "system",
  "q",
] as const;

const AUDIT_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `?x=a&x=b` arrives as an array; an array reaching an `eq()` is a 500. */
function one(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function day(raw: string | string[] | undefined): string | null {
  const value = one(raw);
  return value && AUDIT_DAY.test(value) ? value : null;
}

type RawParams = Record<string, string | string[] | undefined>;

/**
 * `searchParams` → filters. **Unrecognised values become `null`, never a
 * refusal:** a hand-edited URL should show the unfiltered log, not a 500 on the
 * one screen whose job is to still work when something else has gone wrong.
 */
export function parseAuditFilters(params: RawParams): AuditFilters {
  const system = one(params.system);
  return {
    actor: one(params.actor),
    role: one(params.role),
    action: one(params.action),
    entityType: one(params.entityType),
    entityId: one(params.entityId),
    from: day(params.from),
    to: day(params.to),
    actorIsSystem: system === "yes" ? true : system === "no" ? false : null,
    q: one(params.q),
  };
}

/** The same, from a `URLSearchParams` — the CSV route's side of the door. */
export function auditFiltersFromSearch(search: URLSearchParams): AuditFilters {
  const params: RawParams = {};
  for (const key of AUDIT_FILTER_KEYS) {
    const value = search.get(key);
    if (value !== null) params[key] = value;
  }
  return parseAuditFilters(params);
}

/** Filters → a query object, dropping everything unset. Used for links. */
export function auditFilterQuery(
  filters: AuditFilters,
): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.actor) query.actor = filters.actor;
  if (filters.role) query.role = filters.role;
  if (filters.action) query.action = filters.action;
  if (filters.entityType) query.entityType = filters.entityType;
  if (filters.entityId) query.entityId = filters.entityId;
  if (filters.from) query.from = filters.from;
  if (filters.to) query.to = filters.to;
  if (filters.actorIsSystem !== null) {
    query.system = filters.actorIsSystem ? "yes" : "no";
  }
  if (filters.q) query.q = filters.q;
  return query;
}

export function hasAnyAuditFilter(filters: AuditFilters): boolean {
  return Object.keys(auditFilterQuery(filters)).length > 0;
}

/**
 * The **start of a Riyadh civil day**, as an instant.
 *
 * A regulator filtering "from 19 August" means from midnight in Riyadh, not
 * from midnight UTC three hours later — three hours of a working evening on
 * the wrong side of the boundary. Fixed +180: Saudi has never observed DST, so
 * this is arithmetic rather than a timezone database lookup.
 */
export function riyadhDayStart(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(
    Date.UTC(y, (m ?? 1) - 1, d ?? 1) - RIYADH_OFFSET_MINUTES * 60 * 1000,
  );
}

/** The instant the day *after* `day` opens — an exclusive upper bound. */
export function riyadhDayEnd(day: string): Date {
  return new Date(riyadhDayStart(day).getTime() + 86_400_000);
}

/**
 * The pagination cursor: **`(created_at, id)`, not an offset.**
 *
 * Offset pagination drifts as rows are inserted mid-scroll, and this table only
 * ever grows — an admin reading page 3 of the log while a reviewer approves
 * something would see a row twice and miss another. A keyset cursor on the
 * ordering columns is stable under insertion by construction.
 *
 * `id` is the tiebreaker because `created_at` is not unique: the transaction
 * that writes a status change, its audit event and its notification can land
 * two events on the same microsecond.
 */
export type AuditCursor = { createdAt: Date; id: string };

export function encodeAuditCursor(cursor: AuditCursor): string {
  return `${cursor.createdAt.getTime()}.${cursor.id}`;
}

/** Invalid cursors decode to `null` — page one, never an error page. */
export function decodeAuditCursor(
  raw: string | string[] | undefined,
): AuditCursor | null {
  const value = one(raw);
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const ms = Number(value.slice(0, dot));
  const id = value.slice(dot + 1);
  if (!Number.isFinite(ms) || !id) return null;
  return { createdAt: new Date(ms), id };
}
