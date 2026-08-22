/**
 * The pictures the documentation is allowed to show, with the dimensions read
 * off the files themselves.
 *
 * **Pure, and the dimensions are here rather than in each call site.** `Image`
 * needs an intrinsic width and height for a file served out of `public/`, and a
 * number typed into an `.mdx` by hand is a number that is wrong the first time
 * a screenshot is retaken slightly differently — which reserves the wrong space
 * and shifts the page as it loads. One table, checked by a test that reads the
 * PNG headers, means a recapture cannot silently disagree with the layout.
 *
 * **Every entry is a real capture of the real UI**, taken in Arabic against a
 * production serve. There are deliberately only five, and three surfaces that a
 * reader might expect are deliberately absent:
 *
 * - **No admin screen.** Every review surface shows a pilot's name, city and
 *   history, and these pages are public forever.
 * - **No public scan page.** The only browser that could capture it is signed
 *   in as the aircraft's owner, so the picture would show more than the
 *   "what a stranger sees" caption claims. `docs/remote-id` has a table
 *   instead, which is more precise than the picture would have been.
 * - **No aircraft list or booking drone step.** The demo aircraft are named
 *   `PROBE18B …` — probe fixtures, and not something to put in front of a
 *   reader.
 */

export type Screenshot = {
  /** Under `public/docs/screenshots/`. */
  file: string;
  width: number;
  height: number;
};

export const SCREENSHOTS = {
  registrationStepType: {
    file: "ar-registration-step-type.png",
    width: 1138,
    height: 1046,
  },
  registrationStepSpecs: {
    file: "ar-registration-step-specs.png",
    width: 1120,
    height: 640,
  },
  bookingSlots: { file: "ar-booking-slots.png", width: 1120, height: 550 },
  zonesMap: { file: "ar-zones-map.png", width: 1327, height: 896 },
  airspaceDecision: {
    file: "ar-airspace-decision.png",
    width: 1568,
    height: 388,
  },
} as const satisfies Record<string, Screenshot>;

export type ScreenshotName = keyof typeof SCREENSHOTS;

export function screenshotSrc(name: ScreenshotName): string {
  return `/docs/screenshots/${SCREENSHOTS[name].file}`;
}
