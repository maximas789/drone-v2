import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { Auth } from "@/lib/auth";

/**
 * The browser half of Better Auth.
 *
 * `Auth` is imported **as a type only**, so nothing from `src/lib/auth.ts` —
 * and therefore nothing from the database — is bundled into the client. It is
 * there so `inferAdditionalFields` types `role` and `preferredLocale` on the
 * client session without a second declaration of them that could drift.
 *
 * No `baseURL`: requests go to the same origin the page was served from. That
 * also means the dev server landing on a different port than expected can't
 * break sign-in.
 */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
