import type { ReactNode } from "react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/**
 * The frame a documentation page wears: the public chrome, plus a column for
 * the page list.
 *
 * **Not `PublicPage`, and not a `layout.tsx`.** `PublicPage` is a single
 * reading column, which is right for the concept pages and cannot hold a
 * sidebar. A route layout could — but the sidebar has to know which page is
 * being read, and a layout does not; the only way to tell it would be a client
 * component reading the pathname, which is a bundle and a hydration boundary
 * bought for a `<ul>`. So this is a component the pages choose, the same call
 * `PublicPage` made and for a related reason.
 *
 * The grid collapses to one column below `md`, where `DocsSidebar` has already
 * swapped its list for a select — so the aside is a control at the top of the
 * page rather than a column beside it.
 */
export function DocsShell({
  signedIn,
  aside,
  children,
}: {
  signedIn: boolean;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader signedIn={signedIn} />

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-4 py-10 sm:px-6 sm:py-14 md:grid-cols-[14rem_minmax(0,1fr)]">
        {aside ? <div className="md:order-first">{aside}</div> : null}
        {/**
         * `minmax(0, 1fr)` above, not `1fr`: a grid item's default minimum is
         * its content, so a wide table inside would push the column past the
         * viewport and make the whole page scroll sideways instead of scrolling
         * inside its own box.
         */}
        <div className="flex max-w-3xl flex-col gap-6">{children}</div>
      </main>

      <SiteFooter />
    </div>
  );
}
