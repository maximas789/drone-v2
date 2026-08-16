import { describe, expect, it } from "vitest";
import { renderEmail } from "@/lib/email/render";
import {
  EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_NAMES,
  type EmailTemplateName,
} from "@/lib/email/templates";
import { LOCALES, type Locale } from "@/lib/locale";

/**
 * Nothing else in this build looks at an email. `lint`, `typecheck` and
 * `build` all stay green while a template right-aligns nothing, prints a Hijri
 * date, or leaks a national ID — so these are the checks that stand in for a
 * reader, and `/dev/emails` is where a human confirms the rest.
 */

async function renderSample(name: EmailTemplateName, locale: Locale) {
  return renderEmail(name, EMAIL_TEMPLATES[name].sample as never, locale);
}

const rendered = new Map<string, { subject: string; html: string; text: string }>();

for (const name of EMAIL_TEMPLATE_NAMES) {
  for (const locale of LOCALES) {
    rendered.set(`${name}/${locale}`, await renderSample(name, locale));
  }
}

function get(name: EmailTemplateName, locale: Locale) {
  const value = rendered.get(`${name}/${locale}`);
  if (!value) throw new Error(`not rendered: ${name}/${locale}`);
  return value;
}

describe("every template, in every locale", () => {
  for (const name of EMAIL_TEMPLATE_NAMES) {
    for (const locale of LOCALES) {
      describe(`${name} · ${locale}`, () => {
        it("renders a non-empty subject and body", () => {
          const { subject, html, text } = get(name, locale);
          expect(subject.trim().length).toBeGreaterThan(0);
          expect(html).toContain("<html");
          expect(text.trim().length).toBeGreaterThan(0);
        });

        it("carries no untranslated key path", () => {
          const { subject, html } = get(name, locale);
          // next-intl renders `email.foo.bar` verbatim when a key is missing.
          expect(subject).not.toMatch(/email\.[a-zA-Z]+\./);
          expect(html).not.toMatch(/email\.[a-zA-Z]+\./);
        });

        it("uses Latin numerals and the Gregorian calendar", () => {
          const { subject, text } = get(name, locale);
          // Arabic-Indic digits ٠–٩ and the Hijri era mark هـ. Either one means
          // something formatted itself instead of going through format.ts —
          // or that ICU got a bare `ar` rather than the forced tag.
          expect(subject).not.toMatch(/[٠-٩۰-۹]/);
          expect(text).not.toMatch(/[٠-٩۰-۹]/);
          expect(text).not.toMatch(/هـ/);
        });

        it("carries the proposal disclaimer", () => {
          const { text } = get(name, locale);
          expect(text).toMatch(
            locale === "ar" ? /نموذج مقترح/ : /not an official service/,
          );
        });

        it("sets the reader's direction on the document", () => {
          const { html } = get(name, locale);
          expect(html).toContain(
            locale === "ar" ? 'dir="rtl"' : 'dir="ltr"',
          );
          expect(html).toContain(`lang="${locale}"`);
        });

        it("aligns to the reading direction, never to a physical side", () => {
          const { html } = get(name, locale);
          // `text-align: left` in an Arabic email is the exact defect these
          // templates exist to avoid; `start` resolves per `dir` instead.
          expect(html).toMatch(/text-align:\s*start/);
          expect(html).not.toMatch(/text-align:\s*(left|right)/);
        });

        it("contains no national ID, mobile number or token", () => {
          const { subject, text } = get(name, locale);
          const body = `${subject}\n${text}`;

          // A Saudi national ID / Iqama is 10 digits starting 1 or 2.
          expect(body).not.toMatch(/(?<!\d)[12]\d{9}(?!\d)/);
          // A Saudi mobile in any of the shapes a form accepts.
          expect(body).not.toMatch(/(?:\+?966|00966|0)5\d{8}/);
          // Session cookies and bearer tokens.
          expect(body).not.toMatch(/better-auth\.session_token|Bearer\s+\S+/i);
        });
      });
    }
  }
});

describe("the templates that carry a specific promise", () => {
  it("drone-approved contains the Remote ID code and the card link", () => {
    for (const locale of LOCALES) {
      const { text } = get("drone-approved", locale);
      expect(text).toContain(EMAIL_TEMPLATES["drone-approved"].sample.remoteIdCode);
      expect(text).toContain(EMAIL_TEMPLATES["drone-approved"].sample.cardUrl);
    }
  });

  it("drone-rejected quotes the reviewer's reason verbatim", () => {
    for (const locale of LOCALES) {
      const { text } = get("drone-rejected", locale);
      expect(text).toContain(EMAIL_TEMPLATES["drone-rejected"].sample.reason);
    }
  });

  it("booking-cancelled-by-authority quotes its reason and reads as urgent", () => {
    for (const locale of LOCALES) {
      const { text } = get("booking-cancelled-by-authority", locale);
      expect(text).toContain(
        EMAIL_TEMPLATES["booking-cancelled-by-authority"].sample.reason,
      );
      expect(text).toMatch(locale === "ar" ? /إشعار عاجل/ : /Urgent notice/);
    }
  });

  it("review-queue-digest carries counts and a link, and no pilot detail", () => {
    for (const locale of LOCALES) {
      const { text } = get("review-queue-digest", locale);
      expect(text).toContain("7");
      expect(text).toContain("12");
      expect(text).toContain(
        EMAIL_TEMPLATES["review-queue-digest"].sample.queueUrl,
      );
      // The nickname every other sample uses. Its absence here is the point:
      // a digest goes to someone who is not the subject of it.
      expect(text).not.toContain("الصقر");
      expect(text).not.toContain("AJN-4F2K-91XZ");
    }
  });

  it("renders the Riyadh slot time, not the server's", () => {
    // 11:00Z–13:00Z is 14:00–16:00 in Riyadh, year-round.
    for (const locale of LOCALES) {
      const { text } = get("booking-approved", locale);
      expect(text).toContain("14:00");
      expect(text).toContain("16:00");
    }
  });

  it("picks the Arabic plural category without Arabic-Indic digits", async () => {
    const cases: Array<[number, string]> = [
      [0, "ينتهي اليوم"],
      [1, "يوم واحد"],
      [2, "يومان"],
      [3, "3 أيام"],
      [30, "30 يوماً"],
    ];

    for (const [days, expected] of cases) {
      const { text } = await renderEmail(
        "drone-expiring",
        { ...EMAIL_TEMPLATES["drone-expiring"].sample, daysRemaining: days },
        "ar",
      );
      expect(text).toContain(expected);
    }
  });
});
