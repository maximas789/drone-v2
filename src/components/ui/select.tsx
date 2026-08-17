import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A **native** `<select>`, styled from the same tokens as `Input`.
 *
 * Not a listbox built out of divs, and not a new dependency. Three reasons, in
 * the order they matter here:
 *
 * 1. **RTL.** The browser lays out and opens a native select correctly under
 *    `dir="rtl"` — including the drop indicator's side — with no work from us.
 *    A custom popover is where that goes wrong, and it goes wrong only in
 *    Arabic, which is the language nobody testing in English would notice.
 * 2. **Mobile.** On a phone this is the platform's own wheel or sheet, which is
 *    a far better control than anything we would build, and F17's form has to
 *    work at 375 px.
 * 3. **Accessibility.** Keyboard, type-ahead and the accessible name come for
 *    free and cannot regress.
 *
 * `appearance-none` is deliberately **not** set: the native indicator is the
 * affordance that says "this opens".
 */
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
