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

export type BookingRejectedParams = {
  zoneName: string;
  startsAt: Date;
  endsAt: Date;
  /** The reviewer's own words, verbatim. */
  reason: string;
  /** Slots the pilot could take instead. May be empty — and if it is, the
   *  email says so rather than quietly omitting the section. */
  alternatives: Array<{ startsAt: Date; endsAt: Date }>;
  bookUrl: string;
};

export const bookingRejected = defineTemplate<BookingRejectedParams>({
  subject: (t, params) =>
    t("bookingRejected.subject", { zone: params.zoneName }),

  Body: ({ params, locale }) => {
    const t = emailTranslator(locale);
    return (
      <EmailLayout
        locale={locale}
        preview={t("bookingRejected.preview")}
        heading={t("bookingRejected.heading")}
      >
        <Text style={baseText}>{t("bookingRejected.body")}</Text>

        <Field label={t("bookingRejected.zoneLabel")}>{params.zoneName}</Field>
        <Field label={t("bookingRejected.slotLabel")}>
          {formatDateRange(params.startsAt, params.endsAt, locale)}
        </Field>

        <Text style={{ ...mutedText, margin: "16px 0 4px" }}>
          {t("bookingRejected.reasonLabel")}
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

        <Text style={{ ...mutedText, margin: "0 0 4px" }}>
          {t("bookingRejected.alternativesLabel")}
        </Text>
        {params.alternatives.length > 0 ? (
          params.alternatives.map((slot) => (
            <Text
              key={slot.startsAt.toISOString()}
              style={{ ...baseText, margin: "0 0 4px" }}
            >
              {formatDateRange(slot.startsAt, slot.endsAt, locale)}
            </Text>
          ))
        ) : (
          <Text style={baseText}>{t("bookingRejected.noAlternatives")}</Text>
        )}

        <ActionLink href={params.bookUrl} label={t("bookingRejected.action")} />
      </EmailLayout>
    );
  },

  sample: {
    zoneName: "متنزه الثمامة — نطاق مسموح 01",
    startsAt: new Date("2026-09-04T11:00:00.000Z"),
    endsAt: new Date("2026-09-04T13:00:00.000Z"),
    reason:
      "الفترة المطلوبة تتقاطع مع إغلاق مؤقت للنطاق بسبب فعالية. اختر فترة بعد الساعة 17:00.",
    alternatives: [
      {
        startsAt: new Date("2026-09-04T14:00:00.000Z"),
        endsAt: new Date("2026-09-04T16:00:00.000Z"),
      },
      {
        startsAt: new Date("2026-09-05T11:00:00.000Z"),
        endsAt: new Date("2026-09-05T13:00:00.000Z"),
      },
    ],
    bookUrl: localeUrl("/map"),
  },
});
