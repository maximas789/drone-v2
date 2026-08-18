"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

/**
 * The Remote ID code, and a control that copies it.
 *
 * **Reading it aloud is the real fallback.** A field inspector's camera will
 * not always focus — dusk, a scratched sticker, a phone held at arm's length —
 * and the pilot then reads the code down a telephone. That is why the code is
 * the largest thing on the card, and why copying it copies the **canonical**
 * `AJN-XXXX-XXXX` form with its dashes: the dashes are what make it readable in
 * three chunks instead of ten characters.
 *
 * **Latin characters and `dir="ltr"` in both locales.** A code is a code, not
 * text to be localised — transliterating it, or letting `ar` render its digits
 * Arabic-Indic, would produce a string that resolves to nothing.
 *
 * No `tracking-*` without an `ltr:` prefix (rule 5): letter-spacing breaks
 * Arabic letter joins, and this component renders on an Arabic page.
 */
export function CopyCode({ code }: { code: string }) {
  const t = useTranslations("remoteId.card");
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  // The confirmation is transient — a permanent "copied" would be a lie the
  // moment the clipboard holds something else.
  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2_000);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-muted-foreground text-xs">{t("codeLabel")}</span>

      <button
        type="button"
        dir="ltr"
        aria-label={t("copyAria", { code })}
        className="hover:bg-accent focus-visible:ring-ring rounded-lg px-3 py-1 font-mono text-3xl font-semibold ltr:tracking-wide focus-visible:ring-2 focus-visible:outline-none sm:text-4xl"
        onClick={async () => {
          try {
            /**
             * `navigator.clipboard` is unavailable on an insecure origin and
             * can be refused by permission policy. Both are ordinary, so the
             * failure is **shown** — a copy button that silently does nothing
             * is worse than one that says it could not, because the pilot walks
             * away believing they have the code.
             */
            await navigator.clipboard.writeText(code);
            setState("copied");
          } catch {
            setState("failed");
          }
        }}
      >
        {code}
      </button>

      {/**
       * `aria-live`, so the confirmation is announced rather than only seen —
       * the control's whole purpose is to be usable without looking closely.
       */}
      <span
        aria-live="polite"
        className={
          state === "failed"
            ? "text-destructive text-xs"
            : "text-muted-foreground text-xs"
        }
      >
        {state === "copied"
          ? t("copied")
          : state === "failed"
            ? t("copyFailed")
            : t("copyHint")}
      </span>
    </div>
  );
}
