import "server-only";

/**
 * The database, for everything inside the request path.
 *
 * The pool itself lives in `./client`, which carries **no** `server-only`
 * import — the Better Auth CLI loads `src/lib/auth.ts` outside React and
 * refuses outright to resolve a config that reaches `server-only`, transitively
 * or not. `src/lib/auth.ts` is therefore the one module allowed to import
 * `@/lib/db/client`; an ESLint rule holds everyone else to `@/lib/db`, which is
 * this file, which still throws in a client component.
 */
export * from "./client";
