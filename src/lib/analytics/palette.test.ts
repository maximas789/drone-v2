import { describe, expect, it } from "vitest";
import {
  BUILD_TYPES,
  BUILD_TYPE_SLOT,
  RESOLVERS,
  RESOLVER_SLOT,
  SEQUENTIAL,
  SLOT,
  SOLO,
  STATUS,
  sequentialScale,
  sequentialStep,
  sequentialStepMax,
  sequentialSteps,
} from "./palette";

/**
 * The palette's *rules*, pinned. The colours themselves were validated with the
 * `dataviz` validator (lightness band, chroma floor, protanopia/deuteranopia
 * separation, contrast against both of this app's surfaces) and live in
 * `globals.css`; what a test can hold is the assignment discipline around them,
 * which is what an acceptance criterion actually names.
 */

describe("categorical assignment", () => {
  it("gives self_built slot 2, on every chart that shows a build type", () => {
    // The acceptance criterion, as a test: "one shared categorical palette —
    // self_built is the same colour in every chart".
    expect(BUILD_TYPE_SLOT.self_built).toBe(SLOT[2]);
  });

  it("assigns build types in the enum's order, never by prominence", () => {
    // A stack whose segments reorder between two columns is unreadable, and
    // sorting by value would do exactly that.
    expect(BUILD_TYPES).toEqual(["commercial", "self_built", "fpv"]);
    expect(BUILD_TYPE_SLOT.commercial).toBe(SLOT[1]);
    expect(BUILD_TYPE_SLOT.fpv).toBe(SLOT[3]);
  });

  it("never lets one colour carry two meanings on the page", () => {
    const inks = [
      ...BUILD_TYPES.map((type) => BUILD_TYPE_SLOT[type].fill),
      ...RESOLVERS.map((side) => RESOLVER_SLOT[side].fill),
      SOLO.fill,
      STATUS.good.fill,
      STATUS.critical.fill,
    ];
    expect(new Set(inks).size).toBe(inks.length);
  });

  it("keeps status out of the categorical slots", () => {
    // A status colour must never be able to impersonate a series.
    const slots = Object.values(SLOT).map((ink) => ink.fill);
    expect(slots).not.toContain(STATUS.good.fill);
    expect(slots).not.toContain(STATUS.critical.fill);
    // And a single-series chart wears `primary`, which is not a slot at all.
    expect(slots).not.toContain(SOLO.fill);
  });

  it("names every utility as a whole literal string", () => {
    // A composed name like `fill-chart-${n}` produces no CSS at all and fails
    // silently — the same class of trap as ZONE_FILL's CSS variables.
    const every = [
      ...Object.values(SLOT),
      SOLO,
      STATUS.good,
      STATUS.critical,
    ].flatMap((ink) => [ink.fill, ink.stroke, ink.text, ink.bg]);
    for (const utility of every) {
      expect(utility).toMatch(/^(fill|stroke|text|bg)-[a-z0-9-]+$/);
    }
  });
});

describe("the sequential ramp", () => {
  it("treats zero as absent, not as the lowest step", () => {
    expect(sequentialStep(0, 10)).toBeNull();
    // And an entirely empty grid has no scale at all.
    expect(sequentialStep(1, 0)).toBeNull();
  });

  it("puts the maximum on the darkest step", () => {
    for (const max of [1, 2, 5, 6, 7, 40]) {
      expect(sequentialStep(max, max)).toBe(SEQUENTIAL.length - 1);
    }
  });

  it("uses no more steps than there are values to tell apart", () => {
    // Six shades over a maximum of one is six shades that all mean "1", and
    // the legend printed that number six times.
    expect(sequentialSteps(1)).toBe(1);
    expect(sequentialSteps(3)).toBe(3);
    expect(sequentialSteps(50)).toBe(SEQUENTIAL.length);
    expect(sequentialScale(1)).toEqual([SEQUENTIAL.length - 1]);
    expect(sequentialScale(50).length).toBe(SEQUENTIAL.length);
  });

  it("never returns a step outside the ramp", () => {
    for (const max of [1, 2, 3, 6, 9, 100]) {
      for (let value = 1; value <= max; value += 1) {
        const step = sequentialStep(value, max);
        expect(step).not.toBeNull();
        expect(step).toBeGreaterThanOrEqual(0);
        expect(step).toBeLessThan(SEQUENTIAL.length);
      }
    }
  });

  it("rises with the value and never falls", () => {
    let previous = -1;
    for (let value = 1; value <= 40; value += 1) {
      const step = sequentialStep(value, 40) ?? -1;
      expect(step).toBeGreaterThanOrEqual(previous);
      previous = step;
    }
  });

  it("gives the legend a bound that matches where a value lands", () => {
    // Every value must fall at or below the bound printed beside its own shade.
    for (const max of [1, 4, 7, 23]) {
      for (let value = 1; value <= max; value += 1) {
        const step = sequentialStep(value, max);
        expect(step).not.toBeNull();
        expect(sequentialStepMax(step as number, max)).toBeGreaterThanOrEqual(
          value,
        );
      }
      expect(sequentialStepMax(SEQUENTIAL.length - 1, max)).toBe(max);
    }
  });
});
