import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";

/**
 * The frame every auth page shares. No guard here — these pages are the way
 * *in*, so they must stay reachable signed out.
 */
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
      <Badge variant="secondary" className="whitespace-normal">
        {t("proposalNotice")}
      </Badge>
    </main>
  );
}
