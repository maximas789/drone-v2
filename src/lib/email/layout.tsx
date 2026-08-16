import type { ReactNode } from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";
import { emailTranslator } from "@/lib/email/i18n";
import { direction, type Locale } from "@/lib/locale";
import { APP_URL, localeUrl } from "@/lib/url";

/**
 * The shell every template renders inside.
 *
 * **Direction goes on the elements, not in a stylesheet.** Gmail strips
 * `<style>` blocks, Outlook renders through Word, and neither can be relied on
 * for `[dir="rtl"] { … }`. So `dir` is set on `<html>` *and* on the container,
 * and every block carries an inline `textAlign: "start"` — which resolves
 * against the nearest `dir` and is therefore right-aligned in Arabic and
 * left-aligned in English without a second rule.
 *
 * No web font is loaded. A font that fails to load in a mail client falls back
 * silently, and every client that renders Arabic already has a face for it.
 */

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans Arabic", "Geeza Pro", Tahoma, Arial, sans-serif';

export const ink = {
  text: "#18181b",
  muted: "#52525b",
  faint: "#71717a",
  line: "#e4e4e7",
  panel: "#f4f4f5",
  brand: "#0f4c3a",
  urgent: "#991b1b",
  urgentPanel: "#fef2f2",
} as const;

export const baseText = {
  fontFamily: FONT_STACK,
  fontSize: "15px",
  lineHeight: "1.75",
  color: ink.text,
  textAlign: "start",
  margin: "0 0 14px",
} as const;

export const mutedText = {
  ...baseText,
  fontSize: "13px",
  color: ink.muted,
} as const;

/**
 * A label/value row.
 *
 * `ltr` marks a value that must not be re-ordered by the surrounding Arabic:
 * a Remote ID code, a `14:00 – 16:00` range. Bidi reordering moves the digits
 * and the dashes around a code and turns `AJN-4F2K-91XZ` into something a
 * reader would type back wrongly. The value stays start-aligned either way, so
 * it still sits under its label.
 */
export function Field({
  label,
  ltr = false,
  children,
}: {
  label: string;
  ltr?: boolean;
  children: ReactNode;
}) {
  return (
    <Section style={{ margin: "0 0 10px" }}>
      <Text style={{ ...mutedText, margin: "0 0 2px" }}>{label}</Text>
      <Text style={{ ...baseText, margin: 0, fontWeight: 600 }}>
        {ltr ? (
          // `dir` on the <span>, not on the <Text>: the value keeps the
          // paragraph's own alignment (right, in Arabic) while its internal
          // character order is isolated from the surrounding bidi run.
          <span dir="ltr" style={{ unicodeBidi: "isolate", display: "inline-block" }}>
            {children}
          </span>
        ) : (
          children
        )}
      </Text>
    </Section>
  );
}

/** The one call-to-action per email, as a real anchor — `<Button>` renders a
 *  table in some clients and loses `dir`, and a link never fails to be a link. */
export function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Section style={{ margin: "22px 0" }}>
      <Link
        href={href}
        style={{
          backgroundColor: ink.brand,
          borderRadius: "6px",
          color: "#ffffff",
          display: "inline-block",
          fontFamily: FONT_STACK,
          fontSize: "15px",
          fontWeight: 600,
          padding: "12px 22px",
          textDecoration: "none",
        }}
      >
        {label}
      </Link>
      {/* Every mail client eventually eats a button. The bare URL below is why
          nobody has to ask for the link to be resent. */}
      <Text style={{ ...mutedText, margin: "10px 0 0", wordBreak: "break-all" }}>
        {href}
      </Text>
    </Section>
  );
}

export function EmailLayout({
  locale,
  preview,
  heading,
  urgent = false,
  children,
}: {
  locale: Locale;
  preview: string;
  heading: string;
  urgent?: boolean;
  children: ReactNode;
}) {
  const t = emailTranslator(locale);
  const dir = direction(locale);

  return (
    <Html lang={locale} dir={dir}>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: ink.panel,
          fontFamily: FONT_STACK,
          margin: 0,
          padding: "24px 0",
        }}
      >
        <Container
          dir={dir}
          style={{
            backgroundColor: "#ffffff",
            border: `1px solid ${ink.line}`,
            borderRadius: "8px",
            margin: "0 auto",
            maxWidth: "560px",
            padding: "28px",
            textAlign: "start",
          }}
        >
          <Text
            style={{
              ...mutedText,
              margin: "0 0 18px",
              fontWeight: 600,
              letterSpacing: "normal",
              color: ink.brand,
            }}
          >
            {t("common.appName")}
          </Text>

          {urgent ? (
            <Section
              style={{
                backgroundColor: ink.urgentPanel,
                borderRadius: "6px",
                marginBottom: "16px",
                padding: "10px 14px",
              }}
            >
              <Text
                style={{ ...mutedText, color: ink.urgent, margin: 0, fontWeight: 600 }}
              >
                {t("common.urgent")}
              </Text>
            </Section>
          ) : null}

          <Heading
            as="h1"
            style={{
              ...baseText,
              fontSize: "20px",
              fontWeight: 700,
              lineHeight: "1.5",
              margin: "0 0 16px",
            }}
          >
            {heading}
          </Heading>

          {children}

          <Hr style={{ borderColor: ink.line, margin: "26px 0 16px" }} />

          {/* The honesty constraint, on every single message that leaves the
              app. An email is the one surface a reader sees with no page
              around it to carry the disclaimer. */}
          <Text style={{ ...mutedText, color: ink.faint, margin: "0 0 6px" }}>
            {t("common.proposalNotice")}
          </Text>
          <Text style={{ ...mutedText, color: ink.faint, margin: 0 }}>
            {t("common.sentBy")}{" "}
            <Link href={localeUrl("/", locale)} style={{ color: ink.faint }}>
              {APP_URL.replace(/^https?:\/\//, "")}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
