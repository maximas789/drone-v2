/**
 * What a session's `user_agent` string is willing to say about the device.
 *
 * **Pure, deliberately coarse, and deliberately not a library.** The job here
 * is to help a person recognise *their own* session in a list of three — "the
 * Chrome one on Windows, that's this laptop" — and nothing more. A full UA
 * database would answer questions nobody on this page is asking, ship a
 * megabyte to do it, and go stale.
 *
 * **A user agent is a claim, not a fact.** It is client-supplied, trivially
 * forged, and full of deliberate lies for compatibility — every Chromium
 * browser says `Safari`, Edge says `Chrome`, and Chrome on iOS is Safari
 * underneath. So the order of the tests below is not arbitrary: the more
 * specific brand has to win, because each of them also carries the name of the
 * one before it. Getting that order wrong is the whole bug this module can
 * have.
 *
 * Returns `null` rather than a guess when nothing matches. **"Unknown device"
 * is an honest row**; naming the wrong browser is how somebody fails to
 * recognise their own laptop and revokes the session they are sitting at.
 */

export type DeviceSummary = {
  /** `Chrome`, `Firefox`, … or `null` when the string says nothing usable. */
  browser: string | null;
  /** `Windows`, `Android`, … or `null`. */
  platform: string | null;
};

/**
 * Most specific first. `Edg` before `Chrome` before `Safari`, because Edge's UA
 * contains all three and Chrome's contains the last two.
 */
const BROWSERS: readonly [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\//, "Edge"],
  [/\bOPR\/|\bOpera\b/, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bCriOS\//, "Chrome"],
  [/\bChrome\/|\bChromium\//, "Chrome"],
  // Last: every browser above also says "Safari".
  [/\bSafari\//, "Safari"],
];

/**
 * `iPhone`/`iPad` before `Mac`, because iOS user agents say `like Mac OS X`.
 * `Android` before `Linux`, because Android is Linux and says so.
 */
const PLATFORMS: readonly [RegExp, string][] = [
  [/\biPhone\b/, "iPhone"],
  [/\biPad\b/, "iPad"],
  [/\bAndroid\b/, "Android"],
  [/\bWindows\b/, "Windows"],
  [/\bMac OS X\b|\bMacintosh\b/, "macOS"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bLinux\b/, "Linux"],
];

function firstMatch(
  value: string,
  table: readonly [RegExp, string][],
): string | null {
  for (const [pattern, name] of table) {
    if (pattern.test(value)) return name;
  }
  return null;
}

export function describeUserAgent(userAgent: string | null): DeviceSummary {
  if (!userAgent) return { browser: null, platform: null };
  return {
    browser: firstMatch(userAgent, BROWSERS),
    platform: firstMatch(userAgent, PLATFORMS),
  };
}
