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

export type BookingApprovedParams = {
  /** Already resolved to the recipient's language by the caller, from the
   *  zone's paired `name_ar` / `name_en` columns. */
  zoneName: string;
  startsAt: Date;
  endsAt: Date;
  ceilingMetres: number;
  bookingUrl: string;
};

export const bookingApproved = defineTemplate<BookingApprovedParams>({
  subject: (t, params) =>
    t("bookingApproved.subject", { zone: params.zoneName }),

  Body: ({ params, locale }) => {
    const t = emailTranslator(locale);
    return (
      <EmailLayout
        locale={locale}
        preview={t("bookingApproved.preview")}
        heading={t("bookingApproved.heading")}
      >
        <Text style={baseText}>{t("bookingApproved.body")}</Text>

        <Field label={t("bookingApproved.zoneLabel")}>{params.zoneName}</Field>
        {/* Not `ltr` — the Arabic range carries Arabic month names, and
            isolating it would reorder the words around the digits. Bidi does
            the right thing with a mixed run left alone. */}
        <Field label={t("bookingApproved.slotLabel")}>
          {formatDateRange(params.startsAt, params.endsAt, locale)}
        </Field>
        <Field label={t("bookingApproved.ceilingLabel")}>
          {formatAltitude(params.ceilingMetres, locale)}
        </Field>

        <ActionLink
          href={params.bookingUrl}
          label={t("bookingApproved.action")}
        />
        <Text style={mutedText}>{t("bookingApproved.note")}</Text>
      </EmailLayout>
    );
  },

  sample: {
    zoneName: "متنزه الثمامة — نطاق مسموح 01",
    startsAt: new Date("2026-09-04T11:00:00.000Z"),
    endsAt: new Date("2026-09-04T13:00:00.000Z"),
    ceilingMetres: 120,
    bookingUrl: localeUrl("/bookings/sample"),
  },
});
