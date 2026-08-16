import { Text } from "react-email";
import { formatNumber } from "@/lib/format";
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

/**
 * **Counts and links only.** This is the one template with more than one
 * recipient, and the only one sent to somebody who is not the subject of it —
 * so it carries no pilot name, no drone nickname, no Remote ID code and no
 * booking detail. A reviewer who wants to know who is waiting opens the queue,
 * where the reveal is logged.
 */
export type ReviewQueueDigestParams = {
  pendingDrones: number;
  pendingBookings: number;
  queueUrl: string;
};

export const reviewQueueDigest = defineTemplate<ReviewQueueDigestParams>({
  subject: (t) => t("reviewQueueDigest.subject"),

  Body: ({ params, locale }) => {
    const t = emailTranslator(locale);
    return (
      <EmailLayout
        locale={locale}
        preview={t("reviewQueueDigest.preview")}
        heading={t("reviewQueueDigest.heading")}
      >
        <Text style={baseText}>{t("reviewQueueDigest.body")}</Text>

        <Field label={t("reviewQueueDigest.dronesLabel")}>
          {formatNumber(params.pendingDrones, locale)}
        </Field>
        <Field label={t("reviewQueueDigest.bookingsLabel")}>
          {formatNumber(params.pendingBookings, locale)}
        </Field>

        <ActionLink
          href={params.queueUrl}
          label={t("reviewQueueDigest.action")}
        />
        <Text style={mutedText}>{t("reviewQueueDigest.noPii")}</Text>
      </EmailLayout>
    );
  },

  sample: {
    pendingDrones: 7,
    pendingBookings: 12,
    queueUrl: localeUrl("/admin/review"),
  },
});
