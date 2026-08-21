import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

/**
 * *"This is a proposal, not an official system adopted by GACA."*
 *
 * The one sentence the whole product is obliged to keep saying, on every
 * surface that could otherwise be mistaken for a regulator's own. Its wording
 * lives in `common.proposalNotice`; **this component exists because its
 * rendering was quietly broken on all ten screens that showed it.**
 *
 * `Badge` is `h-5 overflow-hidden whitespace-nowrap` — a pill sized for one
 * short word. Every call site added `whitespace-normal` to let the sentence
 * wrap, which it does; the fixed height and the `overflow-hidden` then clip the
 * second line away. On a desktop the sentence fits on one line and nothing
 * looks wrong, so **it only failed below about 640 px** — a phone, which is
 * exactly where a field inspector opens `/rid/[code]`. Found by rendering
 * `/admin/lookup` in a 375 px frame during F24; `lint`, `typecheck`, `build`
 * and 894 tests were all green, thread 11 again.
 *
 * `h-auto` with real vertical padding is the fix, and it lives here rather than
 * in ten `className` strings so the eleventh screen cannot get it wrong.
 */
export function ProposalNotice({ className = "" }: { className?: string }) {
  const t = useTranslations("common");

  return (
    <Badge
      variant="secondary"
      className={`h-auto whitespace-normal py-1 text-start ${className}`}
    >
      {t("proposalNotice")}
    </Badge>
  );
}
