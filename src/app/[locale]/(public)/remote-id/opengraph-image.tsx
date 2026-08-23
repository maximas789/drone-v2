import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { ogFonts } from "@/lib/site/og";
import { OgCard } from "@/lib/site/og-card";
import { toLocale } from "@/lib/locale";

/**
 * `/remote-id`'s own card.
 *
 * **This is the link that actually gets shared.** `/remote-id` is the page
 * somebody sends when they are explaining the *idea* — the page with the
 * citations — so it earns a headline about Remote ID rather than one about
 * registering an aircraft. Everything else is the same card, from `OgCard`,
 * because two files drawing the same wordmark is how the two drift.
 *
 * Same satori constraints as the root card: fonts as bytes, colours as literal
 * hex, a subset of flexbox.
 */

export const alt = "Remote ID — الهوية عن بُعد";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function RemoteIdOpengraphImage({
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
        headline={t("pages.remoteId.title")}
        notice={t("ogNotice")}
        rtl={rtl}
        headlinePerLine={rtl ? 4 : 5}
        noticePerLine={rtl ? 7 : 8}
      />
    ),
    { ...size, fonts: await ogFonts() },
  );
}
