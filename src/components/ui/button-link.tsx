import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * A link that looks like a button.
 *
 * **Not** `<Button render={<Link />}>`. Base UI's `Button` expects to render a
 * real `<button>`; handed anything else it logs a console error, and the
 * escape hatch it names — `nativeButton={false}` — puts `role="button"` on the
 * element. On an `<a href>` that is worse than the warning: a screen reader
 * then announces a navigation control as a button, and the reader loses every
 * link affordance the browser gives them.
 *
 * So the anchor stays an anchor and only borrows the styling. `buttonVariants`
 * is the same source the real button is built from, so the two cannot drift.
 */
export function ButtonLink({
  className,
  variant = "default",
  size = "default",
  ...props
}: ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return (
    <Link
      data-slot="button-link"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
