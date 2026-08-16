import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { sql } from "drizzle-orm";
// `@/lib/db/client`, not `@/lib/db`: the Better Auth CLI has to load this file
// outside React, and it refuses any config that reaches `server-only`. This is
// the only module in the app allowed to skip the guarded entry point — see the
// comment in `src/lib/db/index.ts`, and the ESLint rule that enforces it.
import { db } from "@/lib/db/client";

/**
 * Better Auth — the one place accounts, sessions and roles are defined.
 *
 * **Editing this file is a three-step change, not one.** Re-run all three or
 * the database and the config silently disagree:
 *
 *   pnpm dlx @better-auth/cli@latest generate --config src/lib/auth.ts \
 *     --output src/lib/db/auth-schema.ts -y
 *   pnpm db:generate      # turns those table definitions into SQL
 *   pnpm db:migrate       # after READING drizzle/*.sql
 *
 * F06 (email) and F09 (rate limiting) both come back here.
 */
export const auth = betterAuth({
  appName: "Ajniha",

  database: drizzleAdapter(db, {
    provider: "pg",
    // A sign-up writes `user` and `account` together; without this they are two
    // statements and a failure halfway leaves an account with no credential.
    transaction: true,
  }),

  emailAndPassword: {
    enabled: true,
    // Email verification and password reset are wired in the UI but have
    // nowhere to send from until F06 supplies `sendVerificationEmail` /
    // `sendResetPassword`. Requiring verification now would lock every new
    // account out of the app it just created.
    requireEmailVerification: false,
  },

  user: {
    additionalFields: {
      /**
       * **`input: false` is the security control, not a formality.** Without
       * it, `role` is an ordinary profile field and any signed-in user can
       * PATCH themselves to `admin` through the normal update-user call.
       *
       * Role lives on `user` — rather than in a joined table — because it gates
       * the proxy redirect, three layout guards and every server action, and so
       * has to be readable on every request without a query.
       *
       * National ID / Iqama deliberately does **not** live here: additional
       * fields are returned by `getSession` and therefore serialised into
       * client components. That data belongs in `pilot_profile` (F17).
       */
      role: {
        type: ["pilot", "reviewer", "admin"],
        defaultValue: "pilot",
        input: false,
        required: false,
      },
      preferredLocale: {
        type: ["ar", "en"],
        defaultValue: "ar",
        input: true,
        required: false,
      },
    },
    changeEmail: { enabled: true },
    deleteUser: { enabled: true },
  },

  databaseHooks: {
    user: {
      create: {
        /**
         * The first account created becomes the admin; everyone after is a
         * pilot. There is no self-service escalation path — an admin promotes
         * people with `setUserRole`, which writes an audit event.
         *
         * Two sign-ups in the same instant could both come out admin. Not worth
         * solving for a single-owner app; the fix, if it ever mattered, is a
         * unique partial index on `role = 'admin'`.
         *
         * The count is raw SQL rather than a Drizzle query on the generated
         * `user` table on purpose: importing `auth-schema.ts` from here would
         * make this file depend on output the CLI can only produce by reading
         * this file.
         */
        before: async (user) => {
          const [row] = await db.execute<{ existing: number }>(
            sql`select count(*)::int as existing from "user"`,
          );

          return {
            data: {
              ...user,
              role: Number(row?.existing ?? 0) === 0 ? "admin" : "pilot",
            },
          };
        },
      },
    },
  },

  // Must stay last: it reads the cookies Better Auth queued during the request
  // and writes them through Next's cookie store, which is what lets a server
  // action sign someone in.
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
