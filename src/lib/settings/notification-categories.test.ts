import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALWAYS_SENT_CATEGORIES,
  SWITCHABLE_CATEGORIES,
} from "./notification-categories";
import { notificationCategory } from "@/lib/db/enums";
import { LOCALES } from "@/lib/locale";

/**
 * **A switch that changes nothing is worse than no switch**, and this is the
 * only thing that can catch one.
 *
 * `SWITCHABLE_CATEGORIES` is a hand-kept list, and a hand-kept list drifts. The
 * two directions it can drift in are both failures with no other symptom:
 *
 * - A category is offered here that nothing passes to `notify()` — an inert
 *   control, which a person can switch off and believe they have acted.
 * - Something starts passing a category that is *not* offered — a notification
 *   the pilot is silently unable to turn off, with a preference column sitting
 *   in the database that nothing reads.
 *
 * So the list is compared against the source that actually sends them.
 */

/**
 * Walks `src/lib` the same way `render.test.ts` does — `readdirSync` and
 * recursion rather than a glob, because `node:fs`'s `globSync` is not in this
 * TypeScript's `@types/node` and pulling in a glob dependency for one test
 * would be a dependency for one test.
 */
function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
    } else if (/\.ts$/.test(entry) && !/\.test\.ts$/.test(entry)) {
      found.push(path);
    }
  }
  return found;
}

/** Every `category: "…"` literal handed to `notify()` across the codebase. */
function categoriesSentInSource(): Set<string> {
  // Forward slashes, so the exclusions below read the same on Windows.
  const files = sourceFiles("src/lib")
    .map((file: string) => file.replaceAll("\\", "/"))
    .filter(
      (file: string) =>
        // The modules that *define* categories, rather than send them.
        !file.endsWith("db/enums.ts") &&
        !file.endsWith("db/schema.ts") &&
        !file.endsWith("notify.ts") &&
        !file.endsWith("data/notification.ts") &&
        !file.endsWith("actions/notification.ts") &&
        !file.endsWith("settings/notification-categories.ts"),
    );

  const found = new Set<string>();
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\bcategory:\s*"([a-z_]+)"/g)) {
      found.add(match[1]);
    }
  }
  return found;
}

describe("which notification categories are switchable", () => {
  it("offers exactly the categories something actually sends", () => {
    expect([...categoriesSentInSource()].sort()).toEqual(
      [...SWITCHABLE_CATEGORIES].sort(),
    );
  });

  it("accounts for every value of the enum, once", () => {
    expect(
      [...SWITCHABLE_CATEGORIES, ...ALWAYS_SENT_CATEGORIES].sort(),
    ).toEqual([...notificationCategory.enumValues].sort());
  });

  /**
   * The specific one this list exists for. F23c's fan-out passes no category
   * on purpose — *"a pilot who muted it would turn up to a closed zone"* — so
   * a `zone_closure` switch would be inert. If somebody later gives the fan-out
   * a category, the first test above fails and this comment is where they land.
   */
  it("does not offer a switch for zone closures", () => {
    expect(SWITCHABLE_CATEGORIES as readonly string[]).not.toContain(
      "zone_closure",
    );
    expect(ALWAYS_SENT_CATEGORIES).toContain("zone_closure");
    expect(
      readFileSync("src/lib/inngest/functions/closure-fanout.ts", "utf8"),
    ).not.toMatch(/\bcategory:\s*"zone_closure"/);
  });

  it("has a title and a body for every switchable category, in both locales", () => {
    for (const locale of LOCALES) {
      const messages = JSON.parse(
        readFileSync(`messages/${locale}.json`, "utf8"),
      ) as {
        settings: {
          notifications: {
            category: Record<string, { title?: string; body?: string }>;
          };
        };
      };
      for (const category of SWITCHABLE_CATEGORIES) {
        const entry = messages.settings.notifications.category[category];
        expect(entry?.title, `${locale} ${category}.title`).toBeTruthy();
        expect(entry?.body, `${locale} ${category}.body`).toBeTruthy();
      }
    }
  });
});
