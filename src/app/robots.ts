import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/url";

/**
 * **`/*​/rid/` must never be indexed.**
 *
 * Indexing the scan endpoint would turn it into a browsable national drone
 * registry — a crawler walking `/ar/rid/AJN-…` would assemble exactly the list
 * the masking design exists to prevent, one anonymous page at a time. The pages
 * also carry `robots: { index: false, follow: false }` in their metadata; this
 * file is the half a crawler reads before it ever fetches one.
 *
 * Written by F11 because F11 built the endpoint. **F30 owns this file
 * afterwards** and adds the sitemap reference and the rest of the private
 * surfaces as they are built; the disallows below are the ones that exist
 * today, not the finished list.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          // Both the locale-prefixed page and the JSON twin.
          "/*/rid/",
          "/dashboard",
          "/admin",
        ],
      },
    ],
    host: APP_URL,
  };
}
