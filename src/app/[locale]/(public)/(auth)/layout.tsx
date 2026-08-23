import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ProposalNotice } from "@/components/proposal-notice";
import { Link } from "@/i18n/navigation";
import { PRIVATE_ROBOTS } from "@/lib/site/metadata";

/**
 * The frame every auth page shares. No guard here — these pages are the way
 * *in*, so they must stay reachable signed out.
 */
/**
 * **Never indexed**, set once for the whole route group rather than once per
 * page: metadata merges field by field, so a page underneath that sets only its
 * own `title` still inherits this. Five pages each repeating a `robots` block is
 * five places for one to go missing, and the one that went missing would be
 * indexed with nothing failing.
 *
 * `robots.txt` disallows these paths as well. Neither control is sufficient
 * alone — a disallowed page is never fetched, so its `noindex` is never read,
 * and a URL a search engine already knows can sit in an index behind a
 * `Disallow` indefinitely.
 *
 * **This is not the security boundary.** The guard below is. This stops the app
 * appearing in a search result; it stops nobody from typing the URL.
 */
export const metadata: Metadata = { robots: PRIVATE_ROBOTS };

export default async function AuthLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const t = await getTranslations("common");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <Link href="/" className="text-xl font-semibold">
          {t("appName")}
        </Link>
        <LocaleSwitcher />
      </header>

      {children}

      {/* Honesty constraint: this is a proposal, and every entry point says so. */}
      <ProposalNotice />
    </main>
  );
}
