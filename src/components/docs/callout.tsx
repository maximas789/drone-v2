import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * The three asides a documentation page is allowed to make.
 *
 * **A callout is a claim about how important something is**, so the set is
 * closed and each member has a job:
 *
 * - `note` — a detail that is easy to miss and costs nothing to know.
 * - `warning` — something that will refuse, expire, or cannot be undone. The
 *   only one that gets the destructive colour, because a page where everything
 *   is urgent has nothing urgent on it.
 * - `source` — where a regulatory claim comes from. The honesty rule bans
 *   borrowed authority, and this is the box that says which sentences on the
 *   page are the regulator's and which are ours.
 *
 * `border-s-4` and `ps-*`, never `border-l-4`: the stripe belongs on the side
 * the reader starts from, which is the right in Arabic.
 */

const KINDS = {
  note: {
    label: "calloutNote",
    className: "border-primary/40 bg-muted/40",
  },
  warning: {
    label: "calloutWarning",
    className: "border-destructive/60 bg-destructive/5",
  },
  source: {
    label: "calloutSource",
    className: "border-muted-foreground/40 bg-muted/30",
  },
} as const;

export type CalloutKind = keyof typeof KINDS;

export function Callout({
  kind = "note",
  children,
}: {
  kind?: CalloutKind;
  children: ReactNode;
}) {
  const t = useTranslations("docs");
  const { label, className } = KINDS[kind];

  return (
    <aside
      role="note"
      className={`flex flex-col gap-1 rounded-e-lg border-s-4 p-4 ${className}`}
    >
      <p className="text-sm font-medium">{t(label)}</p>
      <div className="text-muted-foreground flex flex-col gap-2 text-sm">
        {children}
      </div>
    </aside>
  );
}
