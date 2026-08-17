/**
 * The airspace authorization engine.
 *
 * The split is the point. `types.ts`, `geometry.ts`, `time.ts` and
 * `evaluate.ts` are **pure** — an ESLint rule refuses `@/lib/db`,
 * `server-only`, `next-intl` and `react` in all of them — because the same code
 * has to run in the browser map for instant feedback and on the server for the
 * authoritative answer. `query.ts` is the one db-facing edge, and it is not
 * re-exported here: importing `@/lib/airspace` from a client component must
 * stay safe.
 */
export * from "./evaluate";
export * from "./geometry";
export * from "./time";
export * from "./types";
