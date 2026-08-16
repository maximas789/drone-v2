import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

/**
 * Better Auth's whole HTTP surface, under `/api/auth/*`.
 *
 * Deliberately **outside** `[locale]`: it is not a page, it has no language,
 * and `src/proxy.ts`'s matcher excludes `/api` so next-intl never tries to
 * prefix it. It is also why `next/root-params` is unavailable in here — see the
 * note in `src/i18n/request.ts`.
 */
export const { GET, POST } = toNextJsHandler(auth.handler);
