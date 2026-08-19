import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

/**
 * A booking's status, as one badge.
 *
 * Same reasoning as `DroneStatusBadge`: the status is a **stable code**
 * translated at render, never stored as text, because a flight authorised
 * today has to read correctly to a regulator opening it years later in the
 * other language. The variant mapping lives here so "what colour is rejected"
 * is answered once — the list, the detail page and F22's queue all render this
 * rather than each picking a tint.
 *
 * **`no_show` is not a shade of cancelled.** A cancelled slot was given back;
 * a no-show was held and wasted. Capacity is finite, so the difference matters
 * to whoever reads the record next.
 */

const VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> =
  {
    pending: "secondary",
    approved: "default",
    rejected: "destructive",
    cancelled: "outline",
    completed: "secondary",
    no_show: "destructive",
  };

const LABEL: Record<string, string> = {
  pending: "statusPending",
  approved: "statusApproved",
  rejected: "statusRejected",
  cancelled: "statusCancelled",
  completed: "statusCompleted",
  no_show: "statusNoShow",
};

export function BookingStatusBadge({ status }: { status: string }) {
  const t = useTranslations("bookings");
  const key = LABEL[status];
  // An unknown status renders the raw code rather than nothing: a badge that
  // silently disappears hides a row whose state nobody understands.
  if (!key) return <Badge variant="outline">{status}</Badge>;
  return <Badge variant={VARIANT[status] ?? "outline"}>{t(key)}</Badge>;
}
