import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.POSTGRES_URL;
if (!url) {
  throw new Error(
    "POSTGRES_URL is not set. Run `pnpm db:up`, then check .env against .env.example.",
  );
}

/**
 * One connection pool per process. Next's dev server re-evaluates modules on
 * every edit, so without the global the pool count climbs until Postgres
 * refuses new connections partway through a session.
 */
const globalForDb = globalThis as unknown as {
  __ajnihaSql?: ReturnType<typeof postgres>;
};

const client = globalForDb.__ajnihaSql ?? postgres(url, { max: 10 });
if (process.env.NODE_ENV !== "production") {
  globalForDb.__ajnihaSql = client;
}

export const db = drizzle(client, { schema, casing: "snake_case" });

export { schema };
export type Db = typeof db;
/** A transaction handle, for functions that must accept either. */
export type DbExecutor = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];
