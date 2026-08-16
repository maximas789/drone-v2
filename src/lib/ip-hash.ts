import { createHash } from "node:crypto";

/**
 * `sha256(RATE_LIMIT_PEPPER + ip)`.
 *
 * **A raw IP address is never stored anywhere in this app** — not in
 * `rate_limit_bucket`, not in `audit_event.ipHash`. A raw address in either is
 * a privacy liability that buys nothing: both only ever need to know whether
 * two requests came from the same place, and a hash answers that.
 *
 * The pepper is what stops the hash being reversible. There are about four
 * billion IPv4 addresses; an unpeppered sha256 of one is trivially inverted by
 * hashing all of them. **Changing `RATE_LIMIT_PEPPER` orphans every hash
 * already stored** — which for rate limiting merely resets the counters, but
 * for `audit_event` breaks the link between events from the same source. It is
 * generated once and never regenerated.
 *
 * F14 must import this rather than growing its own copy: two hashers with two
 * peppers would silently stop matching each other.
 */
export function hashIp(ip: string): string {
  const pepper = process.env.RATE_LIMIT_PEPPER;

  if (!pepper) {
    // Loud, and still functional. Falling back to the raw address would put
    // one in the database, which is the single thing this module exists to
    // prevent; a constant would collapse every visitor into one bucket and
    // rate-limit the whole internet as if it were one client.
    throw new Error(
      "RATE_LIMIT_PEPPER is not set. Generate it once with " +
        `node -e "console.log(crypto.randomBytes(32).toString('base64'))"` +
        " and never regenerate it.",
    );
  }

  return createHash("sha256").update(`${pepper}${ip}`).digest("hex");
}

/**
 * The client address, from the proxy headers a host actually sets.
 *
 * Returns `null` rather than a guess when there is no header — an anonymous
 * limit that cannot identify the caller must not silently bucket everyone
 * together under `"unknown"`, which would rate-limit every visitor as one.
 * Callers decide what to do with `null`; the honest options are to skip the
 * limit or to refuse, and this module does not choose for them.
 *
 * `x-forwarded-for` is a **client-controlled** header. It is trustworthy only
 * because Vercel and every comparable host overwrite it at the edge. Anywhere
 * that is not true, this is spoofable and the limit is bypassable.
 */
export function clientIpFrom(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // The left-most entry is the original client; the rest are proxies.
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || null;
}
