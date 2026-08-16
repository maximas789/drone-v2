import "server-only";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { emailLog } from "@/lib/db/schema";
import { EMAIL_FROM, emailConfigured } from "@/lib/email/config";
import { renderEmail } from "@/lib/email/render";
import type {
  EmailTemplateName,
  EmailTemplateParams,
} from "@/lib/email/templates";
import type { Locale } from "@/lib/locale";

/**
 * The only file in the app that talks to Resend.
 *
 * **Nothing sends until it is logged.** The `email_log` row is written before
 * the network call and updated after it, so a message that never arrived has a
 * record inside the app rather than only on a hosting dashboard that keeps 30
 * days of history.
 *
 * **This never throws.** A failed email must not roll back an approval: the
 * decision is the transaction, the email is a consequence of it. Every failure
 * path here ends in a returned status and a logged row.
 *
 * The three states are decided by whether `RESEND_API_KEY` is set, not by
 * `NODE_ENV` — so nothing has to be remembered at deploy time:
 *
 *   no key            → render it, print it, log `skipped`. Nothing breaks.
 *   key, unverified   → Resend delivers to the account owner only; anyone
 *                       else's address comes back as `failed` with Resend's
 *                       own error, which is exactly what should be recorded.
 *   key, verified     → normal delivery.
 */

export type EmailStatus = "queued" | "skipped" | "sent" | "failed";

export type SendEmailResult = {
  status: EmailStatus;
  /** `null` only if the log row itself could not be written. */
  logId: string | null;
  providerMessageId?: string;
  error?: string;
};

export type SendEmailArgs<K extends EmailTemplateName> = {
  to: string;
  template: K;
  params: EmailTemplateParams[K];
  /**
   * **The recipient's** locale, never the sender's. A reviewer working in
   * English who approves an Arabic-speaking pilot's drone sends an Arabic
   * email. Callers read it from `user.preferredLocale`.
   */
  locale: Locale;
  /** Whose account this concerns, for the in-app log. Nullable: a password
   *  reset for an address with no account has nobody to attribute. */
  userId?: string | null;
  /** The drone / booking / zone the message is about, for the same reason. */
  entityId?: string | null;
};

const resend = emailConfigured
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendEmail<K extends EmailTemplateName>({
  to,
  template,
  params,
  locale,
  userId = null,
  entityId = null,
}: SendEmailArgs<K>): Promise<SendEmailResult> {
  let logId: string | null = null;

  try {
    const rendered = await renderEmail(template, params, locale);

    const [row] = await db
      .insert(emailLog)
      .values({
        userId,
        toAddress: to,
        subject: rendered.subject,
        template,
        locale,
        entityId,
        status: "queued",
      })
      .returning({ id: emailLog.id });

    logId = row?.id ?? null;

    if (!resend) {
      printToTerminal({ to, locale, template, rendered, logId });
      await setStatus(logId, { status: "skipped" });
      return { status: "skipped", logId };
    }

    const { data, error } = await resend.emails.send(
      {
        from: EMAIL_FROM,
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      },
      // Second argument, not a field in the payload — put it in the payload and
      // it is ignored, and a retried send goes out twice. The log row's id is
      // the natural key: one row, one message.
      { idempotencyKey: `${template}/${logId ?? crypto.randomUUID()}` },
    );

    // `resend.emails.send()` does **not** throw on an API error; it returns
    // `{ data, error }`. A try/catch alone would swallow every rejected send —
    // unverified domain, over quota, suppressed address — as a success.
    if (error) {
      await setStatus(logId, { status: "failed", error: error.message });
      return { status: "failed", logId, error: error.message };
    }

    await setStatus(logId, {
      status: "sent",
      providerMessageId: data?.id ?? null,
      sentAt: new Date(),
    });

    return { status: "sent", logId, providerMessageId: data?.id };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    console.error(`[email] ${template} → ${to} failed: ${message}`);
    await setStatus(logId, { status: "failed", error: message });
    return { status: "failed", logId, error: message };
  }
}

async function setStatus(
  logId: string | null,
  values: {
    status: EmailStatus;
    error?: string;
    providerMessageId?: string | null;
    sentAt?: Date;
  },
): Promise<void> {
  if (!logId) return;
  try {
    await db.update(emailLog).set(values).where(eq(emailLog.id, logId));
  } catch (caught) {
    // The send already happened, or already failed. Losing the status update
    // is worth strictly less than throwing into whatever called us.
    console.error(`[email] could not update log ${logId}:`, caught);
  }
}

/**
 * The no-key path. Prints the **plain-text render**, not a summary: the link
 * in it is the real link, clickable in most terminals, which is what makes
 * sign-up and password reset work end to end on day one with no account
 * anywhere.
 */
function printToTerminal({
  to,
  locale,
  template,
  rendered,
  logId,
}: {
  to: string;
  locale: Locale;
  template: string;
  rendered: { subject: string; text: string };
  logId: string | null;
}): void {
  console.info(
    [
      "",
      "──────────── email (not sent — RESEND_API_KEY is empty) ────────────",
      `to:       ${to}`,
      `template: ${template}   locale: ${locale}`,
      `subject:  ${rendered.subject}`,
      `log row:  ${logId ?? "(not written)"}`,
      "",
      rendered.text,
      "────────────────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}
