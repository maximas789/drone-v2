import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { routing } from "@/i18n/routing";
import { direction, toLocale, type Locale } from "@/lib/locale";
import { absoluteUrl, APP_URL } from "@/lib/url";
import "../globals.css";

/**
 * Arabic. Four weights, because the digital ID card and the admin tables both
 * need a real medium — faux-bolding Arabic thickens the joins and turns a
 * Remote ID code into mush at sticker size.
 */
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * The metadata every page inherits. **F30 owns this** — F16 deliberately left
 * it alone so there would be one owner rather than a landing page and an SEO
 * feature both editing the same object.
 *
 * `metadataBase` is what turns a relative canonical or Open Graph path into an
 * absolute URL. Without it Next warns at build and silently falls back to
 * localhost; with it, `APP_URL` is the single value that decides what every
 * shared link says. `src/lib/url.ts` warns loudly when that value is unset,
 * because from this feature onwards an unset one is published rather than just
 * printed.
 *
 * `title.template` takes a literal **`%s`**, substituted by the framework — not
 * an ICU placeholder, and not something next-intl ever sees. It lives in the
 * catalogue anyway so the separator can differ by language: an Arabic tab
 * reading `%s · أجنحة` and an English one reading `%s · Ajniha` are two
 * decisions, not one string with a variable in it.
 *
 * `title.default` is the landing page's own title, used wherever a page sets
 * none. A page that wants its title *without* the suffix — the landing page
 * itself — says `title: { absolute: … }`; that is F30b's job, page by page.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = toLocale(await localeParam());
  const t = await getTranslations("meta");
  return {
    metadataBase: new URL(APP_URL),
    title: {
      default: t("pages.home.title"),
      template: t("titlePattern"),
    },
    description: t("pages.home.description"),
    /**
     * **The image is attached by file convention, not named here.**
     * `opengraph-image.tsx` under `(public)` supplies `og:image`, its type and
     * its dimensions; listing a URL as well would be a second source of truth
     * for the same tag, and the one that went stale would be the hand-written
     * one. What these blocks add is everything the *file* cannot know: the
     * title, the description, the locale and the card type.
     */
    openGraph: {
      type: "website",
      siteName: t("siteName"),
      title: t("pages.home.title"),
      description: t("pages.home.description"),
      url: absoluteUrl(`/${locale}`),
      // Underscored, per the Open Graph spec — `ar-SA` is not a valid value
      // here even though it is a perfectly good BCP 47 tag.
      locale: locale === "ar" ? "ar_SA" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: t("pages.home.title"),
      description: t("pages.home.description"),
    },
  };
}

export default async function LocaleLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const locale = await localeParam();

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Keeps this route statically renderable rather than opting the whole
  // subtree into dynamic rendering the first time a translation is read.
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      dir={direction(locale as Locale)}
      // Font variables belong on <html>, not <body>: `font-sans` is applied to
      // html in globals.css, and a variable declared on body isn't in scope for
      // the element that consumes it.
      className={`${plexArabic.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
