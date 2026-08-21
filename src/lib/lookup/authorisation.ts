import type { ActiveFlight, RedactedRemoteId } from "@/lib/remote-id/redact";

/**
 * **"Is this drone authorised to be flying right now?"**
 *
 * That is the question actually being asked in a field, and it gets one
 * prominent yes or no. Making an officer infer it from a registration badge
 * and a booking table is a design failure — the two facts are on opposite ends
 * of the screen and the wrong answer is the one that gets somebody arrested or
 * lets somebody fly over a stadium.
 *
 * **Pure**, so both halves of the answer are unit-testable without a database
 * and neither can drift from the other.
 *
 * Two conditions, and **both** are required:
 *
 * 1. The registration reads `active`. An expired, suspended or revoked
 *    registration is not made lawful by a booking that was approved while it
 *    was still valid.
 * 2. There is an approved booking whose slot contains *now*. A pending request
 *    is not permission — `findActiveFlight` filters to `approved` for exactly
 *    this reason.
 *
 * `no_flight` and `not_registered` are separate answers rather than one "no",
 * because they call for different acts: the first is a drone flying outside its
 * window, the second is an aircraft that should not be in the air at all.
 */
export type FlightAuthorisation =
  | { authorised: true; flight: ActiveFlight }
  /** Registration is fine; nothing approved covers this moment. */
  | { authorised: false; because: "no_flight" }
  /** The registration itself does not permit flight, whatever is booked. */
  | { authorised: false; because: "not_registered" };

export function flightAuthorisationOf(
  view: RedactedRemoteId,
): FlightAuthorisation {
  if (view.registrationStatus !== "active") {
    return { authorised: false, because: "not_registered" };
  }

  /**
   * The zone and the slot live on the identified branches only — a bystander
   * gets `flightInProgress` and never *where*, because the zone tells them
   * where the operator is standing. This function is called from a reviewer's
   * screen, so the flight is there; the narrowing is what proves it rather
   * than a comment claiming it.
   */
  const flight: ActiveFlight | null =
    "activeFlight" in view ? view.activeFlight : null;

  if (!flight) return { authorised: false, because: "no_flight" };
  return { authorised: true, flight };
}
