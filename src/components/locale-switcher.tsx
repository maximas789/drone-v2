"use client";

import { useParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LOCALE_LABELS, LOCALES, toLocale, type Locale } from "@/lib/locale";

/**
 * Switches language **in place**: the pathname and the query string both
 * survive, so a pilot comparing a refusal reason in the other language lands
 * back on the same refusal, not on the home page.
 *
 * `usePathname` here is next-intl's, which returns the path *without* the
 * locale prefix — that's what makes the swap a one-liner.
 */
export function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const active = toLocale(params.locale);
  const [isPending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    // Read the query at click time from the URL rather than with
    // `useSearchParams`. This switcher sits in the header of every page, and
    // `useSearchParams` opts its whole page out of static prerendering unless
    // each one wraps it in a Suspense boundary — a tax on every route for a
    // value only needed the moment someone clicks.
    const query = window.location.search;
    startTransition(() => {
      router.replace(`${pathname}${query}`, { locale: next });
    });
  }

  return (
    <div className="flex items-center gap-1" role="group">
      {LOCALES.map((locale) => (
        <Button
          key={locale}
          type="button"
          size="sm"
          variant={locale === active ? "secondary" : "ghost"}
          aria-current={locale === active ? "true" : undefined}
          disabled={isPending}
          onClick={() => switchTo(locale)}
          // The label is always in the target language — a reader who cannot
          // read the current one still recognises their own.
          lang={locale}
          dir={locale === "ar" ? "rtl" : "ltr"}
        >
          {LOCALE_LABELS[locale]}
        </Button>
      ))}
    </div>
  );
}
