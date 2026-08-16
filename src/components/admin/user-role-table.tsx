"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setUserRoleAction } from "@/lib/actions/user";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { ROLES, type Role } from "@/lib/session";

const REASON_KEY: Record<string, string> = {
  not_authenticated: "reasonNotAuthenticated",
  not_admin: "reasonNotAdmin",
  invalid_role: "reasonInvalidRole",
  user_not_found: "reasonUserNotFound",
  cannot_change_own_role: "reasonCannotChangeOwnRole",
};

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  createdAt: Date;
};

export function UserRoleTable({
  users,
  currentUserId,
  locale,
}: {
  users: UserRow[];
  currentUserId: string;
  locale: Locale;
}) {
  const t = useTranslations("admin");
  const tRoles = useTranslations("roles");
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{
    key: string;
    tone: "ok" | "error";
  } | null>(null);

  function onChangeRole(userId: string, role: string) {
    startTransition(async () => {
      const result = await setUserRoleAction(userId, role);
      if (result.ok) {
        setNotice({ key: "roleUpdated", tone: "ok" });
        return;
      }
      // Refusals come back as codes and get translated here — the same refusal
      // reads correctly in whichever language the reader picked.
      const code = result.reasons[0]?.code ?? "";
      setNotice({ key: REASON_KEY[code] ?? "reasonNotAdmin", tone: "error" });
    });
  }

  if (users.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("noUsers")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {notice ? (
        <p
          role={notice.tone === "ok" ? "status" : "alert"}
          className={
            notice.tone === "ok"
              ? "text-sm"
              : "text-destructive text-sm"
          }
        >
          {t(notice.key)}
        </p>
      ) : null}

      <ul className="flex flex-col divide-y">
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          return (
            <li
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {user.name}
                  {isSelf ? (
                    <Badge variant="secondary" className="ms-2">
                      {t("you")}
                    </Badge>
                  ) : null}
                </p>
                <p
                  className="text-muted-foreground truncate text-sm"
                  dir="ltr"
                >
                  {user.email}
                </p>
                <p className="text-muted-foreground text-sm">
                  {formatDate(user.createdAt, locale)}
                </p>
              </div>

              <form
                className="flex items-center gap-2"
                action={(formData) =>
                  onChangeRole(user.id, String(formData.get("role") ?? ""))
                }
              >
                <label className="sr-only" htmlFor={`role-${user.id}`}>
                  {t("changeRole")}
                </label>
                <select
                  id={`role-${user.id}`}
                  name="role"
                  defaultValue={user.role ?? "pilot"}
                  disabled={isSelf || pending}
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                >
                  {ROLES.map((role: Role) => (
                    <option key={role} value={role}>
                      {tRoles(role)}
                    </option>
                  ))}
                </select>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={isSelf || pending}
                >
                  {t("changeRole")}
                </Button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
