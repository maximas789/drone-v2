"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { RegistrationStatus } from "@/lib/remote-id/redact";

/**
 * The one thing a field inspector reads first.
 *
 * The status arrives as a **code** and is translated here — never as text from
 * the server — so the same scan reads correctly in either language, including
 * for the second person the phone is handed to.
 */

const VARIANT: Record<
  RegistrationStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  expired: "outline",
  // Both are "this aircraft should not be flying", and both look like it.
  suspended: "destructive",
  revoked: "destructive",
  /**
   * **Not destructive.** Nobody did anything wrong: the owner closed their
   * account. It is still "do not fly this", which is why it is not `default`
   * either — the same weight as `unregistered`, which is the same situation
   * from the other end.
   */
  withdrawn: "secondary",
  unregistered: "secondary",
};

const LABEL = {
  active: "statusActive",
  expired: "statusExpired",
  suspended: "statusSuspended",
  revoked: "statusRevoked",
  withdrawn: "statusWithdrawn",
  unregistered: "statusUnregistered",
} as const;

// Written out rather than built as `${LABEL[status]}Body`: next-intl types its
// keys, and a template literal is just `string` to it — which would take the
// checking off exactly the strings a missing translation shows up in.
const BODY = {
  active: "statusActiveBody",
  expired: "statusExpiredBody",
  suspended: "statusSuspendedBody",
  revoked: "statusRevokedBody",
  withdrawn: "statusWithdrawnBody",
  unregistered: "statusUnregisteredBody",
} as const;

export function StatusBadge({ status }: { status: RegistrationStatus }) {
  const t = useTranslations("remoteId");

  return (
    <Badge variant={VARIANT[status]} className="h-7 px-3 text-sm">
      {t(LABEL[status])}
    </Badge>
  );
}

/** The sentence under the badge. Same mapping, one key apart. */
export function StatusBody({ status }: { status: RegistrationStatus }) {
  const t = useTranslations("remoteId");
  return <p className="text-muted-foreground text-sm">{t(BODY[status])}</p>;
}
