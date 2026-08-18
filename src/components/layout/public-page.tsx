import type { ReactNode } from "react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/**
 * The frame the three concept pages share.
 *
 * **Still not a `layout.tsx`**, and for the same reason F16a gave: a route
 * layout would push this marketing frame onto the auth pages under
 * `(public)/(auth)` and onto F11's scan page, which is a field inspector's
 * surface rather than a shop window. This is a component the pages choose,
 * which is a different thing from a frame they cannot escape.
 *
 * The landing page composes `SiteHeader` and `SiteFooter` itself rather than
 * using this, because its `<main>` is a full-bleed sequence of sections with
 * its own spacing. This is the narrower measure that prose wants.
 */
export function PublicPage({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader signedIn={signedIn} />

      {/**
       * `max-w-6xl` to match the header and the footer, with the reading
       * measure set by an inner `max-w-3xl` that is deliberately **not**
       * centred. Constraining the `<main>` itself centred the prose while the
       * wordmark and the sign-in button stayed out at the wider edge, so the
       * page's start margin moved between the chrome and the content — obvious
       * at 1440 px, and in RTL it is the *right* edge that drifts, which is the
       * one the eye follows down the page.
       */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex max-w-3xl flex-col gap-10">{children}</div>
      </main>

      <SiteFooter />
    </div>
  );
}

/**
 * A titled block of prose. Every concept page is a stack of these, so the
 * heading level, the measure and the gap are decided once.
 */
export function Section({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold text-balance">{title}</h2>
      {lead ? <p className="text-muted-foreground">{lead}</p> : null}
      {children}
    </section>
  );
}
