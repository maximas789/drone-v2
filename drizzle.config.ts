import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next, so nothing has loaded .env for it. Node's own
// loader, no dotenv dependency. In production POSTGRES_URL comes from the host.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const url = process.env.POSTGRES_URL;
if (!url) {
  throw new Error(
    "POSTGRES_URL is not set. Run `pnpm db:up` and check .env — see .env.example.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  // camelCase in TypeScript, snake_case in Postgres. Must match the `casing`
  // passed to `drizzle()` in src/lib/db/index.ts, or generated SQL and runtime
  // queries disagree about column names.
  casing: "snake_case",
  // Migrations are read before they are applied. There is deliberately no
  // `db:push` script — see CLAUDE.md rule 1.
  strict: true,
  verbose: true,
});
