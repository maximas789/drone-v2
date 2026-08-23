import type { MetadataRoute } from "next";
import { CRAWLER_GROUPS } from "@/lib/site/crawlers";
import { disallowedPaths } from "@/lib/site/pages";
import { APP_URL } from "@/lib/url";

/**
 * **`/{locale}/rid/` must never be indexed.**
 *
 * Indexing the scan endpoint would turn it into a browsable national drone
 * registry — a crawler walking `/ar/rid/AJN-…` would assemble exactly the list
 * F11's masking design exists to prevent, one anonymous page at a time. The
 * pages also carry `robots: { index: false, follow: false }` in their metadata;
 * this file is the half a crawler reads *before* it ever fetches one, and
 * neither half is sufficient alone: a disallowed page is never fetched, so its
 * `noindex` is never read, and a URL a search engine already knows can stay
 * listed behind a `Disallow` indefinitely.
 *
 * ---
 *
 * **The trap this file is built around: a crawler obeys exactly one group.**
 * RFC 9309 says a robot picks the *most specific* `User-agent` group that
 * matches it and ignores every other group, `*` included. So a named group with
 * a shorter `Disallow` list does not add a restriction — it **removes** the
 * ones in `*`. Naming `GPTBot` to state a policy about it, and forgetting one
 * line, would hand GPTBot the drone registry that the anonymous group is
 * refused.
 *
 * That is why every group below is built from the same `disallowedPaths()` and
 * differs in nothing but its `User-agent` line. The three groups exist to make
 * the stance legible, not to vary it.
 *
 * ---
 *
 * **The stance, decided rather than defaulted.** Ajniha's *content* is not the
 * product — the platform is — so a training crawler has nothing here worth
 * withholding, while search and citation crawlers are how an assistant
 * recommends the app with a link, and a user-initiated fetcher is a visitor who
 * chose to come. All three are allowed on the public explanatory pages and all
 * three are refused the app routes, which are private in any case.
 *
 * The tokens come from each operator's own documentation, read on 2026-08-23
 * and recorded with their sources in `src/lib/site/crawlers.ts`. **A stale
 * token is not an error** — it is a rule that silently matches nothing — so the
 * date is part of the data.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = disallowedPaths();

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      ...CRAWLER_GROUPS.map((group) => ({
        userAgent: [...group.tokens],
        allow: "/",
        disallow,
      })),
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
