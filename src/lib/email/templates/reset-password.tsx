import { Text } from "react-email";
import { emailTranslator } from "@/lib/email/i18n";
import { ActionLink, baseText, mutedText, EmailLayout } from "@/lib/email/layout";
import { defineTemplate } from "@/lib/email/types";
import { localeUrl } from "@/lib/url";

export type ResetPasswordParams = {
  url: string;
  name?: string;
  /** Better Auth's reset token lifetime, in minutes. Stated, never guessed at
   *  by the reader — a link that has quietly expired is the whole complaint. */
  expiresInMinutes: number;
};

export const resetPassword = defineTemplate<ResetPasswordParams>({
  subject: (t) => t("resetPassword.subject"),

  Body: ({ params, locale }) => {
    const t = emailTranslator(locale);
    return (
      <EmailLayout
        locale={locale}
        preview={t("resetPassword.preview")}
        heading={t("resetPassword.heading")}
      >
        <Text style={baseText}>
          {params.name
            ? t("common.greeting", { name: params.name })
            : t("common.greetingAnon")}
        </Text>
        <Text style={baseText}>{t("resetPassword.body")}</Text>
        <ActionLink href={params.url} label={t("resetPassword.action")} />
        <Text style={mutedText}>
          {t("resetPassword.expiry", { minutes: params.expiresInMinutes })}
        </Text>
        <Text style={mutedText}>{t("resetPassword.ignore")}</Text>
      </EmailLayout>
    );
  },

  sample: {
    url: localeUrl("/reset-password?token=sample-token"),
    name: "سارة",
    expiresInMinutes: 60,
  },
});
