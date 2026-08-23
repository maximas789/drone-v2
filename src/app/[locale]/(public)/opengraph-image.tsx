import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { ogFonts } from "@/lib/site/og";
import { OgCard } from "@/lib/site/og-card";
import { toLocale } from "@/lib/locale";

/**
 * The preview card — what a shared Ajniha link looks like in WhatsApp, in an
 * email, and on the slide somebody pastes it into.
 *
 * **Arabic-first, and that is the hard part.** `ImageResponse` is satori: no
 * browser, no CSS cascade, no font stack. Hand it Arabic without the font
 * *bytes* and it draws a row of empty boxes — not an error, not a warning, just
 * tofu on the one image every shared link displays. `ogFonts()` reads four
 * vendored faces off disk for exactly this reason; see
 * `scripts/vendor-fonts.mts`.
 *
 * **It sits under `[locale]`**, so `/ar` and `/en` get different cards rather
 * than one bilingual compromise. A card is one sentence long, and the sentence
 * has to be in the reader's language.
 *
 * **Under `(public)`**, so it attaches to the public pages and not to the
 * signed-in app. Route groups are not URL segments; the scoping is the point.
 *
 * The layout lives in `OgCard`, shared with the `/remote-id` variant.
 */

export const alt = "Ajniha — أجنحة";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = toLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "meta" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const rtl = locale === "ar";

  return new ImageResponse(
    (
      <OgCard
        wordmark={tCommon("appName")}
        headline={t("pages.home.title")}
        notice={t("ogNotice")}
        rtl={rtl}
        headlinePerLine={rtl ? 5 : 6}
        noticePerLine={rtl ? 7 : 8}
      />
    ),
    { ...size, fonts: await ogFonts() },
  );
}
