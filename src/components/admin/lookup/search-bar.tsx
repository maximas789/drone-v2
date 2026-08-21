"use client";

import { useTranslations } from "next-intl";
import { useCallback, useId, useState, useTransition } from "react";
import { DisambiguationList } from "@/components/admin/lookup/disambiguation-list";
import { QrScanButton } from "@/components/admin/lookup/qr-scan-button";
import {
  rememberRecent,
  RecentLookups,
} from "@/components/admin/lookup/recent-lookups";
import { ResultCard } from "@/components/admin/lookup/result-card";
import { ReportDialog } from "@/components/remote-id/report-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupAction, type LookupOutcome } from "@/lib/actions/lookup";
import { formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import type { LookupKind } from "@/lib/lookup/detect";

/**
 * The lookup console — one box, and the server works out what it was given.
 *
 * **A POST, never a GET.** Every other filter in this build is a GET form,
 * because a filtered queue that is a link a colleague can be sent is worth
 * having. This one cannot be: the term may be a **national ID or a mobile
 * number**, and a GET would put it in the address bar, the browser history, the
 * server's access log and any referrer that leaves the origin. Personal data
 * does not go in a query string, so the one search that can carry it does not
 * use one. That costs the shareable link and the back button, which is the
 * right trade.
 *
 * **The screen says how the term was read.** A mistyped code that silently fell
 * through to a name search would report "no registration found" about an
 * aircraft that *is* registered — the one wrong answer this tool must never
 * give. So the reading is stated, and where the reading is genuinely ambiguous
 * (the Crockford alphabet is ordinary Latin; `Alshehri` normalises to a valid
 * code) a control re-runs it the other way.
 *
 * **Field ergonomics are not decoration here.** This is used outdoors, on a
 * phone, one-handed, in sunlight: the input autofocuses, every control is at
 * least 48 px tall, the layout is a single column below `sm`, and the codes are
 * uppercased by the keyboard because that is what is printed on the sticker.
 */

/** What a "read as X, try Y instead" control may offer, per detected kind. */
const ALTERNATIVES: Partial<Record<LookupKind, LookupKind[]>> = {
  code: ["name"],
  partial: ["name", "module_serial"],
  module_serial: ["name", "partial"],
  name: ["partial", "module_serial"],
};

export function LookupSearchBar({ locale }: { locale: Locale }) {
  const t = useTranslations("lookup");
  const tErrors = useTranslations("errors");
  const fieldId = useId();

  const [term, setTerm] = useState("");
  const [outcome, setOutcome] = useState<LookupOutcome | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * The recent list is **not** held here. It lives in `recent-lookups.tsx` as a
   * small external store read through `useSyncExternalStore`, so writing to it
   * from inside this transition needs no second render pass and no effect.
   */

  const run = useCallback(
    (value: string, forceKind?: LookupKind) => {
      startTransition(async () => {
        setMessage(null);
        const result = await lookupAction(value, forceKind);

        if (!result.ok) {
          const limited = result.reasons.find((r) => r.code === "rate_limited");
          setMessage(
            limited
              ? tErrors("rateLimited", {
                  duration: formatSeconds(
                    Number(limited.params?.retryAfterSeconds ?? 60),
                    locale,
                  ),
                })
              : tErrors("generic"),
          );
          return;
        }

        setOutcome(result.data);

        /**
         * Only a resolved **code** is remembered. Never a name, never a mobile
         * number, never a national ID — see `recent-lookups.tsx` for why a
         * convenience list must not become a record of the people a reviewer
         * looked for.
         */
        if (result.data.view) {
          rememberRecent(result.data.view.code);
        }
      });
    },
    [locale, tErrors],
  );

  const scanned = useCallback(
    (value: string) => {
      /**
       * A QR may carry the whole scan URL — `https://…/ar/rid/AJN-4F2K-91XZ` —
       * or a bare code. The last path segment covers both, and the server
       * normalises whatever arrives; nothing is decided here.
       */
      const last = value.split(/[/?#]/).filter(Boolean).pop() ?? value;
      setTerm(last);
      run(last);
    },
    [run],
  );

  const alternatives = outcome ? (ALTERNATIVES[outcome.kind] ?? []) : [];

  return (
    <div className="flex flex-col gap-6">
      <form
        role="search"
        aria-label={t("searchLabel")}
        className="border-border flex flex-col gap-3 rounded-lg border p-4"
        onSubmit={(event) => {
          // No `action`, no navigation: the term must not reach a URL.
          event.preventDefault();
          run(term);
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-q`} className="text-base">
            {t("searchLabel")}
          </Label>
          <Input
            id={`${fieldId}-q`}
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            maxLength={100}
            /* The page exists to be typed into. An officer holding a phone in
               one hand should not have to tap the field before they can. */
            autoFocus
            autoComplete="off"
            /*
              `text`, not `search` — a numeric keypad would be wrong for a code
              and a name, and the officer types far more codes than numbers.
              `characters` because that is what is printed on the sticker; the
              server uppercases anyway, but the keyboard should not fight them.
            */
            inputMode="text"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder={t("searchPlaceholder")}
            className="min-h-12 text-lg"
            aria-describedby={`${fieldId}-hint`}
          />
          <p id={`${fieldId}-hint`} className="text-muted-foreground text-sm">
            {t("searchHint")}
          </p>
        </div>

        {message ? (
          <p className="text-destructive text-sm" role="alert">
            {message}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <Button type="submit" className="min-h-12 sm:w-fit" disabled={pending}>
            {pending ? t("searching") : t("search")}
          </Button>
          <QrScanButton onScan={scanned} disabled={pending} />
        </div>
      </form>

      <RecentLookups
        disabled={pending}
        onPick={(code) => {
          setTerm(code);
          run(code);
        }}
      />

      {outcome && outcome.kind !== "empty" ? (
        <div className="flex flex-col gap-4">
          {/*
            How it was read, plus the way back. `aria-live="polite"` so a
            screen-reader user hears the reading change when a result arrives
            rather than having to hunt for it.
          */}
          <div
            aria-live="polite"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
          >
            <span className="text-muted-foreground">
              {t("readAs", { kind: t(`kinds.${outcome.kind}`) })}
            </span>
            {alternatives.map((kind) => (
              <Button
                key={kind}
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                /* A field control like every other on this page: `size="sm"`
                   is 28 px tall, which is not a target for a thumb in
                   sunlight. 44 px is the smallest this screen ships. */
                className="min-h-11"
                onClick={() => run(term, kind)}
              >
                {t("readAsInstead", { kind: t(`kinds.${kind}`) })}
              </Button>
            ))}
          </div>

          {outcome.view ? (
            <ResultCard view={outcome.view} trail={outcome.trail} locale={locale} />
          ) : outcome.candidates.length > 0 ? (
            <DisambiguationList
              candidates={outcome.candidates}
              disabled={pending}
              locale={locale}
              onOpen={(code) => {
                setTerm(code);
                run(code, "code");
              }}
            />
          ) : (
            /*
              **An explicit answer, not an empty page.** "No registration found"
              is a real and useful finding; a silent blank leaves an officer
              unsure whether the tool failed or the aircraft is genuinely
              unregistered, which is the one ambiguity that matters here.
            */
            <section className="border-border flex flex-col items-start gap-3 rounded-xl border p-5">
              <h2 className="text-xl font-semibold">{t("noResultTitle")}</h2>
              <p className="text-sm">{t("noResultBody")}</p>
              {/*
                Reported through F11's action, which deliberately does not
                require the code to resolve — an unregistered one is the more
                interesting report, not the one to throw away. `echo` is empty
                for a national ID or a mobile number, so neither can ever be
                filed as a "reported code".
              */}
              <ReportDialog
                code={outcome.echo}
                locale={locale}
                openLabel={t("reportUnregistered")}
              />
            </section>
          )}
        </div>
      ) : null}
    </div>
  );
}
