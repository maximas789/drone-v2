"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

/**
 * The codes this session has already resolved.
 *
 * **Codes only, and only ones that resolved.** Re-checking an aircraft is the
 * common second act — an officer walks away, comes back, wants the same record
 * — and retyping thirteen symbols in sunlight is where a mistake gets made.
 *
 * A national ID, a mobile number or a name is **never** put on this list. The
 * store is `sessionStorage`, which survives a reload, and a shared or
 * confiscated phone would otherwise carry a visible list of the people a
 * reviewer looked up. A Remote ID code is a licence plate; a name is not.
 *
 * `sessionStorage`, not `localStorage`: "for the session" is what the feature
 * says, and a list that outlives the browser tab is a list nobody remembers
 * consenting to.
 */

const STORAGE_KEY = "ajniha.lookup.recent";
const MAX_RECENT = 8;

/**
 * **A tiny external store, read with `useSyncExternalStore`.**
 *
 * The obvious version is `useState([])` plus a `useEffect` that calls
 * `setRecent(readRecent())` — which the React compiler's lint rejects on
 * sight, and is right to: a `setState` in an effect body is a cascading
 * render. It is also the wrong tool. `sessionStorage` *is* an external system,
 * `useSyncExternalStore` is the hook for reading one, and it takes a separate
 * server snapshot — so the server renders "no list" and the client renders the
 * real one with no hydration mismatch and no second pass.
 *
 * The cached snapshot matters: `getSnapshot` must return a **referentially
 * stable** value between changes or React re-renders forever. So the parsed
 * array is held here and replaced only when something actually writes.
 *
 * Every access is wrapped: `sessionStorage` throws outright in a browser with
 * site data disabled, and a lookup tool that white-screens because a
 * convenience list could not be read would be an absurd trade.
 */

const listeners = new Set<() => void>();
let snapshot: string[] | null = null;

/** The one empty array, so the server snapshot is stable too. */
const EMPTY: string[] = [];

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): string[] {
  snapshot ??= readRecent();
  return snapshot;
}

/** No `sessionStorage` on the server, so the list is simply not there yet. */
function getServerSnapshot(): string[] {
  return EMPTY;
}

function publish(next: string[]): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

/** The session's resolved codes, live. */
export function useRecentLookups(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function readRecent(): string[] {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function rememberRecent(code: string): string[] {
  const next = [code, ...readRecent().filter((item) => item !== code)].slice(
    0,
    MAX_RECENT,
  );
  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Nothing to do and nothing to say — the list is a convenience.
  }
  publish(next);
  return next;
}

export function clearRecent(): void {
  try {
    globalThis.sessionStorage?.removeItem(STORAGE_KEY);
  } catch {
    // As above.
  }
  publish(EMPTY);
}

export function RecentLookups({
  onPick,
  disabled = false,
}: {
  onPick: (code: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("lookup");
  const codes = useRecentLookups();

  if (codes.length === 0) return null;

  return (
    <section className="flex flex-col gap-2" aria-label={t("recentTitle")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-muted-foreground text-sm">{t("recentTitle")}</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          /* 44 px, like every other control here — see `search-bar.tsx`. */
          className="min-h-11"
          onClick={clearRecent}
        >
          {t("recentClear")}
        </Button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {codes.map((code) => (
          <li key={code}>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className="min-h-11 font-mono"
              onClick={() => onPick(code)}
            >
              {/* Latin in both languages, and `ltr:` so the letter-spacing
                  never reaches an Arabic run. */}
              <span dir="ltr" className="ltr:tracking-wide">
                {code}
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
