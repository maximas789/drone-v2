import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A **native** `<input type="range">`, styled from the same tokens as `Input`.
 *
 * Same argument as `Select`, and it lands harder here:
 *
 * 1. **RTL.** Under `dir="rtl"` the browser reverses the track itself, so the
 *    maximum sits at the start of the reading direction where an Arabic reader
 *    expects it. A slider built out of divs and pointer maths gets this wrong in
 *    exactly one language — the app's primary one.
 * 2. **Touch.** The platform's own hit area is larger than the visible track,
 *    which is what makes a 375 px screen usable with a thumb.
 * 3. **Accessibility.** Arrow keys, Home/End, Page Up/Down, and the
 *    `aria-valuenow`/`aria-valuetext` announcement come for free. A custom
 *    control has to re-earn all four and usually earns three.
 *
 * `aria-valuetext` is the caller's job: a screen reader announcing "120" for an
 * altitude is announcing a number, not a height. Pass the formatted string.
 */
function Slider({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="range"
      data-slot="slider"
      className={cn(
        "h-8 w-full cursor-pointer appearance-none bg-transparent outline-none",
        // The track and the thumb have to be styled per engine; there is no
        // cross-browser shorthand, and omitting either leaves the platform
        // default, which does not follow the theme into dark mode.
        "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-input",
        "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-input",
        "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:-mt-[0.3125rem] [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary",
        "[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary",
        "focus-visible:[&::-webkit-slider-thumb]:ring-3 focus-visible:[&::-webkit-slider-thumb]:ring-ring/50",
        "focus-visible:[&::-moz-range-thumb]:ring-3 focus-visible:[&::-moz-range-thumb]:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Slider };
