import { describe, expect, it } from "vitest";
import { anchorAtMaxX, anchorAtMinX } from "./layout";
import {
  areaPath,
  axisMax,
  bandScale,
  linePath,
  linearScale,
  niceTicks,
  pointScale,
  stackMax,
  stackRow,
} from "./scale";

/**
 * The chart geometry is arithmetic, and arithmetic is the one part of a chart
 * that can be checked without opening a browser. Everything a *screenshot*
 * would have to catch — collisions, overflow, whether a label is readable — is
 * verified on the page instead; these are the cases where being wrong produces
 * a chart that looks perfectly fine and says the wrong thing.
 */

describe("linearScale", () => {
  it("maps a count domain onto a downward y axis", () => {
    const y = linearScale(0, 10, 100, 0);
    expect(y(0)).toBe(100);
    expect(y(10)).toBe(0);
    expect(y(5)).toBe(50);
  });

  it("collapses a flat domain to the range floor instead of dividing by zero", () => {
    // Every bucket zero is the ordinary case on a new deployment. NaN here
    // would render an <svg> with no marks at all and no error anywhere.
    const y = linearScale(0, 0, 100, 0);
    expect(y(0)).toBe(100);
    expect(Number.isNaN(y(1))).toBe(false);
  });
});

describe("niceTicks", () => {
  it("always starts at zero", () => {
    // A count axis that starts anywhere else exaggerates the change.
    expect(niceTicks(37)[0]).toBe(0);
    expect(niceTicks(1000)[0]).toBe(0);
  });

  it("snaps the step to 1, 2, 5 or 10 times a power of ten", () => {
    expect(niceTicks(10)).toEqual([0, 5, 10]);
    expect(niceTicks(37)).toEqual([0, 10, 20, 30, 40]);
    expect(niceTicks(4)).toEqual([0, 1, 2, 3, 4]);
  });

  it("never offers to measure half an aircraft", () => {
    // Every axis on this page counts things. Before the floor on the step, a
    // maximum of 1 — the ordinary case on a young deployment — produced ticks
    // at 0, 0.5 and 1.
    for (const max of [1, 2, 3, 4, 5, 7, 11]) {
      for (const tick of niceTicks(max)) {
        expect(Number.isInteger(tick)).toBe(true);
      }
    }
  });

  it("puts the axis maximum on the last tick, so nothing floats above the grid", () => {
    for (const max of [1, 3, 7, 12, 49, 137, 1001]) {
      expect(axisMax(max)).toBeGreaterThanOrEqual(max);
      const ticks = niceTicks(max);
      expect(ticks[ticks.length - 1]).toBe(axisMax(max));
    }
  });

  it("gives an empty series an axis to hang its empty state on", () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(-3)).toEqual([0, 1]);
  });

  it("does not print floating-point noise on the axis", () => {
    for (const tick of niceTicks(1)) {
      expect(String(tick)).not.toMatch(/\d{6,}/);
    }
  });
});

describe("bandScale", () => {
  it("centres each band inside its step", () => {
    const band = bandScale(4, 400, 0.2);
    expect(band.step).toBe(100);
    expect(band.width).toBe(80);
    expect(band.at(0)).toBe(10);
    expect(band.centre(0)).toBe(50);
    expect(band.centre(3)).toBe(350);
  });

  it("inverts a pixel offset back to the band under it", () => {
    // The hover layer is a client component and the marks are drawn on the
    // server. Both call this; a second implementation would drift and put the
    // tooltip on the neighbouring column.
    const band = bandScale(4, 400);
    expect(band.indexAt(0)).toBe(0);
    expect(band.indexAt(99)).toBe(0);
    expect(band.indexAt(101)).toBe(1);
    expect(band.indexAt(399)).toBe(3);
  });

  it("clamps an offset outside the plot rather than returning -1 or 4", () => {
    const band = bandScale(4, 400);
    expect(band.indexAt(-50)).toBe(0);
    expect(band.indexAt(9999)).toBe(3);
  });

  it("survives an empty series", () => {
    const band = bandScale(0, 400);
    expect(Number.isFinite(band.step)).toBe(true);
    expect(band.indexAt(200)).toBe(0);
  });
});

describe("pointScale", () => {
  it("puts the first and last vertices on the plot edges", () => {
    const points = pointScale(5, 400);
    expect(points.at(0)).toBe(0);
    expect(points.at(4)).toBe(400);
  });

  it("centres a lone point instead of drawing it on the left edge", () => {
    const points = pointScale(1, 400);
    expect(points.at(0)).toBe(200);
    expect(points.indexAt(400)).toBe(0);
  });

  it("snaps to the nearest vertex, not the one before it", () => {
    const points = pointScale(5, 400);
    expect(points.indexAt(51)).toBe(1);
    expect(points.indexAt(49)).toBe(0);
  });
});

describe("paths", () => {
  it("returns an empty string for no points rather than a bare M", () => {
    expect(linePath([])).toBe("");
    expect(areaPath([], [])).toBe("");
  });

  it("draws a polyline", () => {
    expect(
      linePath([
        { x: 0, y: 10 },
        { x: 5, y: 20 },
      ]),
    ).toBe("M0 10 L5 20");
  });

  it("walks the lower edge backwards so a stacked band does not self-cross", () => {
    const path = areaPath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      [
        { x: 0, y: 20 },
        { x: 10, y: 20 },
      ],
    );
    expect(path).toBe("M0 0 L10 0 L10 20 L0 20 Z");
  });

  it("rounds coordinates so the RSC payload does not carry 17 digits a vertex", () => {
    expect(linePath([{ x: 1 / 3, y: 2 / 3 }])).toBe("M0.33 0.67");
  });
});

describe("stacking", () => {
  it("accumulates in the order given and never sorts", () => {
    expect(stackRow([1, 2, 3])).toEqual([1, 3, 6]);
    expect(stackRow([3, 2, 1])).toEqual([3, 5, 6]);
  });

  it("takes the tallest column as the domain maximum", () => {
    expect(
      stackMax([
        [1, 2],
        [4, 4],
        [0, 0],
      ]),
    ).toBe(8);
  });

  it("reports zero for an entirely empty stack", () => {
    expect(stackMax([[0, 0, 0]])).toBe(0);
    expect(stackMax([])).toBe(0);
  });
});

describe("text anchoring under RTL", () => {
  it("swaps the anchor so it means a geometric edge", () => {
    // SVG's text-anchor is relative to the inline base direction. On an Arabic
    // page `end` anchors the LEFT edge, which put every y-axis tick inside the
    // plot area with every check green.
    expect(anchorAtMaxX(false)).toBe("end");
    expect(anchorAtMaxX(true)).toBe("start");
    expect(anchorAtMinX(false)).toBe("start");
    expect(anchorAtMinX(true)).toBe("end");
  });

  it("never returns the same value for both edges in one direction", () => {
    for (const rtl of [true, false]) {
      expect(anchorAtMinX(rtl)).not.toBe(anchorAtMaxX(rtl));
    }
  });
});
