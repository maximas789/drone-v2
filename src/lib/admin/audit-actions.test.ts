import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ar from "@/../messages/ar.json";
import en from "@/../messages/en.json";
import {
  BOOKING_TRAIL_ACTIONS,
  DRONE_TRAIL_ACTIONS,
  hasTrailLabel,
  trailLabelKey,
} from "./audit-actions";

/**
 * **Every action the trail can show must be sayable in both languages.**
 *
 * Same shape and same reason as `status-labels.test.ts`: `i18n:check` compares
 * the catalogues to each other, so a key missing from *both* is missing
 * consistently and passes. That hole shipped `nav.dashboard` in F16a and
 * `bookings.statusPending` in F21b, each found by opening a page.
 *
 * The third test is the one that would have caught F22's own version of the
 * bug: it reads the **source** and asserts that every `action:` string written
 * against a drone or a Remote ID appears in `DRONE_TRAIL_ACTIONS`. A future
 * session adding `remote_id.transferred` and no label fails here rather than
 * printing a dotted code onto a regulator's approval trail.
 */

const catalogues = { ar, en };

/** The namespaces the trails are audited under — drone's three, and booking's one. */
const TRAIL_PREFIXES = ["drone.", "remote_id.", "declaration.", "booking."];

/** Written against `pilot_profile`, `user` or a zone — no trail renders these. */
const NOT_ON_THIS_TRAIL = /^(pilot_profile|user|zone|city|zone_closure)\./;

/** Every action either trail can show. `hasTrailLabel` answers for both. */
const ALL_TRAIL_ACTIONS = [...DRONE_TRAIL_ACTIONS, ...BOOKING_TRAIL_ACTIONS];

function labelsFor(messages: typeof ar): Record<string, unknown> {
  const review = messages.review as Record<string, unknown>;
  return (review.auditActions ?? {}) as Record<string, unknown>;
}

describe("audit action labels", () => {
  for (const [locale, messages] of Object.entries(catalogues)) {
    it(`has a label for every trail action in ${locale}`, () => {
      const labels = labelsFor(messages);
      expect(
        ALL_TRAIL_ACTIONS.filter((action) => !labels[trailLabelKey(action)]),
      ).toEqual([]);
    });

    /**
     * **The one that actually broke.** `next-intl` reads a `.` in a key path as
     * a *namespace separator*, so a flat catalogue key `"drone.approved"` is
     * unreachable from `t("auditActions.drone.approved")` — it renders the whole
     * path as literal text on the page instead. The first version of this suite
     * asserted the JSON *had* that key, which it did, and stayed green while the
     * trail printed `review.auditActions.drone.resubmitted` at a reviewer.
     *
     * `i18n:check` cannot see it either: both catalogues were wrong identically.
     */
    it(`has no dotted key under auditActions in ${locale}`, () => {
      expect(
        Object.keys(labelsFor(messages)).filter((key) => key.includes(".")),
      ).toEqual([]);
    });

    /**
     * The other direction. A leftover label reads to the next person as an
     * event the app can still write, which is a claim about behaviour.
     */
    it(`carries no label in ${locale} for an action nothing writes`, () => {
      const known = new Set(ALL_TRAIL_ACTIONS.map(trailLabelKey));
      expect(
        Object.keys(labelsFor(messages)).filter((key) => !known.has(key)),
      ).toEqual([]);
    });
  }

  it("covers every drone, Remote ID and booking action written in src/lib", () => {
    const found = new Set<string>();
    const files = walk("src/lib");

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/action:\s*"([a-z_]+\.[a-z_]+)"/g)) {
        const action = match[1];
        if (NOT_ON_THIS_TRAIL.test(action)) continue;
        if (TRAIL_PREFIXES.some((prefix) => action.startsWith(prefix))) {
          found.add(action);
        }
      }
    }

    // The scan must actually find something — an empty set would make this
    // test pass by finding nothing rather than by everything being labelled.
    expect(found.size).toBeGreaterThan(10);
    expect([...found].filter((action) => !hasTrailLabel(action)).sort()).toEqual(
      [],
    );
  });
});

/** Every `.ts` under a directory, tests excluded. Same walk as `id-exposure.test.ts`. */
function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...walk(path));
    } else if (path.endsWith(".ts") && !path.endsWith(".test.ts")) {
      files.push(path);
    }
  }
  return files;
}
