import {
  REMOTE_ID_QUOTES,
  REMOTE_ID_SOURCES,
  type Quote,
} from "@/lib/landing/sources";

const QUOTES_BY_ID = new Map<string, Quote>(
  REMOTE_ID_QUOTES.map((quote) => [quote.id, quote]),
);

/**
 * A verbatim passage from a regulation, in the document's own language and
 * direction.
 *
 * **`dir="ltr"` on the quotation itself, always.** Every source cited here is
 * written in English; dropping English legal text into an RTL paragraph makes
 * the bidi algorithm reorder its punctuation and section numbers, so
 * `§ 107.302(b)` arrives as `(b)107.302 §` and the quotation stops being a
 * quotation. The gloss around it is translated; the words inside the marks are
 * not.
 *
 * **Lifted out of `/remote-id`'s page for F26**, which quotes the same
 * documents in `docs/remote-id`. Two components rendering the same regulator's
 * words with their own markup is the drift that ends with one of them quietly
 * losing its `dir` — on the two pages whose entire argument is what the
 * documents actually say.
 */
export function Quotation({ id }: { id: string }) {
  const quote = QUOTES_BY_ID.get(id);
  // A missing quote is a programming error, not a runtime state to render.
  if (!quote) throw new Error(`Unknown remote-id quote: ${id}`);

  const source = REMOTE_ID_SOURCES.find((item) => item.id === quote.sourceId);
  if (!source) throw new Error(`Quote ${id} cites an unknown source`);

  return (
    <figure className="border-primary/40 bg-muted/40 flex flex-col gap-2 rounded-e-lg border-s-4 p-4">
      <blockquote dir="ltr" cite={source.url} className="text-start text-sm">
        {`“${quote.text}”`}
      </blockquote>
      <figcaption
        dir="ltr"
        className="text-muted-foreground text-start font-mono text-xs"
      >
        {quote.cite}
      </figcaption>
    </figure>
  );
}
