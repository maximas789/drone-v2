import { describe, expect, it } from "vitest";
import { isInternalPath } from "./url";

/**
 * `?next=` is a redirect target the app hands out in its own URLs — F17's guard
 * builds it and the wizard follows it. That makes it an open-redirect surface,
 * which is a phishing primitive rather than a cosmetic bug: the victim checks the
 * domain, sees ours, and lands somewhere else.
 */
describe("isInternalPath", () => {
  it("accepts an in-app path", () => {
    expect(isInternalPath("/drones/new")).toBe(true);
    expect(isInternalPath("/settings/profile")).toBe(true);
    expect(isInternalPath("/dashboard?tab=drones")).toBe(true);
  });

  it("refuses anything that leaves the site", () => {
    for (const hostile of [
      "https://evil.example",
      "http://evil.example",
      // Protocol-relative: a browser reads both of these as a host, not a path.
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "evil.example",
      "",
    ]) {
      expect(isInternalPath(hostile)).toBe(false);
    }
  });

  it("refuses a locale-prefixed path", () => {
    // next-intl's `Link` and `redirect` add the prefix themselves, so `/ar/x`
    // would become `/ar/ar/x` and 404 — a broken return journey rather than a
    // security problem, but broken all the same. F15 deleted `localeHref` and
    // wrote a test for the same class of mistake.
    expect(isInternalPath("/ar/drones/new")).toBe(false);
    expect(isInternalPath("/en")).toBe(false);
    // A path that merely *starts* with those letters is fine.
    expect(isInternalPath("/archive")).toBe(true);
    expect(isInternalPath("/enroll")).toBe(true);
  });
});
