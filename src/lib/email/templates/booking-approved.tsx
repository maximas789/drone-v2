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
  ceilingMetres: number | null;
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
        {/*
          **`null` is not zero, and it is certainly not 120.** A zone may carry
          no published ceiling, and both of these emails took a bare `number`:
          the reminder rendered it `0 m` — read as ground level, the opposite of
          unlimited — and the approval briefly rendered `120 m`, which asserted
          the app's one unsourced regulatory figure (BUILD-LOG thread 77) as
          *this flight's* limit, in an outbound message, for a zone that never
          set one. Two emails about the same flight disagreed.
        */}
        <Field label={t("bookingApproved.ceilingLabel")}>
          {params.ceilingMetres === null
            ? t("bookingApproved.ceilingNone")
            : formatAltitude(params.ceilingMetres, locale)}
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
