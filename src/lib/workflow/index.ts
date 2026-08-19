/**
 * **No status change happens outside this folder.** An ESLint rule enforces it
 * by banning `.set({ status:` everywhere else.
 *
 * `transitions.ts` declares every legal edge as data; `apply.ts` executes one,
 * writing the row, the audit event and the notification in a single
 * transaction. `drone.ts` and `booking.ts` hold the guards a table cannot
 * express — whether a profile is complete, whether a slot is more than two
 * hours away, whether the airspace still authorises a flight approved last
 * week.
 *
 * F08 wrote the four system edges; **F14 completed both lifecycles** and added
 * the role branch that resolves `owner` from the row rather than from anything
 * the caller says about itself.
 *
 * Three files here have **no `TRANSITIONS` entry** and are not workflows in the
 * four-state sense: `declaration.ts`, `identity.ts` and `report.ts` each hold a
 * pair of terminal decisions with no path between them, where the machinery in
 * `apply.ts` would be scaffolding around a boolean. They live here anyway
 * because what they write *is* a status — `verifiedAt` gates a booking,
 * `drone_report.status` closes a report — and rule 11 is about where a status
 * is written, not about how many states it has.
 */
export * from "./apply";
export * from "./booking";
export * from "./declaration";
export * from "./drone";
export * from "./identity";
export * from "./remote-id";
export * from "./report";
export * from "./rules";
export * from "./transitions";
