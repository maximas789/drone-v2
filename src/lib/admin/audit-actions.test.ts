import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ar from "@/../messages/ar.json";
import en from "@/../messages/en.json";
import {
  BOOKING_TRAIL_ACTIONS,
  DRONE_TRAIL_ACTIONS,
  PILOT_TRAIL_ACTIONS,
  REPORT_TRAIL_ACTIONS,
  USER_TRAIL_ACTIONS,
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

/** The namespaces the four trails are audited under. */
const TRAIL_PREFIXES = [
  "drone.",
  "remote_id.",
  "declaration.",
  "booking.",
  "pilot_profile.",
  "drone_report.",
];

/**
 * Written against a user or a zone — no trail renders these yet. `user.` is
 * F05's role change, which belongs to F25's audit browser; the zone ones are
 * F23's. Both are listed rather than left out so the day a screen renders them
 * this scan is the thing that asks for their labels.
 */
const NOT_ON_THIS_TRAIL = /^(user|zone|city|zone_closure)\./;

/** Every action any trail can show. `hasTrailLabel` answers for all five. */
const ALL_TRAIL_ACTIONS = [
  ...DRONE_TRAIL_ACTIONS,
  ...BOOKING_TRAIL_ACTIONS,
  ...PILOT_TRAIL_ACTIONS,
  ...REPORT_TRAIL_ACTIONS,
  /**
   * F24's `remote_id.lookup` is filed against a **user** and shows on no
   * aircraft's trail. It is named here anyway: F25's audit browser will render
   * it, and a label that exists must be a label something writes — which is
   * what the "nothing writes this" test below checks in the other direction.
   */
  ...USER_TRAIL_ACTIONS,
];

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

  it("covers every action written in src/lib that a trail renders", () => {
    const found = new Set<string>();
    const files = walk("src/lib");

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      /**
       * **The window after each `action:`, not the literal that follows it.**
       *
       * The first version matched `action: "x.y"` and nothing else, so it
       * missed `action: isComplete ? "pilot_profile.completed" : …` — a
       * ternary is not a literal — and that code reached a reviewer's screen as
       * a raw dotted path in F22c, found by reading the English page.
       *
       * Widening it to *any* quoted action-shaped string went too far the other
       * way: `booking.create` and `drone.draft` are rate-limit rule keys and
       * `booking.reminded` is a notification type, none of which a trail ever
       * renders. So the scan takes the two hundred characters following each
       * `action:` and reads every quoted candidate inside that window, which
       * covers a ternary without swallowing the rest of the file.
       */
      for (const site of source.split(/\baction:/).slice(1)) {
        for (const match of site
          .slice(0, 200)
          .matchAll(/"([a-z_]+\.[a-z_]+)"/g)) {
          const action = match[1];
          if (NOT_ON_THIS_TRAIL.test(action)) continue;
          if (TRAIL_PREFIXES.some((prefix) => action.startsWith(prefix))) {
            found.add(action);
          }
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
