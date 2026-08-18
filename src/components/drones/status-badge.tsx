import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

/**
 * A registration status, as one badge.
 *
 * The status is a **stable code** translated at render, never stored as text —
 * a registration decided today has to read correctly to a regulator opening it
 * years later in the other language.
 *
 * The variant mapping is here so that "what colour is rejected" is answered in
 * one place; F18b's detail page and F22's queue render the same badge rather
 * than each choosing their own tint.
 */

const VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> =
  {
    draft: "outline",
    pending: "secondary",
    approved: "default",
    rejected: "destructive",
    expired: "outline",
    revoked: "destructive",
  };

const LABEL: Record<string, string> = {
  draft: "statusDraft",
  pending: "statusPending",
  approved: "statusApproved",
  rejected: "statusRejected",
  expired: "statusExpired",
  revoked: "statusRevoked",
};

export function DroneStatusBadge({ status }: { status: string }) {
  const t = useTranslations("drones");
  const key = LABEL[status];
  // An unknown status renders the raw code rather than nothing: a badge that
  // silently disappears hides a row whose state nobody understands.
  if (!key) return <Badge variant="outline">{status}</Badge>;
  return <Badge variant={VARIANT[status] ?? "outline"}>{t(key)}</Badge>;
}
