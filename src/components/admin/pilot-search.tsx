"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { FormProblem } from "@/components/form/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { searchPilotsAction } from "@/lib/actions/review";
import type { PilotRow, PilotSearchKind } from "@/lib/data/review";
import { formatDate, formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * The pilots directory — **a POST, and that is the whole design.**
 *
 * Every other filter in this build is a GET form, because a filtered queue that
 * is a link a reviewer can send to a colleague is worth having. This one cannot
 * be: the term may be a **national ID or an iqama number**, and a GET would put
 * it in the address bar, the browser history, the server's access log and any
 * referrer that leaves the origin. Personal data does not belong in a query
 * string, so the one search that can carry it does not use one.
 *
 * That costs the shareable link and the back button, which is the right trade
 * and is worth stating out loud rather than discovering later.
 *
 * **The number never reaches a query either.** `searchPilots` hashes a whole
 * document number and matches `idDocumentHash`, so there is no substring search
 * over identity documents anywhere in this codebase — and a *partial* document
 * search cannot be added by accident, because there is nothing to add it to.
 *
 * The screen says **how** the term was read. A mistyped ID that fell through to
 * a name match would otherwise look like "this person is not registered",
 * which is the wrong answer to act on.
 */
export function PilotSearch({
  initialRows,
  locale,
}: {
  /** The server's first page — rendered before any JavaScript runs. */
  initialRows: readonly PilotRow[];
  locale: Locale;
}) {
  const t = useTranslations("review");
  const tErrors = useTranslations("errors");
  const fieldId = useId();

  const [term, setTerm] = useState("");
  /**
   * **The answer, or nothing yet — not a copy of the server's rows.**
   *
   * The obvious version seeds `useState(initialRows)` and syncs the prop back
   * in with an effect, which `react-hooks` rejects on sight and is right to:
   * a `setState` in an effect body is a cascading render, and it would also
   * quietly overwrite a reviewer's search results every time the page
   * revalidated after a verification. Holding `null` until somebody actually
   * searches means the server's rows are simply *rendered* while there is no
   * answer, and a fresh server render updates them for free.
   */
  const [answer, setAnswer] = useState<{
    kind: PilotSearchKind;
    rows: readonly PilotRow[];
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = answer?.rows ?? initialRows;
  const kind = answer?.kind ?? "recent";

  function search() {
    startTransition(async () => {
      setMessage(null);
      const result = await searchPilotsAction(term);
      if (!result.ok) {
        const limited = result.reasons.find((r) => r.code === "rate_limited");
        setMessage(
          limited
            ? tErrors("rateLimited", {
                duration: formatSeconds(
                  Number(limited.params?.retryAfterSeconds ?? 0),
                  locale,
                ),
              })
            : tErrors("generic"),
        );
        return;
      }
      setAnswer({ kind: result.data.kind, rows: result.data.rows });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-3 rounded-lg border p-4"
        role="search"
        aria-label={t("pilotsSearchLabel")}
        onSubmit={(event) => {
          // No `action`, no navigation: the term must not reach a URL.
          event.preventDefault();
          search();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-q`}>{t("pilotsSearchLabel")}</Label>
          <Input
            id={`${fieldId}-q`}
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            maxLength={100}
            autoComplete="off"
            placeholder={t("pilotsSearchPlaceholder")}
            aria-describedby={`${fieldId}-hint`}
          />
          <p id={`${fieldId}-hint`} className="text-muted-foreground text-xs">
            {t("pilotsSearchHint")}
          </p>
        </div>

        <FormProblem>{message}</FormProblem>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? t("pilotsSearching") : t("pilotsSearch")}
          </Button>
          <span className="text-muted-foreground text-sm">
            {t(`searchKind.${kind}`)}
          </span>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {kind === "recent" ? t("pilotsNone") : t("pilotsEmpty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <caption className="sr-only">{t("pilotsTitle")}</caption>
            <thead className="bg-muted/50">
              <tr className="text-start">
                <Th>{t("colPilot")}</Th>
                <Th>{t("pilotMobile")}</Th>
                <Th>{t("pilotCity")}</Th>
                <Th>{t("colIdentity")}</Th>
                <Th>
                  <span className="sr-only">{t("openPilot")}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId} className="border-t align-top">
                  <Td>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">
                        {locale === "ar" ? row.fullNameAr : row.fullNameEn}
                      </span>
                      {row.completedAt ? null : (
                        <span className="text-muted-foreground text-xs">
                          {t("profileIncomplete")}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    {row.mobileE164 ? (
                      <span dir="ltr">{row.mobileE164}</span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    {(locale === "ar" ? row.cityNameAr : row.cityNameEn) ??
                      t("cityUnknown")}
                  </Td>
                  <Td>
                    {row.verifiedAt ? (
                      <Badge>
                        {t("identityVerifiedOn", {
                          at: formatDate(row.verifiedAt, locale),
                        })}
                      </Badge>
                    ) : row.rejectedAt ? (
                      <Badge variant="destructive">
                        {t("identityRejectedBadge")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{t("identityUnverified")}</Badge>
                    )}
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/pilots/${row.userId}`}
                      className="text-sm underline"
                    >
                      {t("review")}
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="text-muted-foreground p-3 text-start font-medium">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="p-3 text-start">{children}</td>;
}
