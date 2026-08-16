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

export type DroneExpiredParams = {
  nickname: string;
  remoteIdCode: string;
  expiredAt: Date;
  renewUrl: string;
};

export const droneExpired = defineTemplate<DroneExpiredParams>({
  subject: (t, params) =>
    t("droneExpired.subject", { nickname: params.nickname }),

  Body: ({ params, locale }) => {
    const t = emailTranslator(locale);
    return (
      <EmailLayout
        locale={locale}
        preview={t("droneExpired.preview")}
        heading={t("droneExpired.heading", { nickname: params.nickname })}
      >
        <Text style={baseText}>{t("droneExpired.body")}</Text>

        <Field label={t("droneExpired.expiredLabel")}>
          {formatDate(params.expiredAt, locale)}
        </Field>
        <Field label={t("droneExpired.remoteIdLabel")} ltr>
          {params.remoteIdCode}
        </Field>

        <Text style={baseText}>{t("droneExpired.blocked")}</Text>
        <ActionLink href={params.renewUrl} label={t("droneExpired.action")} />
        <Text style={mutedText}>{t("droneExpired.keepsCode")}</Text>
      </EmailLayout>
    );
  },

  sample: {
    nickname: "الصقر",
    remoteIdCode: "AJN-4F2K-91XZ",
    expiredAt: new Date("2026-08-01T09:00:00.000Z"),
    renewUrl: localeUrl("/drones/sample/renew"),
  },
});
