import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/format";
import type { EmailLogRow } from "@/lib/ops/email-log";
import type { Locale } from "@/lib/locale";

/**
 * Every send, and why a failed one failed.
 *
 * **`skipped` is styled apart from `failed`, not merely labelled apart.** They
 * are different events — *nobody configured mail* versus *the provider refused*
 * — and an operator scanning a column of red rows will debug the first as if it
 * were the second. `skipped` is muted; only `failed` is destructive.
 *
 * The recipient address, the provider id and the error are all Latin runs
 * inside an Arabic page, so each is isolated with `<bdi dir="ltr">` rather than
 * the row being given a direction — putting `dir` on the row would reorder the
 * Arabic labels around them.
 */

const STATUS_TONE: Record<string, string> = {
  sent: "text-muted-foreground",
  queued: "text-muted-foreground",
  // Not destructive: nothing broke, mail was simply never configured.
  skipped: "text-muted-foreground",
  failed: "text-destructive",
};

export async function EmailLogPanel({
  rows,
  locale,
}: {
  rows: EmailLogRow[];
  locale: Locale;
}) {
  const t = await getTranslations("ops");

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border p-4 text-sm">
        {t("email.none")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium">{row.subject}</span>
            <span className={`text-xs ${STATUS_TONE[row.status] ?? ""}`}>
              {t(`email.status.${row.status}`)}
            </span>
          </div>

          <dl className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <div className="flex gap-1">
              <dt>{t("email.col.to")}</dt>
              <dd>
                <bdi dir="ltr">{row.toAddress}</bdi>
              </dd>
            </div>
            <div className="flex gap-1">
              <dt>{t("email.col.template")}</dt>
              <dd>
                <bdi dir="ltr" className="font-mono">
                  {row.template}
                </bdi>
              </dd>
            </div>
            <div className="flex gap-1">
              <dt>{t("email.col.locale")}</dt>
              <dd>
                <bdi dir="ltr">{row.locale}</bdi>
              </dd>
            </div>
            <div className="flex gap-1">
              <dt>{t("email.col.at")}</dt>
              <dd>{formatDateTime(row.sentAt ?? row.createdAt, locale)}</dd>
            </div>
            {row.providerMessageId ? (
              <div className="flex gap-1">
                <dt>{t("email.col.providerId")}</dt>
                <dd>
                  <bdi dir="ltr" className="font-mono">
                    {row.providerMessageId}
                  </bdi>
                </dd>
              </div>
            ) : null}
          </dl>

          {/**
           * The loop: from this row back to the in-app notification that went
           * with it, and on to the record it was about. Rendered only when the
           * link exists — a dead "view notification" on a password-reset mail
           * would be worse than no link.
           */}
          {row.notificationId ? (
            <p className="text-xs">
              {t("email.accompanied")}{" "}
              <Link
                href="/notifications"
                className="text-primary underline underline-offset-4"
              >
                {t("email.viewNotifications")}
              </Link>
            </p>
          ) : null}

          {row.error ? (
            <pre
              dir="ltr"
              className="bg-destructive/5 max-h-40 overflow-auto rounded p-2 text-start font-mono text-xs whitespace-pre-wrap"
            >
              {row.error}
            </pre>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
