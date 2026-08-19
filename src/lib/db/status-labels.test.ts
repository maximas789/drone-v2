import { describe, expect, it } from "vitest";
import ar from "@/../messages/ar.json";
import en from "@/../messages/en.json";
import { bookingStatus, droneStatus } from "./enums";

/**
 * **Every status a row can hold must be sayable in both languages.**
 *
 * `i18n:check` compares the two catalogues against each other, so a key missing
 * from *both* is missing consistently and passes. That is not a hypothetical:
 * it shipped `nav.dashboard` as a raw key in F16a, and it shipped
 * `bookings.statusPending` on the dashboard in F21b — a badge printing
 * `bookings.statusPending` beside a flight, found by opening the page and by
 * nothing else.
 *
 * This is the other half, the same shape as `airspace/reasons.test.ts`: the
 * catalogues compared against the **code**. The enum is the source of truth, so
 * adding a status without a label fails here rather than in front of a pilot.
 *
 * The key names mirror the badge components — `DroneStatusBadge` and
 * `BookingStatusBadge` — which is the coupling being asserted.
 */

const KEY = (status: string) =>
  `status${status
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("")}`;

const catalogues = { ar, en };

describe("status labels", () => {
  for (const [locale, messages] of Object.entries(catalogues)) {
    it(`has a label for every booking status in ${locale}`, () => {
      const bookings = messages.bookings as Record<string, unknown>;
      expect(
        bookingStatus.enumValues.filter((status) => !bookings[KEY(status)]),
      ).toEqual([]);
    });

    it(`has a label for every drone status in ${locale}`, () => {
      const drones = messages.drones as Record<string, unknown>;
      expect(
        droneStatus.enumValues.filter((status) => !drones[KEY(status)]),
      ).toEqual([]);
    });

    /**
     * The other direction. A leftover `statusConfirmed` — which is what
     * `bookings` carried until F21b, matching no value the column can hold —
     * reads to the next person as a state the app can still be in.
     */
    it(`carries no booking status label in ${locale} for a value the column cannot hold`, () => {
      const known = new Set(bookingStatus.enumValues.map(KEY));
      const strays = Object.keys(messages.bookings).filter(
        (key) => key.startsWith("status") && key !== "status" && !known.has(key),
      );
      expect(strays).toEqual([]);
    });
  }
});
