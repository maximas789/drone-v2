import { Text } from "react-email";
import { emailTranslator } from "@/lib/email/i18n";
import { ActionLink, baseText, mutedText, EmailLayout } from "@/lib/email/layout";
import { defineTemplate } from "@/lib/email/types";
import { localeUrl } from "@/lib/url";

export type VerifyEmailParams = { url: string; name?: string };

export const verifyEmail = defineTemplate<VerifyEmailParams>({
  subject: (t) => t("verifyEmail.subject"),

  Body: ({ params, locale }) => {
    const t = emailTranslator(locale);
    return (
      <EmailLayout
        locale={locale}
        preview={t("verifyEmail.preview")}
        heading={t("verifyEmail.heading")}
      >
        <Text style={baseText}>
          {params.name
            ? t("common.greeting", { name: params.name })
            : t("common.greetingAnon")}
        </Text>
        <Text style={baseText}>{t("verifyEmail.body")}</Text>
        <ActionLink href={params.url} label={t("verifyEmail.action")} />
        <Text style={mutedText}>{t("verifyEmail.ignore")}</Text>
      </EmailLayout>
    );
  },

  sample: {
    url: localeUrl("/verify-email?token=sample-token"),
    name: "سارة",
  },
});
