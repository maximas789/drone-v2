import { Text } from "react-email";
import { formatAltitude, formatDateRange } from "@/lib/format";
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

export type BookingReminderParams = {
  zoneName: string;
  startsAt: Date;
  endsAt: Date;
  ceilingMetres: number;
  remoteIdCode: string;
  bookingUrl: string;
};

export const bookingReminder = defineTemplate<BookingReminderParams>({
  subject: (t, params) => t("bookingReminder.subject", { zone: params.zoneName }),

  Body: ({ params, locale }) => {
    const t = emailTranslator(locale);
    return (
      <EmailLayout
        locale={locale}
        preview={t("bookingReminder.preview")}
        heading={t("bookingReminder.heading")}
      >
        <Text style={baseText}>{t("bookingReminder.body")}</Text>

        <Field label={t("bookingReminder.zoneLabel")}>{params.zoneName}</Field>
        <Field label={t("bookingReminder.slotLabel")}>
          {formatDateRange(params.startsAt, params.endsAt, locale)}
        </Field>
        <Field label={t("bookingReminder.ceilingLabel")}>
          {formatAltitude(params.ceilingMetres, locale)}
        </Field>
        <Field label={t("bookingReminder.remoteIdLabel")} ltr>
          {params.remoteIdCode}
        </Field>

        <ActionLink
          href={params.bookingUrl}
          label={t("bookingReminder.action")}
        />
        <Text style={mutedText}>{t("bookingReminder.checklist")}</Text>
      </EmailLayout>
    );
  },

  sample: {
    zoneName: "متنزه الثمامة — نطاق مسموح 01",
    startsAt: new Date("2026-09-04T11:00:00.000Z"),
    endsAt: new Date("2026-09-04T13:00:00.000Z"),
    ceilingMetres: 120,
    remoteIdCode: "AJN-4F2K-91XZ",
    bookingUrl: localeUrl("/bookings/sample"),
  },
});
