import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * Where an identity stands, and **who decided it**.
 *
 * Three states, and the notice under all three says the same thing in plain
 * words: a person reads the document. There is no automatic check anywhere in
 * this app, no SMS, no OTP, and `pilot_profile` has no `mobileVerifiedAt` column
 * to imply one. A screen that showed a bare "Pending…" spinner would let a
 * reader assume something was being processed; this says a human has it.
 *
 * **F17 renders this; F22 writes it.** `verifiedAt` and `rejectedAt` are set by a
 * reviewer working a queue that does not exist yet, so every branch below is the
 * pilot's side of a decision made elsewhere. The rejection branch exists here
 * rather than in F22 because a pilot who was refused and cannot see why has no
 * way back in — and the way back in *is* here: correcting the identity clears
 * the rejection and re-queues the profile.
 */
export function VerificationStatus({
  verifiedAt,
  rejectedAt,
  rejectionReason,
  locale,
}: {
  verifiedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  locale: Locale;
}) {
  const t = useTranslations("profile");

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{t("verificationTitle")}</h2>
        {verifiedAt ? (
          <Badge variant="secondary">{t("verificationApproved")}</Badge>
        ) : rejectedAt ? (
          <Badge variant="destructive">{t("verificationRejected")}</Badge>
        ) : (
          <Badge variant="outline">{t("verificationPending")}</Badge>
        )}
      </div>

      {verifiedAt ? (
        <p className="text-muted-foreground text-sm">
          {/* Gregorian, Latin numerals, in both locales — `format.ts` is the only
              thing in this codebase allowed to decide that. */}
          {t("verifiedOn", { date: formatDate(verifiedAt, locale) })}
        </p>
      ) : rejectedAt ? (
        <div className="border-s-2 border-destructive flex flex-col gap-2 ps-3">
          <p className="text-sm">
            {t("rejectedOn", { date: formatDate(rejectedAt, locale) })}
          </p>
          {rejectionReason ? (
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-xs">
                {t("rejectionReasonLabel")}
              </p>
              {/* A reviewer's own words, stored as free text — the one thing on
                  this page that is not a code translated at render, because a
                  human wrote it about one specific document. */}
              <p className="text-sm">{rejectionReason}</p>
            </div>
          ) : null}
          <p className="text-muted-foreground text-sm">{t("rejectedHelp")}</p>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {t("verificationPendingHelp")}
        </p>
      )}

      <p className="text-muted-foreground text-xs">
        {t("verificationHumanNotice")}
      </p>
    </section>
  );
}
