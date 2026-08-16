import { Section, Text } from "react-email";
import { emailTranslator } from "@/lib/email/i18n";
import {
  ActionLink,
  baseText,
  ink,
  mutedText,
  EmailLayout,
} from "@/lib/email/layout";
import { defineTemplate } from "@/lib/email/types";
import { localeUrl } from "@/lib/url";

export type DroneRejectedParams = {
  nickname: string;
  /**
   * The reviewer's own words, **verbatim**. Not a code, not a summary, not a
   * translation — a decision a pilot has to act on has to be quotable back at
   * the person who made it. It is rendered as text, never as markup.
   */
  reason: string;
  editUrl: string;
};

export const droneRejected = defineTemplate<DroneRejectedParams>({
  subject: (t, params) =>
    t("droneRejected.subject", { nickname: params.nickname }),

  Body: ({ params, locale }) => {
    const t = emailTranslator(locale);
    return (
      <EmailLayout
        locale={locale}
        preview={t("droneRejected.preview")}
        heading={t("droneRejected.heading")}
      >
        <Text style={baseText}>
          {t("droneRejected.body", { nickname: params.nickname })}
        </Text>

        <Text style={{ ...mutedText, margin: "0 0 4px" }}>
          {t("droneRejected.reasonLabel")}
        </Text>
        <Section
          style={{
            backgroundColor: ink.panel,
            borderRadius: "6px",
            margin: "0 0 16px",
            padding: "12px 14px",
          }}
        >
          <Text style={{ ...baseText, margin: 0, whiteSpace: "pre-wrap" }}>
            {params.reason}
          </Text>
        </Section>

        <Text style={baseText}>{t("droneRejected.whatNext")}</Text>
        <ActionLink href={params.editUrl} label={t("droneRejected.action")} />
      </EmailLayout>
    );
  },

  sample: {
    nickname: "الصقر",
    reason:
      "صورة وحدة الهوية عن بُعد غير واضحة، ولا يظهر فيها الملصق التعريفي. أعد رفع صورة يظهر فيها الملصق كاملاً.",
    editUrl: localeUrl("/drones/sample/edit"),
  },
});
