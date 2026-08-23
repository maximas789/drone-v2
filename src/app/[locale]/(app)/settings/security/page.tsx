import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { PasswordForm } from "@/components/settings/password-form";
import { SessionList } from "@/components/settings/session-list";
import { requireUser } from "@/lib/auth-guards";
import { listMySessions } from "@/lib/data/sessions";
import { emailConfigured } from "@/lib/email/config";
import { toLocale } from "@/lib/locale";
import type { Metadata } from "next";
import { privatePageTitle } from "@/lib/site/metadata";

/**
 * `/settings/security` — the password, and the devices holding a session.
 *
 * The email-address control is the interesting one, and it is **absent on
 * purpose with the reason written out**. Changing an address that people are
 * notified at is only safe if the new address can be verified first, and
 * verification is a message this build cannot send: `RESEND_API_KEY` has never
 * been set here. F28's criterion is precisely that this *explains itself*
 * rather than failing silently — so the address is shown, the control is not
 * offered, and the sentence says which of those two facts is the reason.
 *
 * `emailConfigured` is read at request time rather than baked in, so the same
 * build tells the truth on a deployment that does have a key.
 */
export default async function SecuritySettingsPage() {
  const locale = toLocale(await localeParam());
  const session = await requireUser(locale);
  const t = await getTranslations("settings");

  const sessions = await listMySessions(session);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">{t("security.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("security.intro")}</p>
        </header>
        <PasswordForm />
      </section>

      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h3 className="text-base font-medium">{t("security.emailTitle")}</h3>
          <p className="text-muted-foreground text-sm">
            {/* The address itself is a Latin run inside an Arabic sentence:
                isolated with <bdi>, never with dir on the paragraph. */}
            {t.rich("security.emailCurrent", {
              address: session.user.email,
              addr: (chunks) => <bdi dir="ltr">{chunks}</bdi>,
            })}
          </p>
        </header>
        <p className="text-muted-foreground text-sm">
          {emailConfigured
            ? t("security.emailChangeUnavailableBuild")
            : t("security.emailChangeUnavailableNoMail")}
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h3 className="text-base font-medium">
            {t("security.sessionsTitle")}
          </h3>
          <p className="text-muted-foreground text-sm">
            {t("security.sessionsIntro")}
          </p>
        </header>
        {sessions.ok ? (
          <SessionList sessions={sessions.sessions} locale={locale} />
        ) : (
          /**
           * **Not an error — a rule, stated.** Better Auth refuses to list
           * sessions for a session older than 24 hours, which is right: a
           * stolen laptop must not be able to enumerate the owner's other
           * devices days later. Before this branch existed the refusal was an
           * unhandled throw and the whole page rendered blank.
           */
          <p className="text-muted-foreground rounded-lg border p-4 text-sm">
            {t("security.sessionsNeedFreshSignIn")}
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * Its own tab title, from the same string this page renders as its heading.
 * `robots` comes from the route group's layout — see `PRIVATE_ROBOTS`.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/settings/security">): Promise<Metadata> {
  return privatePageTitle(toLocale((await params).locale), "settings.security.title");
}
