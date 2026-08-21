"use client";

import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/remote-id/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { pick } from "@/lib/i18n-content";
import type { Locale } from "@/lib/locale";
import type { LookupCandidate } from "@/lib/lookup/search";

/**
 * Several registrations matched. Which one is in front of you?
 *
 * **No owner identity, and that is the whole point of this screen.** A
 * four-symbol fragment read off a moving aircraft is not evidence about a
 * person; it is a shortlist of airframes. Showing six names here would make a
 * half-remembered code into a way to browse the register, so a candidate
 * carries make, model, city and status — enough to tell airframes apart — and
 * identity arrives only when one is **opened**, through the redactor, with the
 * open itself written to the audit trail.
 *
 * Opening is a button rather than a link because it is a POST: a code in a URL
 * is a code in the browser history and the server's access log, and at this
 * point the officer has not yet decided which aircraft they are asking about.
 */
export function DisambiguationList({
  candidates,
  onOpen,
  disabled = false,
  locale,
}: {
  candidates: readonly LookupCandidate[];
  onOpen: (code: string) => void;
  disabled?: boolean;
  locale: Locale;
}) {
  const t = useTranslations("lookup");
  const tDrones = useTranslations("drones");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">{t("candidatesTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("candidatesIntro")}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {candidates.map((candidate) => (
          <li
            key={candidate.remoteIdId}
            className="border-border flex flex-col gap-3 rounded-lg border p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                dir="ltr"
                className="font-mono text-lg font-semibold ltr:tracking-wide"
              >
                {candidate.code}
              </span>
              <StatusBadge status={candidate.registrationStatus} />
            </div>

            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              <Fact
                label={tDrones("manufacturer")}
                /*
                  A self-built airframe has neither make nor model — that
                  nullability is the product. The build-type badge below is what
                  tells them apart instead of two empty cells.
                */
                value={candidate.manufacturer}
              />
              <Fact label={tDrones("model")} value={candidate.model} />
              <Fact
                label={t("candidateCity")}
                value={
                  candidate.cityNameAr
                    ? pick(
                        {
                          ar: candidate.cityNameAr,
                          en: candidate.cityNameEn ?? candidate.cityNameAr,
                        },
                        locale,
                      )
                    : null
                }
              />
            </dl>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {tDrones(`buildTypes.${candidate.buildType}`)}
              </Badge>
              <Badge variant="outline">
                {tDrones(`weightClasses.${candidate.weightClass}`)}
              </Badge>
            </div>

            <Button
              type="button"
              variant="outline"
              className="min-h-12 w-full sm:w-fit"
              disabled={disabled}
              onClick={() => onOpen(candidate.code)}
            >
              {t("candidateOpen")}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      {/* A dash rather than nothing: an empty cell in a comparison list reads
          as a rendering fault, where "—" reads as "this one has none". */}
      <dd className="font-medium">{value ?? "—"}</dd>
    </div>
  );
}
