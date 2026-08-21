import { describe, expect, it } from "vitest";
import { thinLabels } from "./chart-axes";

/**
 * `thinLabels` decides which category positions get a label. It is the one
 * piece of chart *layout* in this build that can be tested without a browser,
 * and the case below is here because it shipped broken and was found by reading
 * an axis on the page — every static check was green.
 */

const at = (index: number) => `L${index}`;
const indices = (count: number, max?: number) =>
  thinLabels(count, at, max).map((entry) => entry.index);

describe("thinLabels", () => {
  it("labels every position when they all fit", () => {
    expect(indices(4)).toEqual([0, 1, 2, 3]);
  });

  it("always keeps the first and the last", () => {
    // An axis whose ends are unlabelled does not say what period it covers.
    for (const count of [1, 2, 5, 13, 30, 39, 90]) {
      const picked = indices(count);
      expect(picked[0]).toBe(0);
      expect(picked[picked.length - 1]).toBe(count - 1);
    }
  });

  it("never leaves two labels closer together than the stride", () => {
    // The regression. 39 monthly buckets used to pick 36 *and* 38, and
    // `أغسطس 2026` printed on top of `يونيو 2026`.
    for (const count of [13, 23, 31, 37, 39, 55, 90, 91]) {
      const picked = indices(count);
      const stride = Math.max(1, Math.ceil(count / 7));
      for (let i = 1; i < picked.length; i += 1) {
        const gap = (picked[i] ?? 0) - (picked[i - 1] ?? 0);
        expect(gap).toBeGreaterThanOrEqual(stride);
      }
    }
  });

  it("keeps the count near the requested maximum", () => {
    // Dropping the crowded label must not thin the axis down to two.
    expect(indices(39).length).toBeGreaterThanOrEqual(5);
    expect(indices(90).length).toBeLessThanOrEqual(8);
  });

  it("returns nothing for an empty series rather than a label at -1", () => {
    expect(indices(0)).toEqual([]);
  });

  it("labels a lone bucket once", () => {
    expect(indices(1)).toEqual([0]);
  });

  it("passes the index through to the formatter", () => {
    expect(thinLabels(3, at)).toEqual([
      { index: 0, label: "L0" },
      { index: 1, label: "L1" },
      { index: 2, label: "L2" },
    ]);
  });
});
