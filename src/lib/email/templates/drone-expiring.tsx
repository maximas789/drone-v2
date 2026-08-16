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

export type DroneExpiringParams = {
  nickname: string;
  remoteIdCode: string;
  expiresAt: Date;
  daysRemaining: number;
  renewUrl: string;
};

export const droneExpiring = defineTemplate<DroneExpiringParams>({
  subject: (t, params) =>
    t("droneExpiring.subject", { nickname: params.nickname }),

  Body: ({ params, locale }) => {
    const t = emailTranslator(locale);
    return (
      <EmailLayout
        locale={locale}
        preview={t("droneExpiring.preview")}
        heading={t("droneExpiring.heading", { nickname: params.nickname })}
      >
        <Text style={baseText}>{t("droneExpiring.body")}</Text>

        <Field label={t("droneExpiring.expiresLabel")}>
          {formatDate(params.expiresAt, locale)}
        </Field>
        <Field label={t("droneExpiring.remainingLabel")}>
          {/* Arabic has six plural categories and this message uses all of
              them. The forced `-nu-latn` tag in the translator is what keeps
              ICU's `#` a Latin numeral. */}
          {t("droneExpiring.remaining", { days: params.daysRemaining })}
        </Field>
        <Field label={t("droneExpiring.remoteIdLabel")} ltr>
          {params.remoteIdCode}
        </Field>

        <ActionLink href={params.renewUrl} label={t("droneExpiring.action")} />
        <Text style={mutedText}>{t("droneExpiring.keepsCode")}</Text>
      </EmailLayout>
    );
  },

  sample: {
    nickname: "الصقر",
    remoteIdCode: "AJN-4F2K-91XZ",
    expiresAt: new Date("2026-09-15T09:00:00.000Z"),
    daysRemaining: 30,
    renewUrl: localeUrl("/drones/sample/renew"),
  },
});
