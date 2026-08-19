import { formatDate, formatTime } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * A slot's day and time range, rendered so the bidi algorithm cannot reorder it.
 *
 * **`dir="ltr"` on the whole run is the bug, not the fix.** `19 أغسطس 2026
 * 15:00 – 17:00` inside a forced-LTR element renders as
 * `19 17:00 – 15:00 2026 أغسطس`: the Arabic month is a strong RTL run, and the
 * numbers around it are neutral, so the algorithm resolves the lot into an
 * order nobody wrote. Found by looking at the dashboard — the innerText is
 * correct in every one of these cases, so no text assertion catches it.
 *
 * `<bdi>` is the fix. It *isolates*: the date resolves in its own context and
 * the time range in another, so neither can reorder the other. The range keeps
 * `dir="ltr"` **inside its own isolate**, which is what stops `15:00 – 17:00`
 * from reading as ending before it starts.
 *
 * The element takes no `dir` of its own, so it flows with the page — which is
 * right: this is a sentence fragment in the reader's language, not a code.
 */
export function SlotTime({
  start,
  end,
  locale,
  withDate = true,
}: {
  start: Date;
  end?: Date;
  locale: Locale;
  /** Off where the day is already stated by a heading above. */
  withDate?: boolean;
}) {
  return (
    <>
      {withDate ? <bdi>{formatDate(start, locale)}</bdi> : null}
      {withDate ? " " : null}
      <bdi dir="ltr">
        {formatTime(start, locale)}
        {end ? ` – ${formatTime(end, locale)}` : null}
      </bdi>
    </>
  );
}
