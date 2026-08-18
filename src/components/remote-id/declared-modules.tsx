import { useTranslations } from "next-intl";
import { DeclareModuleForm } from "@/components/remote-id/declare-module-form";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/locale";

/**
 * External and standard Remote ID modules the pilot has declared against this
 * registration, **with their verification state**.
 *
 * The state is the point. A declared module that no reviewer has looked at is
 * not evidence of anything, and a card that listed it plainly beside the
 * verified ones would let a pilot show an inspector a claim the app has never
 * checked — so an unverified row is marked, and a rejected one says so.
 *
 * **Superseded rows are not rendered here.** They are kept — the regulator's
 * question is "what was broadcasting on 3 March", which needs the history — but
 * the card answers "what is broadcasting now", and a list mixing the two would
 * read as several modules being live at once.
 *
 * The form that adds one is `DeclareModuleForm`, rendered underneath. It is a
 * client component and this is not, so the list stays a server render off the
 * owner-scoped reader.
 */
export function DeclaredModules({
  droneId,
  declarations,
  broadcastCapable,
  networkCapable,
  locale,
}: {
  droneId: string;
  declarations: Array<{
    id: string;
    kind: string;
    manufacturer: string | null;
    moduleSerial: string | null;
    docReference: string | null;
    validUntil: Date | null;
    verifiedAt: Date | null;
    rejectedAt: Date | null;
    supersededAt: Date | null;
  }>;
  broadcastCapable: boolean;
  networkCapable: boolean;
  locale: Locale;
}) {
  const t = useTranslations("remoteId.card");
  const tRid = useTranslations("remoteId");

  const active = declarations.filter((row) => row.supersededAt === null);

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-base font-medium">{t("modulesTitle")}</h2>

      {/**
       * What this aircraft broadcasts, from the columns on `remote_id` — true
       * of every registration, module or no module. It is what makes the empty
       * state below a statement of fact rather than an absence.
       */}
      <div className="flex flex-wrap gap-2">
        {broadcastCapable ? (
          <Badge variant="secondary">{tRid("broadcastRid")}</Badge>
        ) : null}
        {networkCapable ? (
          <Badge variant="secondary">{tRid("networkRid")}</Badge>
        ) : null}
      </div>

      {active.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("modulesEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {active.map((row) => (
            <li key={row.id} className="flex flex-col gap-1 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {t(`moduleKinds.${row.kind}`)}
                </span>
                <ModuleState
                  verifiedAt={row.verifiedAt}
                  rejectedAt={row.rejectedAt}
                />
              </div>

              {row.manufacturer ? (
                <span dir="auto" className="text-muted-foreground text-start text-sm">
                  {row.manufacturer}
                </span>
              ) : null}

              {/* A module serial is a manufacturer's string: Latin, LTR, mono. */}
              {row.moduleSerial ? (
                <span dir="ltr" className="text-start font-mono text-xs">
                  {row.moduleSerial}
                </span>
              ) : null}

              {row.docReference ? (
                <span className="text-muted-foreground text-xs">
                  {t("moduleDoc", { reference: row.docReference })}
                </span>
              ) : null}

              {row.validUntil ? (
                <span className="text-muted-foreground text-xs">
                  {t("validUntil")}: {formatDate(row.validUntil, locale)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <DeclareModuleForm droneId={droneId} locale={locale} />
    </section>
  );
}

function ModuleState({
  verifiedAt,
  rejectedAt,
}: {
  verifiedAt: Date | null;
  rejectedAt: Date | null;
}) {
  const t = useTranslations("remoteId.card");

  if (rejectedAt) {
    return <Badge variant="destructive">{t("moduleRejected")}</Badge>;
  }
  if (verifiedAt) return <Badge>{t("moduleVerified")}</Badge>;
  // The default, and the one that must never look like the verified one.
  return <Badge variant="outline">{t("modulePending")}</Badge>;
}
