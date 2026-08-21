import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ar from "@/../messages/ar.json";
import en from "@/../messages/en.json";
import {
  ALL_TRAIL_ACTIONS,
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

/**
 * Every namespace an audited action is written under — **all of them, as of
 * F25b.**
 *
 * This list used to carry six prefixes and a companion exclusion,
 * `NOT_ON_THIS_TRAIL`, holding back `user.`, `zone.`, `zone_closure.` and
 * `city.` because no screen rendered them: "listed rather than left out so the
 * day a screen renders them this scan is the thing that asks for their
 * labels." F25b's audit browser renders **every row in the table**, so that day
 * has arrived and the exclusion is gone. The scan now covers the whole table,
 * which is what it was always waiting to do.
 */
const TRAIL_PREFIXES = [
  "drone.",
  "remote_id.",
  "declaration.",
  "booking.",
  "pilot_profile.",
  "drone_report.",
  "zone.",
  "zone_closure.",
  "city.",
  "user.",
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
          if (TRAIL_PREFIXES.some((prefix) => action.startsWith(prefix))) {
            found.add(action);
          }
        }
      }
    }

    /**
     * **The second scan: actions written through a constant.**
     *
     * `expiry-reminders.ts` writes `action: EXPIRY_REMINDER_ACTION` and
     * `booking-reminders.ts` writes `action: BOOKING_REMINDER_ACTION`. Neither
     * is a quoted literal, so the window scan above saw nothing near the
     * `action:` and both reached the audit browser in F25b as raw dotted codes
     * — `drone.expiry_reminded` and `booking.reminded`, printed at an
     * administrator on the append-only log. Found by opening the page, which is
     * thread 11 for the third time in this file.
     *
     * So the declarations are read as well. Any `const NAME_ACTION = "x.y"` is
     * an audited action by construction: that suffix exists in this codebase
     * for no other purpose.
     */
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(
        /[A-Z0-9_]*_ACTION\s*(?::[^=]*)?=\s*"([a-z_]+\.[a-z_]+)"/g,
      )) {
        found.add(match[1]);
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
