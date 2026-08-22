import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A **native checkbox**, sized up and given the app's accent colour.
 *
 * The same call `Select` and `Slider` made — use the platform's control — and
 * this one was arrived at the hard way, so the reasoning is worth keeping.
 *
 * **Three attempts at a custom sliding switch all failed silently.** A switch
 * is a track with a knob that travels to the end of the inline direction, which
 * in Arabic is leftward. Positioning that knob needs something the layout
 * engine derives, and each attempt produced a control whose *colour* changed on
 * toggle — `checked:` on the input works fine — while the knob sat still:
 *
 * - `peer-checked:ltr:translate-x-4` with an `rtl:` mirror: the stacked variant
 *   generated a rule that never matched.
 * - `peer-checked:start-[1.125rem]`: the rule generated and matched, and
 *   resolved to the same used value in both states.
 * - An inline `insetInlineStart` computed from the `checked` prop: the style
 *   attribute updated on every toggle, and the knob's `getBoundingClientRect()`
 *   never moved.
 *
 * None of the three failed a build, a lint, a type-check or a test, and none is
 * visible in a screenshot of a switch that happens to be on. All three were
 * caught by measuring the knob in both states — the same instrument that caught
 * the analytics axis anchors, and for the same reason: **an RTL layout bug is a
 * geometry question, and only geometry answers it.**
 *
 * So the knob is gone. A checkbox is a completely adequate control for "email
 * on or off", the browser draws it correctly under `dir="rtl"` with no work
 * from us, and `accent-color` tints it from the same token the rest of the app
 * uses. There is no geometry left here to get backwards.
 *
 * `role="switch"` is deliberately **not** set: it would announce a switch to a
 * screen reader while showing a checkbox to everybody else, and the two would
 * disagree about what the control is.
 */
function Switch({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      data-slot="switch"
      className={cn(
        "accent-primary size-4 shrink-0 cursor-pointer outline-none",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Switch };
