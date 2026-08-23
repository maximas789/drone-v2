// F31a — prove the migration folder applies cleanly to an EMPTY database.
// Creates a throwaway database, runs every migration into it, counts what
// landed, then drops it. Never touches `app`.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const BASE = "postgresql://app:app@localhost:5432/";
const NAME = "ajniha_freshcheck";

const admin = postgres(BASE + "postgres", { max: 1 });
await admin.unsafe(`drop database if exists ${NAME}`);
await admin.unsafe(`create database ${NAME}`);
await admin.end();

const sql = postgres(BASE + NAME, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`;
  const enums = await sql`
    select typname from pg_type where typtype = 'e' order by typname`;
  const applied = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
  console.log(`migrations applied: ${applied[0].n}`);
  console.log(`tables (${tables.length}): ${tables.map((t) => t.table_name).join(", ")}`);
  console.log(`enums (${enums.length}): ${enums.map((e) => e.typname).join(", ")}`);
} finally {
  await sql.end();
  const drop = postgres(BASE + "postgres", { max: 1 });
  await drop.unsafe(`drop database if exists ${NAME}`);
  await drop.end();
  console.log("scratch database dropped");
}
