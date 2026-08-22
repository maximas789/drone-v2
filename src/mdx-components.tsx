import { useTranslations } from "next-intl";
import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Callout } from "@/components/docs/callout";
import { Quotation } from "@/components/landing/quotation";
import { SourceList } from "@/components/landing/source-list";
import { ProposalNotice } from "@/components/proposal-notice";
import { Link } from "@/i18n/navigation";
import { headingSlug, textOf } from "@/lib/docs/slugs";

/**
 * How a markdown element becomes a piece of this app.
 *
 * Required by `@next/mdx` and, for six documentation pages, it is also the
 * whole styling layer: there is no typography plugin here. Two reasons, and
 * both are about Arabic. A prose plugin ships its own `letter-spacing` on
 * headings, which severs Arabic letter joins — the defect ESLint rule 4 exists
 * to catch and cannot see inside somebody else's stylesheet. And it styles
 * lists and blockquotes with physical margins, which is rule 1 again from a
 * place no lint rule of ours reaches. Twenty lines of mapping avoid both.
 *
 * **Two elements do real work rather than just carrying classes:**
 *
 * - `a` routes every internal href through `@/i18n/navigation`'s `Link`. A bare
 *   `<a href="/docs/remote-id">` drops the locale prefix, so an Arabic reader
 *   following a link inside an Arabic page lands in English — and the ESLint
 *   rule that normally catches this cannot see a markdown link at all, because
 *   in the `.mdx` file it is `[نص](/docs/remote-id)` and not an import.
 * - `code` is isolated `dir="ltr"`. Every code-like value in these pages is a
 *   Latin run — a Remote ID like `AJN-7Q4M-31KD`, a mobile number, a URL — and
 *   inside Arabic prose the bidi algorithm reorders the neutral characters
 *   around it, so a hyphenated code arrives with its groups in the wrong order.
 *   The `dir` attribute isolates as well as directs, which is what makes this
 *   safe here and is **not** the same as putting `dir="ltr"` on a container
 *   with Arabic text inside it.
 *
 * `h1` is deliberately unmapped: the page renders the title from `meta`, so an
 * `#` heading in a content file would be a second, competing title.
 */

function Heading({
  level,
  children,
  id: explicitId,
  ...props
}: { level: 2 | 3 } & ComponentPropsWithoutRef<"h2">) {
  const t = useTranslations("docs");
  const heading = textOf(children);
  /**
   * An explicit id overrides the derived one — see `DOC_ANCHORS`. A `##` in
   * markdown cannot carry a prop, so a section the **app** links into is
   * written as `<H2 id="…">` instead: the derived slug is a function of the
   * heading's text and therefore differs between `ar` and `en`, and a component
   * in the app has one `href` to give.
   */
  const id = explicitId ?? headingSlug(heading);
  const Tag = level === 2 ? "h2" : "h3";
  const size = level === 2 ? "text-2xl font-semibold" : "text-lg font-medium";

  return (
    <Tag id={id} className={`group scroll-mt-24 ${size} text-balance`} {...props}>
      {children}
      {/**
       * The copyable link. Visible on hover and on keyboard focus, never
       * hidden from a screen reader — `aria-hidden` here would remove the only
       * way a non-mouse reader can get a link to a section.
       *
       * Clicking it puts the fragment in the address bar, which is what makes
       * it copyable; there is no clipboard call, because a button that silently
       * copies gives no way to see what it copied.
       *
       * The name is an `aria-label` and the `#` is hidden, rather than the `#`
       * plus an `sr-only` copy of the heading: that arrangement made a screen
       * reader announce the heading text twice in a row, once as the heading
       * and again as the link inside it.
       */}
      <a
        href={`#${id}`}
        aria-label={t("headingAnchor", { heading })}
        className="text-muted-foreground ms-2 text-sm opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <span aria-hidden>#</span>
      </a>
    </Tag>
  );
}

function Anchor({ href = "", children, ...props }: ComponentPropsWithoutRef<"a">) {
  const className = "text-primary underline underline-offset-4";

  // An in-page fragment. Never locale-prefixed — it is this page.
  if (href.startsWith("#")) {
    return (
      <a href={href} className={className} {...props}>
        {children}
      </a>
    );
  }

  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className} {...props}>
        {children}
      </Link>
    );
  }

  /**
   * `noopener` because it opens a new tab; `noreferrer` because a regulator's
   * server log has no business learning which page of ours the reader came
   * from — the same call `/remote-id` made for the same links.
   */
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      {...props}
    >
      {children}
    </a>
  );
}

const components: MDXComponents = {
  a: Anchor,
  h2: (props) => <Heading level={2} {...props} />,
  h3: (props) => <Heading level={3} {...props} />,
  /** `<H2 id="…">` — a heading with a stable, language-independent anchor. */
  H2: (props: ComponentPropsWithoutRef<"h2">) => <Heading level={2} {...props} />,
  p: (props) => <p className="text-muted-foreground leading-7" {...props} />,
  ul: (props) => (
    <ul
      className="text-muted-foreground flex list-disc flex-col gap-2 ps-6 leading-7"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="text-muted-foreground flex list-decimal flex-col gap-2 ps-6 leading-7"
      {...props}
    />
  ),
  li: (props) => <li className="ps-1" {...props} />,
  strong: (props) => <strong className="text-foreground font-medium" {...props} />,
  hr: () => <hr className="border-border" />,
  code: (props) => (
    <code
      dir="ltr"
      className="bg-muted rounded px-1.5 py-0.5 font-mono text-[0.9em]"
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote
      className="text-muted-foreground border-s-2 ps-4 text-sm italic"
      {...props}
    />
  ),
  /**
   * A table is the one element here that can be wider than a phone. It scrolls
   * inside its own box rather than making the page scroll sideways, which under
   * RTL is the failure that hides the start of every line.
   */
  table: (props: { children?: ReactNode }) => (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-start text-sm" {...props} />
    </div>
  ),
  th: (props) => (
    <th className="border-b p-2 text-start font-medium align-top" {...props} />
  ),
  td: (props) => (
    <td className="text-muted-foreground border-b p-2 text-start align-top" {...props} />
  ),

  // Available inside every page without an import.
  Callout,
  Quotation,
  SourceList,
  ProposalNotice,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
