"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const t = useTranslations("nav");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        // Refresh first: every server component above still holds a render
        // made with the session that has just been thrown away.
        router.refresh();
        router.push("/");
      }}
    >
      {t("signOut")}
    </Button>
  );
}
