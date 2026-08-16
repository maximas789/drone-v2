import { Section, Text } from "react-email";
import { formatDateRange } from "@/lib/format";
import { emailTranslator } from "@/lib/email/i18n";
import {
  ActionLink,
  baseText,
  ink,
  mutedText,
  EmailLayout,
  Field,
} from "@/lib/email/layout";
import { defineTemplate } from "@/lib/email/types";
import { localeUrl } from "@/lib/url";

export type BookingCancelledByAuthorityParams = {
  zoneName: string;
  startsAt: Date;
  endsAt: Date;
  /** The closure reason, verbatim. */
  reason: string;
  bookingsUrl: string;
};

/**
 * The only template that renders urgent. A pilot who does not read this one
 * may fly a slot that is no longer authorised, which is the one failure in
 * this app with a consequence outside the app.
 */
export const bookingCancelledByAuthority =
  defineTemplate<BookingCancelledByAuthorityParams>({
    subject: (t, params) =>
      t("bookingCancelled.subject", { zone: params.zoneName }),

    Body: ({ params, locale }) => {
      const t = emailTranslator(locale);
      return (
        <EmailLayout
          locale={locale}
          preview={t("bookingCancelled.preview")}
          heading={t("bookingCancelled.heading")}
          urgent
        >
          <Text style={baseText}>{t("bookingCancelled.body")}</Text>

          <Field label={t("bookingCancelled.zoneLabel")}>
            {params.zoneName}
          </Field>
          <Field label={t("bookingCancelled.slotLabel")}>
            {formatDateRange(params.startsAt, params.endsAt, locale)}
          </Field>

          <Text style={{ ...mutedText, margin: "16px 0 4px" }}>
            {t("bookingCancelled.reasonLabel")}
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

          <Text style={baseText}>{t("bookingCancelled.doNotFly")}</Text>
          <ActionLink
            href={params.bookingsUrl}
            label={t("bookingCancelled.action")}
          />
        </EmailLayout>
      );
    },

    sample: {
      zoneName: "متنزه الثمامة — نطاق مسموح 01",
      startsAt: new Date("2026-09-04T11:00:00.000Z"),
      endsAt: new Date("2026-09-04T13:00:00.000Z"),
      reason:
        "إغلاق مؤقت للنطاق لأعمال صيانة في المنطقة المجاورة للمدرج. المرجع: AJNIHA-PROPOSAL/NOTAM-0142.",
      bookingsUrl: localeUrl("/bookings"),
    },
  });
