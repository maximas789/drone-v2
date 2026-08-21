import { describe, expect, it } from "vitest";
import {
  auditFilterQuery,
  auditFiltersFromSearch,
  decodeAuditCursor,
  encodeAuditCursor,
  EMPTY_FILTERS,
  hasAnyAuditFilter,
  parseAuditFilters,
  riyadhDayEnd,
  riyadhDayStart,
} from "./audit-filters";

describe("parseAuditFilters", () => {
  it("reads every filter the browser offers", () => {
    expect(
      parseAuditFilters({
        actor: "user_1",
        role: "reviewer",
        action: "drone.approved",
        entityType: "drone",
        entityId: "abc",
        from: "2026-08-01",
        to: "2026-08-19",
        system: "no",
        q: "expired",
      }),
    ).toEqual({
      actor: "user_1",
      role: "reviewer",
      action: "drone.approved",
      entityType: "drone",
      entityId: "abc",
      from: "2026-08-01",
      to: "2026-08-19",
      actorIsSystem: false,
      q: "expired",
    });
  });

  /** `?actor=a&actor=b` arrives as an array; an array reaching an `eq()` is a 500. */
  it("takes the first value when a key repeats", () => {
    expect(parseAuditFilters({ actor: ["a", "b"] }).actor).toBe("a");
  });

  it("treats blank and whitespace-only values as no filter", () => {
    expect(parseAuditFilters({ actor: "   ", q: "" })).toEqual(EMPTY_FILTERS);
  });

  /**
   * A hand-edited URL must show the unfiltered log, never a 500 on the one
   * screen whose job is to still work when something else has gone wrong.
   */
  it("drops a malformed date rather than refusing", () => {
    const filters = parseAuditFilters({ from: "yesterday", to: "2026-8-1" });
    expect(filters.from).toBeNull();
    expect(filters.to).toBeNull();
  });

  it("reads the three states of the system filter", () => {
    expect(parseAuditFilters({ system: "yes" }).actorIsSystem).toBe(true);
    expect(parseAuditFilters({ system: "no" }).actorIsSystem).toBe(false);
    expect(parseAuditFilters({ system: "maybe" }).actorIsSystem).toBeNull();
    expect(parseAuditFilters({}).actorIsSystem).toBeNull();
  });
});

describe("auditFilterQuery", () => {
  it("round-trips through a query string", () => {
    const filters = parseAuditFilters({
      actor: "user_1",
      system: "yes",
      q: "لم يحضر",
    });
    const search = new URLSearchParams(auditFilterQuery(filters));
    expect(auditFiltersFromSearch(search)).toEqual(filters);
  });

  it("omits everything unset", () => {
    expect(auditFilterQuery(EMPTY_FILTERS)).toEqual({});
    expect(hasAnyAuditFilter(EMPTY_FILTERS)).toBe(false);
  });

  /** `system=no` is a filter, and `false` must not be dropped as falsy. */
  it("keeps a false system filter", () => {
    const filters = parseAuditFilters({ system: "no" });
    expect(auditFilterQuery(filters)).toEqual({ system: "no" });
    expect(hasAnyAuditFilter(filters)).toBe(true);
  });
});

describe("Riyadh day boundaries", () => {
  /**
   * Fixed +180. Filtering "from 19 August" means from midnight **in Riyadh**,
   * not midnight UTC three hours later — three hours of a working evening on
   * the wrong side of the boundary.
   */
  it("opens a day at 21:00 UTC the evening before", () => {
    expect(riyadhDayStart("2026-08-19").toISOString()).toBe(
      "2026-08-18T21:00:00.000Z",
    );
  });

  it("closes a day at the instant the next one opens", () => {
    expect(riyadhDayEnd("2026-08-19").toISOString()).toBe(
      "2026-08-19T21:00:00.000Z",
    );
  });
});

describe("the pagination cursor", () => {
  it("round-trips a timestamp and an id", () => {
    const cursor = { createdAt: new Date("2026-08-19T12:00:00Z"), id: "abc-1" };
    const decoded = decodeAuditCursor(encodeAuditCursor(cursor));
    expect(decoded?.id).toBe("abc-1");
    expect(decoded?.createdAt.toISOString()).toBe(cursor.createdAt.toISOString());
  });

  /** An id containing a dot must not be truncated at the first one. */
  it("splits on the first dot only", () => {
    const cursor = { createdAt: new Date(0), id: "a.b.c" };
    expect(decodeAuditCursor(encodeAuditCursor(cursor))?.id).toBe("a.b.c");
  });

  it("decodes rubbish to null rather than throwing", () => {
    expect(decodeAuditCursor("nonsense")).toBeNull();
    expect(decodeAuditCursor(".abc")).toBeNull();
    expect(decodeAuditCursor("123.")).toBeNull();
    expect(decodeAuditCursor(undefined)).toBeNull();
  });
});
