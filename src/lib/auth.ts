import { betterAuth } from "better-auth";
import { after } from "next/server";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { sql } from "drizzle-orm";
// `@/lib/db/client`, not `@/lib/db`: the Better Auth CLI has to load this file
// outside React, and it refuses any config that reaches `server-only`. This is
// the only module in the app allowed to skip the guarded entry point — see the
// comment in `src/lib/db/index.ts`, and the ESLint rule that enforces it.
import { db } from "@/lib/db/client";
import { toLocale } from "@/lib/locale";

/**
 * Better Auth's own `User` type does not carry the additional fields declared
 * below, so `preferredLocale` arrives on the callback argument untyped. Read
 * through `toLocale`, which falls back to Arabic rather than to whatever the
 * sender happened to be using.
 */
function recipientLocale(user: unknown) {
  return toLocale((user as { preferredLocale?: unknown } | null)?.preferredLocale);
}

/**
 * Stated in the reset email, so it must not drift from the config. Better
 * Auth's own default is the same hour; setting it explicitly is what makes the
 * sentence in the email true by construction rather than by coincidence.
 */
const RESET_TOKEN_MINUTES = 60;

/**
 * **Dynamically imported, and that is load-bearing.** `@/lib/email/send`
 * reaches `@/lib/db`, which carries `server-only` — and the Better Auth CLI
 * loads this file outside React and refuses any config that reaches it,
 * however transitively. A dynamic import inside a callback body is never
 * evaluated at config-load time, so the CLI stays happy and the request path
 * gets the guarded module.
 *
 * **Deferred with `after()`, and that is load-bearing too.** Better Auth
 * `await`s these callbacks *inside* the sign-up transaction — the user row is
 * written but not yet committed. `sendEmail` writes `email_log`, whose
 * `user_id` is a foreign key onto `user`, over a **different pooled
 * connection**, which cannot see an uncommitted row. So the insert failed with
 * a foreign-key violation and the verification email was silently lost: the
 * account was created, the response was 200, and nothing was sent.
 *
 * `after()` runs the callback once the response is finished, by which point
 * the transaction has committed. It also takes the send off the critical path,
 * which is what the fire-and-forget was for in the first place.
 *
 * Found by signing up for real. Nothing in the test suite or the build would
 * have caught it, because it needs a genuine account creation to happen.
 */
async function deliver(
  send: (mod: typeof import("@/lib/email/send")) => Promise<unknown>,
) {
  try {
    await send(await import("@/lib/email/send"));
  } catch (caught) {
    // `sendEmail` already swallows its own failures; this catches the import
    // itself. An auth flow must not break because mail did.
    console.error("[auth] email delivery failed:", caught);
  }
}

/** `deliver`, but after the response — and therefore after the commit. */
function deliverAfterResponse(
  send: (mod: typeof import("@/lib/email/send")) => Promise<unknown>,
) {
  try {
    after(() => deliver(send));
  } catch (caught) {
    // `after()` needs a request scope. If this is ever called outside one,
    // sending late is better than not sending at all.
    console.error("[auth] after() unavailable, sending inline:", caught);
    void deliver(send);
  }
}

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

  /**
   * **Layer 1 of two, and it is not sufficient on its own.** This covers
   * `/api/auth/*` and nothing else. Server actions are ordinary POSTs to a
   * page route and are completely invisible to it — `src/lib/rate-limit.ts` is
   * what stands in front of those.
   *
   * `storage: "database"` rather than the default in-memory map: memory is
   * per-instance, so on any host that runs more than one the limit is
   * multiplied by the instance count, and it resets on every deploy. The cost
   * is a table, which the Better Auth CLI generates.
   *
   * The custom rules are the endpoints where a flood costs something real —
   * an account, an email, or a password guess.
   */
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/sign-up/email": { window: 3600, max: 5 },
      "/sign-in/email": { window: 60, max: 10 },
      // Two a minute: each one is an email we send and, once a domain is
      // verified, an email somebody else receives.
      "/send-verification-email": { window: 60, max: 2 },
      "/forget-password": { window: 60, max: 3 },
      "/change-password": { window: 60, max: 5 },
      "/delete-user": { window: 60, max: 3 },
    },
  },

  emailAndPassword: {
    enabled: true,
    /**
     * Still `false`, and deliberately so now that mail works. Blocking sign-in
     * on verification turns one mistyped address into a support request the
     * user cannot answer — and with no `RESEND_API_KEY` the message only ever
     * reaches the terminal, which would lock every new account out of the app
     * it just created. F28 builds the nag-and-resend banner instead.
     */
    requireEmailVerification: false,

    resetPasswordTokenExpiresIn: RESET_TOKEN_MINUTES * 60,

    /**
     * The send is **deferred, never awaited here** — Better Auth's own
     * instruction, and a security rule rather than a style preference: awaiting
     * it makes the response measurably slower when the account exists than when
     * it does not, which tells an attacker which addresses are registered. The
     * sibling defence is in `authErrorKey`, where `USER_NOT_FOUND` and a wrong
     * password map to the same message.
     */
    sendResetPassword: async ({ user, url }) => {
      deliverAfterResponse(({ sendEmail }) =>
        sendEmail({
          to: user.email,
          template: "reset-password",
          locale: recipientLocale(user),
          userId: user.id,
          params: {
            url,
            name: user.name || undefined,
            expiresInMinutes: RESET_TOKEN_MINUTES,
          },
        }),
      );
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,

    sendVerificationEmail: async ({ user, url }) => {
      deliverAfterResponse(({ sendEmail }) =>
        sendEmail({
          to: user.email,
          template: "verify-email",
          locale: recipientLocale(user),
          userId: user.id,
          params: { url, name: user.name || undefined },
        }),
      );
    },
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
