import { Text } from "react-email";
import { formatDate } from "@/lib/format";
import { emailTranslator } from "@/lib/email/i18n";
import {
  ActionLink,
  baseText,
  mutedText,
  EmailLayout,
  Field,
} from "@/lib/email/layout";
import { defineTemplate } from "@/lib/email/types";
import { localeUrl } from "@/lib/url";

export type DroneApprovedParams = {
  nickname: string;
  /** The whole point of the product: issued instead of a manufacturer serial. */
  remoteIdCode: string;
  validUntil: Date;
  cardUrl: string;
};

export const droneApproved = defineTemplate<DroneApprovedParams>({
  subject: (t, params) =>
    t("droneApproved.subject", { nickname: params.nickname }),

  Body: ({ params, locale }) => {
    const t = emailTranslator(locale);
    return (
      <EmailLayout
        locale={locale}
        preview={t("droneApproved.preview")}
        heading={t("droneApproved.heading")}
      >
        <Text style={baseText}>
          {t("droneApproved.body", { nickname: params.nickname })}
        </Text>

        <Field label={t("droneApproved.remoteIdLabel")} ltr>
          {params.remoteIdCode}
        </Field>
        <Field label={t("droneApproved.validUntilLabel")}>
          {formatDate(params.validUntil, locale)}
        </Field>

        <ActionLink href={params.cardUrl} label={t("droneApproved.action")} />

        <Text style={mutedText}>{t("droneApproved.keepCode")}</Text>
      </EmailLayout>
    );
  },

  sample: {
    nickname: "الصقر",
    remoteIdCode: "AJN-4F2K-91XZ",
    validUntil: new Date("2029-03-15T09:00:00.000Z"),
    cardUrl: localeUrl("/drones/sample/remote-id"),
  },
});
