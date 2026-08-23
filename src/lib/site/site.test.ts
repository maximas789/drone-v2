import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { CRAWLER_GROUPS, UNLISTED_CRAWLERS } from "./crawlers";
import {
  disallowedPaths,
  localePath,
  PRIVATE_SEGMENTS,
  PUBLIC_PAGES,
} from "./pages";
import { DOC_SLUGS } from "@/lib/docs/slugs";
import { LEGAL_SLUGS } from "@/lib/legal/documents";
import { LOCALES } from "@/lib/locale";

/**
 * F30's spine, pinned. Everything here is pure — no filesystem, no MDX, no
 * database — which is the whole reason `pages.ts` and `crawlers.ts` were split
 * away from `resolve.ts`.
 */

describe("the public page list", () => {
  /**
   * **The criterion the whole feature exists for.** A `/rid/` URL in the
   * sitemap or in `llms.txt` invites a crawler to walk the Remote ID scan
   * endpoint, and a crawler that walks it has built a browsable national drone
   * registry — the thing F11's masking design exists to prevent.
   *
   * Both consumers derive their URLs from this list, so this assertion covers
   * both. It is deliberately broad: not "no `/rid/{code}`" but no `rid`
   * anywhere in any path.
   */
  it("contains no Remote ID scan route", () => {
    for (const page of PUBLIC_PAGES) {
      expect(page.path).not.toContain("rid");
    }
  });

  /** And nothing else behind a sign-in, by the same argument. */
  it("contains no private segment", () => {
    for (const page of PUBLIC_PAGES) {
      const first = page.path.split("/")[1] ?? "";
      expect(PRIVATE_SEGMENTS as readonly string[]).not.toContain(first);
    }
  });

  it("lists every documentation page", () => {
    const paths = new Set(PUBLIC_PAGES.map((page) => page.path));
    expect(paths.has("/docs")).toBe(true);
    for (const slug of DOC_SLUGS) {
      expect(paths.has(`/docs/${slug}`)).toBe(true);
    }
  });

  it("lists every legal page", () => {
    const paths = new Set(PUBLIC_PAGES.map((page) => page.path));
    for (const slug of LEGAL_SLUGS) {
      expect(paths.has(`/${slug}`)).toBe(true);
    }
  });

  it("has no duplicate path", () => {
    const paths = PUBLIC_PAGES.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("uses unprefixed, leading-slash paths", () => {
    for (const page of PUBLIC_PAGES) {
      expect(page.path.startsWith("/")).toBe(true);
      // A locale in a stored path is F15's `localeHref` mistake again: the
      // prefix is added at the point of use, once.
      expect(page.path).not.toMatch(/^\/(ar|en)(\/|$)/);
      if (page.path !== "/") expect(page.path.endsWith("/")).toBe(false);
    }
  });
});

describe("localePath", () => {
  it("prefixes without leaving a bare trailing slash", () => {
    expect(localePath("/", "ar")).toBe("/ar");
    expect(localePath("/zones", "en")).toBe("/en/zones");
    expect(localePath("/docs/remote-id", "ar")).toBe("/ar/docs/remote-id");
  });
});

describe("the disallow list", () => {
  /**
   * **The bug F30 found and this pins.** F11's `robots.ts` disallowed
   * `/dashboard` and `/admin`. Routing is `localePrefix: "always"`, a
   * `Disallow:` is a prefix match, and `/ar/dashboard` does not start with
   * `/dashboard` — so both rules matched nothing at all, silently, for four
   * waves.
   */
  it("covers every private segment in every locale", () => {
    const paths = disallowedPaths();
    for (const segment of PRIVATE_SEGMENTS) {
      expect(paths).toContain(`/*/${segment}`);
      for (const locale of LOCALES) {
        expect(paths).toContain(`/${locale}/${segment}`);
      }
    }
  });

  /**
   * The other half of the same trap: `Disallow: /ar/settings/` covers
   * `/ar/settings/profile` and leaves `/ar/settings` — a real page — crawlable.
   */
  it("puts no trailing slash on a segment rule", () => {
    for (const path of disallowedPaths()) {
      if (path === "/api/") continue;
      expect(path.endsWith("/")).toBe(false);
    }
  });

  it("disallows the API surface", () => {
    expect(disallowedPaths()).toContain("/api/");
  });
});

describe("robots.txt", () => {
  const file = robots();
  const rules = Array.isArray(file.rules) ? file.rules : [file.rules];

  /**
   * **The single most dangerous thing in this file.** RFC 9309: a robot obeys
   * the *most specific* `User-agent` group that matches it and ignores every
   * other group, `*` included. A named group with a shorter `Disallow` list
   * does not add a restriction — it removes the ones in `*`.
   *
   * So naming `GPTBot` in order to state a policy about it, and omitting one
   * line, would hand `GPTBot` the Remote ID scan endpoint that the anonymous
   * group is refused. Every group must carry the identical list.
   */
  it("gives every user-agent group the identical disallow list", () => {
    const expected = disallowedPaths();
    expect(rules.length).toBeGreaterThan(1);
    for (const rule of rules) {
      const disallow = Array.isArray(rule.disallow)
        ? rule.disallow
        : [rule.disallow];
      expect(disallow).toEqual(expected);
    }
  });

  it("disallows the Remote ID scan endpoint in every group", () => {
    for (const rule of rules) {
      const disallow = Array.isArray(rule.disallow)
        ? rule.disallow
        : [rule.disallow];
      expect(disallow).toContain("/*/rid");
      for (const locale of LOCALES) {
        expect(disallow).toContain(`/${locale}/rid`);
      }
    }
  });

  it("has an anonymous group", () => {
    expect(rules.some((rule) => rule.userAgent === "*")).toBe(true);
  });

  it("names every researched crawler token exactly once", () => {
    const named = rules
      .flatMap((rule) =>
        Array.isArray(rule.userAgent)
          ? rule.userAgent
          : rule.userAgent
            ? [rule.userAgent]
            : [],
      )
      .filter((token) => token !== "*");
    const expected = CRAWLER_GROUPS.flatMap((group) => [...group.tokens]);
    expect(named.sort()).toEqual([...expected].sort());
    expect(new Set(named).size).toBe(named.length);
  });

  /**
   * `facebookexternalhit` renders the preview card when an Ajniha link is
   * pasted into WhatsApp or Messenger — the exact surface this pitch is shared
   * in. Naming it would put it in its own group, and a group is a place a
   * future edit can go wrong; the `*` group already allows it everything it
   * should have.
   */
  it("does not name a crawler it deliberately leaves to the anonymous group", () => {
    const named = new Set(
      rules.flatMap((rule) =>
        Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent ?? ""],
      ),
    );
    for (const token of UNLISTED_CRAWLERS) {
      expect(named.has(token)).toBe(false);
    }
  });

  it("points at a sitemap on the app's own origin", () => {
    expect(file.sitemap).toMatch(/^https?:\/\/.+\/sitemap\.xml$/);
  });
});

describe("crawler tokens", () => {
  it("are well-formed and unique across the three groups", () => {
    const all = CRAWLER_GROUPS.flatMap((group) => [...group.tokens]);
    expect(all.length).toBeGreaterThan(0);
    expect(new Set(all).size).toBe(all.length);
    for (const token of all) {
      // A `User-agent:` token is one word. A stray space would split the line
      // and produce a rule naming something that does not exist — which is
      // exactly the silent failure this whole file is careful about.
      expect(token).toMatch(/^[A-Za-z0-9._-]+$/);
    }
  });

  it("records where each group's tokens were read from", () => {
    for (const group of CRAWLER_GROUPS) {
      expect(group.sources.length).toBeGreaterThan(0);
      for (const source of group.sources) {
        expect(source).toMatch(/^https:\/\//);
      }
    }
  });
});

/**
 * **A missing message key is not an error — it is text.**
 *
 * `llms.txt` shipped the literal string `meta.description` into the file that
 * describes this app to an assistant, because the key had been deleted and
 * next-intl renders the raw path when it cannot resolve one. `typecheck`,
 * `lint`, `i18n:check` and 1100 tests were all green; it was found by fetching
 * the file. Open thread 60, in a new costume — that one put a raw key on the
 * regulator's audit trail.
 *
 * `i18n:check` cannot catch it: it compares the two catalogues with each other,
 * and a key deleted from **both** leaves them perfectly in sync. So the keys the
 * spine actually reads are named here, and a deletion fails the suite.
 */
describe("the metadata catalogue", () => {
  const keys = [
    "siteName",
    "titlePattern",
    "scanTitle",
    "llmsIntro",
    "llmsSection",
    ...["home", "howItWorks", "remoteId", "zones", "docs"].flatMap((page) => [
      `pages.${page}.title`,
      `pages.${page}.description`,
    ]),
  ];

  it.each(["ar", "en"])("has every key F30 reads, in %s", async (locale) => {
    const catalogue = (
      await import(`../../../messages/${locale}.json`, {
        with: { type: "json" },
      })
    ).default as Record<string, unknown>;

    for (const key of keys) {
      const value = key
        .split(".")
        .reduce<unknown>(
          (node, part) =>
            typeof node === "object" && node !== null
              ? (node as Record<string, unknown>)[part]
              : undefined,
          catalogue.meta,
        );
      expect(typeof value, `meta.${key} missing from ${locale}.json`).toBe(
        "string",
      );
    }
  });

  /**
   * Next substitutes `%s` itself. An ICU `{page}` here would render as the
   * literal text `{page}` in the browser tab of every page on the site.
   */
  it.each(["ar", "en"])("uses Next's %%s in the title template (%s)", async (locale) => {
    const catalogue = (
      await import(`../../../messages/${locale}.json`, {
        with: { type: "json" },
      })
    ).default as { meta: { titlePattern: string } };
    expect(catalogue.meta.titlePattern).toContain("%s");
    expect(catalogue.meta.titlePattern).not.toContain("{");
  });
});
