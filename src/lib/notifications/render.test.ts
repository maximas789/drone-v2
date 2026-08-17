import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ar from "@/../messages/ar.json";
import en from "@/../messages/en.json";
import { NOTIFICATION_TYPES, collapseParams, isNotificationType } from "./render";

describe("every type can be said in both languages", () => {
  for (const [locale, catalogue] of Object.entries({
    ar: ar.notifications,
    en: en.notifications,
  })) {
    it(`has a message for every type in ${locale}`, () => {
      const messages = catalogue as unknown as Record<string, unknown>;
      expect(
        NOTIFICATION_TYPES.filter((type) => typeof messages[type] !== "string"),
      ).toEqual([]);
    });
  }

  it("carries no message for a type the app cannot write", () => {
    /**
     * A leftover key reads to the next person as a notification the app still
     * sends. The namespace also holds its own UI chrome, which is listed here
     * so that adding a *type* without adding it to `NOTIFICATION_TYPES` fails
     * rather than quietly passing as chrome.
     */
    const chrome = new Set([
      "title",
      "empty",
      "emptyUnread",
      "markAllRead",
      "filterUnread",
      "unreadCount",
      "preferencesTitle",
      "inApp",
      "byEmail",
      "alwaysOnNotice",
      "category",
    ]);
    const known = new Set<string>(NOTIFICATION_TYPES);
    const strays = Object.keys(ar.notifications).filter(
      (key) => !known.has(key) && !chrome.has(key),
    );
    expect(strays).toEqual([]);
  });

  /**
   * The half a catalogue check cannot see: a writer that passes a `type` string
   * nobody ever added. It renders as the raw key `notifications.whatever` to
   * the one person it was written for, and no check in this repo would notice —
   * so this reads the source and asserts every literal handed to `notify()` is
   * a type this module knows about.
   */
  it("knows every type the source actually writes", () => {
    const written = new Set<string>();
    for (const file of sourceFiles("src")) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/^\s*type:\s*"([A-Za-z]+)",/gm)) {
        /**
         * `type:` is a common property name — a GeoJSON `Polygon`, an image's
         * `png`. A notification input always carries a `userId` beside it, so
         * the neighbourhood is what distinguishes one from the other.
         */
        const from = Math.max(0, (match.index ?? 0) - 300);
        const neighbourhood = source.slice(from, (match.index ?? 0) + 300);
        if (neighbourhood.includes("userId:")) written.add(match[1]);
      }
    }

    const unknown = [...written].filter((type) => !isNotificationType(type));
    expect(unknown).toEqual([]);
    // And the list is not merely a superset of nothing.
    expect(written.size).toBeGreaterThan(0);
  });

  /**
   * `href` is stored locale-less; `Link` prefixes the reader's own locale at
   * render time. A writer that stored `/ar/drones/abc` would send an English
   * reader into Arabic from a list that is otherwise entirely in their
   * language — and nothing else in the repo would notice.
   */
  it("stores no locale prefix in any notification href", () => {
    const stored: string[] = [];
    for (const file of sourceFiles("src")) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/^\s*href:\s*[`"]([^`"$]*)/gm)) {
        const from = Math.max(0, (match.index ?? 0) - 300);
        if (!source.slice(from, (match.index ?? 0) + 300).includes("userId:")) {
          continue;
        }
        stored.push(match[1]);
      }
    }

    expect(stored.length).toBeGreaterThan(0);
    expect(stored.filter((href) => /^\/(ar|en)/.test(href))).toEqual([]);
  });
});

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      found.push(path);
    }
  }
  return found;
}

describe("collapseParams", () => {
  it("picks the Arabic half for an Arabic reader and the English for English", () => {
    const params = { zoneAr: "وادي نمار", zoneEn: "Wadi Namar" };
    expect(collapseParams(params, "ar")).toEqual({ zone: "وادي نمار" });
    expect(collapseParams(params, "en")).toEqual({ zone: "Wadi Namar" });
  });

  it("renders a zone name in both locales with no database join", () => {
    /**
     * The whole reason `notify()` demands both variants: the row carries what
     * it needs, so a notification written a year ago still reads correctly
     * after the reader switches language — and after the zone is renamed, it
     * still says what it said at the time.
     */
    const row = {
      zoneAr: "الثمامة",
      zoneEn: "Thumamah",
      reasonAr: "فعالية",
      reasonEn: "Event",
    };
    expect(collapseParams(row, "ar")).toEqual({
      zone: "الثمامة",
      reason: "فعالية",
    });
    expect(collapseParams(row, "en")).toEqual({
      zone: "Thumamah",
      reason: "Event",
    });
  });

  it("leaves a single-language param alone", () => {
    expect(collapseParams({ drone: "Falcon", days: "30" }, "ar")).toEqual({
      drone: "Falcon",
      days: "30",
    });
  });

  it("does not collapse a lone half", () => {
    // Only a matched pair is a bilingual value. A stray `somethingEn` is just a
    // param whose name happens to end that way.
    expect(collapseParams({ zoneEn: "Thumamah" }, "ar")).toEqual({
      zoneEn: "Thumamah",
    });
  });

  it("survives a null or missing params blob", () => {
    expect(collapseParams(null, "ar")).toEqual({});
    expect(collapseParams(undefined, "en")).toEqual({});
    expect(collapseParams({ drone: null }, "ar")).toEqual({ drone: "" });
  });

  it("keeps numbers as the strings they were stored as", () => {
    /**
     * Open thread 22: ICU formats a **bare numeric** argument itself, and under
     * `ar` that means Arabic-Indic digits — `٣٠` in a sentence whose whole
     * point is a date a pilot has to act on. `notify()` types `params` as
     * strings for this reason, and this keeps them that way.
     */
    const collapsed = collapseParams({ days: 30 }, "ar");
    expect(collapsed.days).toBe("30");
    expect(typeof collapsed.days).toBe("string");
  });
});
