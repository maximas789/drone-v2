import { createElement } from "react";
import { render } from "react-email";
import { emailTranslator } from "@/lib/email/i18n";
import {
  EMAIL_TEMPLATES,
  type EmailTemplateName,
  type EmailTemplateParams,
} from "@/lib/email/templates";
import type { EmailTemplate } from "@/lib/email/types";
import type { Locale } from "@/lib/locale";

export type RenderedEmail = {
  subject: string;
  html: string;
  /** The plain-text alternative. Sent alongside the HTML, and it is also what
   *  gets printed to the terminal when there is no API key. */
  text: string;
};

/**
 * Renders a template in one locale. No database, no `server-only`, no request
 * context — the preview page, the test suite and `sendEmail` all call this
 * same function, so what `/dev/emails` shows is what actually gets sent.
 */
export async function renderEmail<K extends EmailTemplateName>(
  name: K,
  params: EmailTemplateParams[K],
  locale: Locale,
): Promise<RenderedEmail> {
  // The registry is a heterogeneous map; the generic above is what keeps the
  // call site honest, and this cast is where the two meet.
  const template = EMAIL_TEMPLATES[name] as unknown as EmailTemplate<
    EmailTemplateParams[K]
  >;

  const element = createElement(template.Body, { params, locale });

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  return {
    subject: template.subject(emailTranslator(locale), params),
    html,
    text,
  };
}
