import { getTranslations } from "next-intl/server";
import { RevokeSessionButton } from "@/components/settings/revoke-session-button";
import { formatDateTime } from "@/lib/format";
import type { SessionSummary } from "@/lib/data/sessions";
import type { Locale } from "@/lib/locale";

/**
 * The devices signed in to this account.
 *
 * A Server Component: the rows are read on the server and only the revoke
 * button is a client boundary. There is nothing interactive about a row.
 *
 * **The current session is labelled and carries no button.** It is first in the
 * list (`listMySessions` sorts it there) so the row somebody must not revoke is
 * the row they see first, and the server refuses it besides — a missing button
 * is a courtesy, `revokeSessionAction` is the check.
 */
export async function SessionList({
  sessions,
  locale,
}: {
  sessions: readonly SessionSummary[];
  locale: Locale;
}) {
  const t = await getTranslations("settings");

  return (
    <ul className="flex flex-col gap-2">
      {sessions.map((entry) => {
        const { browser, platform } = entry.device;
        const label =
          browser && platform
            ? t("security.deviceBoth", { browser, platform })
            : (browser ?? platform ?? t("security.deviceUnknown"));

        return (
          <li
            key={entry.token}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {label}
                {entry.isCurrent ? (
                  <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs font-normal">
                    {t("security.currentSession")}
                  </span>
                ) : null}
              </span>
              <span className="text-muted-foreground text-xs">
                {t("security.lastActive", {
                  when: formatDateTime(entry.lastActive, locale),
                })}
              </span>
              {entry.ipAddress ? (
                /**
                 * `<bdi>`, not `dir="ltr"` on the row. An IPv4 address is a
                 * Latin run inside an Arabic sentence, and the label around it
                 * is Arabic — putting `dir="ltr"` on the container would
                 * reorder the words, which is the trap the booking slot times
                 * already cost a session over. Isolating the address alone is
                 * the fix.
                 */
                <span className="text-muted-foreground text-xs">
                  {t.rich("security.fromAddress", {
                    address: entry.ipAddress,
                    addr: (chunks) => <bdi dir="ltr">{chunks}</bdi>,
                  })}
                </span>
              ) : null}
            </div>

            {entry.isCurrent ? null : (
              <RevokeSessionButton token={entry.token} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
