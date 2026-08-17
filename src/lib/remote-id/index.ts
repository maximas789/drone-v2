/**
 * Remote ID: the identifier that replaces the manufacturer serial number.
 *
 * The split mirrors `src/lib/airspace/` and `src/lib/rate-limit/`: `codec.ts`
 * and `redact.ts` are **pure** — no database, no session, no request — because
 * they are the two halves that can be silently wrong, and arithmetic a
 * connection string can veto is arithmetic nobody can unit-test.
 *
 * Status writes are **not** here. `remote_id.status` follows the airframe, and
 * rule 11 keeps every status write in `src/lib/workflow/`.
 */
export * from "./codec";
export * from "./declaration";
export * from "./issue";
export * from "./redact";
export * from "./resolve";
