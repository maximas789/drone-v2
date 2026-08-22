"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";
import { setPreferredLocaleAction } from "@/lib/actions/settings";
import { formatSeconds } from "@/lib/format";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/locale";

/**
 * The durable language choice — the one **emails and notifications** follow.
 *
 * **Two things happen on click, and they are not the same thing.** The action
 * writes `user.preferredLocale`, which is what F06's mail and F15's
 * notifications read. Then the router swaps the locale in the URL, so the page
 * being read follows too. Doing only the first would leave someone who just
 * chose English still reading Arabic; doing only the second is exactly what the
 * header switcher already does, and is why this page exists.
 *
 * `usePathname` is next-intl's — it returns the path without the locale prefix,
 * so the reader lands on `/en/settings/language` rather than on the home page.
 *
 * **The write is awaited before the navigation.** `router.replace` re-renders
 * this subtree, and a navigation racing an unresolved write is how a preference
 * appears to save and has not.
 */
export function LanguageForm({ current }: { current: Locale }) {
  const t = useTranslations("settings");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(next: Locale) {
    if (next === current) return;
    startTransition(async () => {
      setError(null);
      const result = await setPreferredLocaleAction(next);
      if (!result.ok) {
        const first = result.reasons[0];
        setError(
          first?.code === "rate_limited"
            ? tErrors("rateLimited", {
                duration: formatSeconds(
                  Number(first.params?.retryAfterSeconds ?? 60),
                  current,
                ),
              })
            : tErrors("generic"),
        );
        return;
      }
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={t("language.title")} className="flex gap-2">
        {LOCALES.map((locale) => {
          const active = locale === current;
          return (
            <Button
              key={locale}
              type="button"
              variant={active ? "secondary" : "outline"}
              aria-pressed={active}
              disabled={pending}
              onClick={() => choose(locale)}
              // Each label in its own language: a reader who cannot read the
              // current one still recognises their own.
              lang={locale}
              dir={locale === "ar" ? "rtl" : "ltr"}
            >
              {LOCALE_LABELS[locale]}
            </Button>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
