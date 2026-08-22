import { describe, expect, it } from "vitest";
import { describeUserAgent } from "./user-agent";

/**
 * **Every case here is a real user-agent string, and every one of them lies.**
 *
 * That is the point: each browser carries the names of the browsers it wanted
 * to be mistaken for, so the only bug this module can have is testing them in
 * the wrong order. These are the pairs that catch it.
 */
describe("describeUserAgent", () => {
  const CASES: [string, string, string | null, string | null][] = [
    [
      "Chrome on Windows",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Chrome",
      "Windows",
    ],
    [
      // Says Chrome AND Safari. Must not read as either.
      "Edge on Windows",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
      "Edge",
      "Windows",
    ],
    [
      "Safari on macOS",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
      "Safari",
      "macOS",
    ],
    [
      // Says "like Mac OS X". Must read as iPhone, not macOS.
      "Safari on iPhone",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
      "Safari",
      "iPhone",
    ],
    [
      // Chrome on iOS is `CriOS`, and still says Safari and Mac OS X.
      "Chrome on iPhone",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.0.0 Mobile/15E148 Safari/604.1",
      "Chrome",
      "iPhone",
    ],
    [
      // Android is Linux and says so. Must read as Android.
      "Chrome on Android",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      "Chrome",
      "Android",
    ],
    [
      // Says Chrome and Safari, and is neither.
      "Samsung Internet",
      "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
      "Samsung Internet",
      "Android",
    ],
    [
      "Firefox on Linux",
      "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
      "Firefox",
      "Linux",
    ],
  ];

  for (const [name, ua, browser, platform] of CASES) {
    it(`reads ${name}`, () => {
      expect(describeUserAgent(ua)).toEqual({ browser, platform });
    });
  }

  /**
   * An honest blank beats a confident wrong answer: this row will render as
   * "unknown device", and somebody who cannot recognise a session is far less
   * likely to revoke the wrong one than somebody shown the wrong browser name.
   */
  it("says nothing rather than guessing", () => {
    expect(describeUserAgent(null)).toEqual({ browser: null, platform: null });
    expect(describeUserAgent("")).toEqual({ browser: null, platform: null });
    expect(describeUserAgent("curl/8.4.0")).toEqual({
      browser: null,
      platform: null,
    });
  });
});
