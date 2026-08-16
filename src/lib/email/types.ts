import type { ReactElement } from "react";
import type { EmailTranslator } from "@/lib/email/i18n";
import type { Locale } from "@/lib/locale";

/**
 * A template is a subject line and a body, both of which take the **recipient's**
 * locale — never the locale of whoever triggered the send. A reviewer working
 * in English who approves an Arabic-speaking pilot's drone sends an Arabic
 * email, and `email_log.locale` records which was used.
 *
 * `sample` exists so `/dev/emails` can render every template without inventing
 * arguments per template, and so a new template cannot be added without
 * someone deciding what it looks like filled in.
 */
export type EmailTemplate<P> = {
  subject: (t: EmailTranslator, params: P) => string;
  Body: (props: { params: P; locale: Locale }) => ReactElement;
  sample: P;
};

/** Identity, but it pins `P` from `sample` so each template file stays typed. */
export function defineTemplate<P>(template: EmailTemplate<P>): EmailTemplate<P> {
  return template;
}
