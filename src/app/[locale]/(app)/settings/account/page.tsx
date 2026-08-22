import { getTranslations } from "next-intl/server";
import { locale as localeParam } from "next/root-params";
import { DeleteAccount } from "@/components/settings/delete-account";
import { requireUser } from "@/lib/auth-guards";
import { deletionBlock } from "@/lib/data/account-deletion";
import { formatDate } from "@/lib/format";
import { toLocale } from "@/lib/locale";

/**
 * `/settings/account` — closing the account.
 *
 * **The table of what goes and what stays is the page**, not fine print under
 * the button. Somebody deciding whether to close an account is deciding about
 * consequences, and the consequences here are genuinely mixed: the personal
 * record goes, the accountability record does not. Every line of it matches
 * `/privacy#how-long-we-keep-it` in substance — `legal.test.ts` asserts the
 * policy still says so.
 *
 * When `deletionBlock` returns a reason the control is **not rendered at all**
 * and the blocking bookings are named. A disabled button with a tooltip would
 * be the same information arranged so it can be missed.
 */
export default async function AccountSettingsPage() {
  const locale = toLocale(await localeParam());
  const session = await requireUser(locale);
  const t = await getTranslations("settings");

  const block = await deletionBlock(session);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{t("account.title")}</h2>
        <p className="text-muted-foreground text-sm">{t("account.intro")}</p>
      </header>

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-medium">{t("account.whatHappens")}</h3>
        <ul className="text-muted-foreground flex list-disc flex-col gap-2 ps-6 text-sm leading-7">
          <li>{t("account.deletedAccount")}</li>
          <li>{t("account.deletedDrones")}</li>
          <li>{t("account.deletedBookings")}</li>
          <li>{t("account.retainedRemoteId")}</li>
          <li>{t("account.retainedAudit")}</li>
        </ul>
        <p className="text-muted-foreground text-sm">
          {t("account.seePolicy")}
        </p>
      </div>

      {block === null ? (
        <DeleteAccount email={session.user.email} locale={locale} />
      ) : block.reason === "last_admin" ? (
        <p className="border-destructive/50 rounded-lg border p-4 text-sm">
          {t("account.blockedLastAdmin")}
        </p>
      ) : (
        <div className="border-destructive/50 flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm">{t("account.blockedBookings")}</p>
          {/**
           * The bookings, named. A pilot holding four cannot act on "you have
           * approved bookings"; they can act on a list with dates on it.
           */}
          <ul className="text-muted-foreground flex list-disc flex-col gap-1 ps-6 text-sm">
            {block.bookings.map((entry) => (
              <li key={entry.id}>
                {locale === "ar" ? entry.zoneNameAr : entry.zoneNameEn}
                {" — "}
                {formatDate(entry.slotStart, locale)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
