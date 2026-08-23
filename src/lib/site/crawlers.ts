/**
 * The AI crawler user-agent tokens, split by what the operator does with what
 * it fetches. **Pure** — `robots.ts` reads it, and a unit test reads it without
 * a bundler.
 *
 * ---
 *
 * **These were researched, not remembered.** F30's feature file says the tokens
 * come from Wave 0's research; they do not — F01 researched package versions
 * and nothing else, and `BUILD-LOG.md` has no crawler row. So they were fetched
 * from each operator's own documentation on **2026-08-23**, and every token
 * below carries the page it came from. The build log records the same list.
 *
 * A wrong token is the reason this matters. It is not a syntax error and
 * nothing reports it: a `User-agent:` line naming a bot that does not exist is
 * a rule that matches nothing, silently, for ever. The same is true of a token
 * that was renamed after this file was written — so the date above is part of
 * the data, and re-checking it is the maintenance this file needs.
 *
 * ---
 *
 * **Two entries are not crawlers at all.** `Google-Extended` and
 * `Applebot-Extended` fetch nothing; each is a *usage* control that decides
 * what the operator's real crawler (Googlebot, Applebot) is permitted to do
 * with pages it already has. Disallowing them withholds a permission rather
 * than refusing a request. They are grouped under training because that is the
 * permission they govern, and the distinction is written here because a reader
 * who assumes otherwise will conclude the file blocks a fetch that still
 * happens.
 *
 * **One entry does not fit the split.** Meta documents `meta-externalagent` as
 * serving *both* "training foundation AI models" and "improving products by
 * indexing content directly" — one token, two purposes, no way to separate
 * them in `robots.txt`. It is listed under training, which is the stricter
 * reading, and named here so nobody later reads its absence from the search
 * group as an oversight.
 */

export type CrawlerKind = "training" | "search" | "userInitiated";

export type CrawlerGroup = {
  kind: CrawlerKind;
  /** Exact `User-agent:` tokens, as the operator writes them. */
  tokens: readonly string[];
  /** Where each token was read from, on the date in this file's header. */
  sources: readonly string[];
};

/**
 * Collecting text to train a model, or deciding whether already-collected text
 * may be trained on.
 */
const TRAINING: CrawlerGroup = {
  kind: "training",
  tokens: [
    // OpenAI — "may be used in training our generative AI foundation models".
    "GPTBot",
    // Anthropic — "collecting web content that could potentially contribute to
    // their training".
    "ClaudeBot",
    // Google — a usage control, not a crawler. Governs training of Gemini
    // models; explicitly "does not impact a site's inclusion in Google Search".
    "Google-Extended",
    // Apple — a usage control, not a crawler. Governs training of Apple's
    // foundation models; a page that disallows it still appears in Apple search.
    "Applebot-Extended",
    // Meta — training *and* direct indexing, in one token. See the header.
    "meta-externalagent",
    // Common Crawl — the bulk corpus most other training sets are built from.
    "CCBot",
  ],
  sources: [
    "https://developers.openai.com/api/docs/bots",
    "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler",
    "https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers",
    "https://support.apple.com/en-us/119829",
    "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/",
    "https://commoncrawl.org/ccbot",
  ],
};

/**
 * Building an index so an assistant can cite the app and link to it. **This is
 * how a public product gets recommended**, which is the whole reason Ajniha
 * has a sitemap at all.
 */
const SEARCH: CrawlerGroup = {
  kind: "search",
  tokens: [
    // OpenAI — "used to surface websites in search results in ChatGPT's search
    // features".
    "OAI-SearchBot",
    // Anthropic — "improve search result quality for users".
    "Claude-SearchBot",
    // Perplexity — "designed to surface and link websites in search results".
    "PerplexityBot",
    // Apple's actual crawler, as distinct from Applebot-Extended above.
    "Applebot",
  ],
  sources: [
    "https://developers.openai.com/api/docs/bots",
    "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler",
    "https://docs.perplexity.ai/guides/bots",
    "https://support.apple.com/en-us/119829",
  ],
};

/**
 * A person asked their assistant to open this page. **Blocking one of these
 * blocks a visitor who chose to come** — it is closer to refusing a browser
 * than to refusing a crawler.
 */
const USER_INITIATED: CrawlerGroup = {
  kind: "userInitiated",
  tokens: [
    // OpenAI — "used for certain user actions in ChatGPT", explicitly "not used
    // for crawling the web in an automatic fashion".
    "ChatGPT-User",
    // Anthropic — "when individuals ask questions to Claude".
    "Claude-User",
    // Perplexity — "supports user actions within Perplexity".
    "Perplexity-User",
    // Meta — "fetches individual links at a user's request".
    "meta-externalfetcher",
  ],
  sources: [
    "https://developers.openai.com/api/docs/bots",
    "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler",
    "https://docs.perplexity.ai/guides/bots",
    "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/",
  ],
};

export const CRAWLER_GROUPS: readonly CrawlerGroup[] = [
  TRAINING,
  SEARCH,
  USER_INITIATED,
];

/**
 * Documented and deliberately **not** named in `robots.txt`, so that a later
 * reader does not add them thinking they were missed.
 *
 * - `OAI-AdsBot` — validates the safety of pages submitted as ChatGPT ads.
 *   Ajniha buys no ads, so there is nothing for it to check and no stance to
 *   take.
 * - `facebookexternalhit` — the link-preview fetcher. It is what renders the
 *   card when somebody pastes an Ajniha link into WhatsApp or Messenger, which
 *   is a use this product actively wants. Blocking it would break F30c's
 *   preview card on the exact surface the pitch is shared in.
 * - `GoogleOther`, `GoogleOther-Image`, `GoogleOther-Video` — generic
 *   product-team crawlers with no stated AI purpose. The `*` group covers them.
 */
export const UNLISTED_CRAWLERS = [
  "OAI-AdsBot",
  "facebookexternalhit",
  "GoogleOther",
] as const;
