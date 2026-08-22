"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { audit, type Actor } from "@/lib/audit";
import { refuse, refuseWith, type ActionResult } from "@/lib/actions/result";
import { getSession } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { pilotProfile } from "@/lib/db/schema";
import { user } from "@/lib/db/auth-schema";
import { clientIpFrom, hashIp } from "@/lib/ip-hash";
import { isLocale, type Locale } from "@/lib/locale";
import { enforceLimit } from "@/lib/rate-limit";
import { roleOf, type Session } from "@/lib/session";

function actorFrom(session: Session): Actor {
  return { userId: session.user.id, role: roleOf(session), isSystem: false };
}

/**
 * Set the language this account's **email and notifications** follow.
 *
 * The locale switcher in the header changes the URL and nothing else, which is
 * right for reading: a pilot comparing a refusal reason in the other language
 * should not thereby change what language their approval notice arrives in.
 * `user.preferredLocale` is the durable choice, and this is the only thing that
 * writes it after sign-up.
 *
 * Not audited. `audit_event` is the **regulator's** trail — F14's rule is that
 * it records decisions about registrations, bookings and identities. A pilot
 * choosing to read in English is none of those, and writing it there would
 * dilute a log whose value is that everything in it matters.
 */
export async function setPreferredLocaleAction(
  next: string,
): Promise<ActionResult<{ locale: Locale }>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");

  const limit = await enforceLimit("settings.save", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  if (!isLocale(next)) return refuse("invalid_locale");

  await db
    .update(user)
    .set({ preferredLocale: next })
    .where(eq(user.id, session.user.id));

  // Every signed-in page can show it; the layout reads the session on each.
  revalidatePath("/[locale]", "layout");
  return { ok: true, data: { locale: next } };
}

export type RevealedOwnIdentity = {
  idDocumentType: string;
  idDocumentNumber: string;
};

/**
 * Show the owner their **own** identity document number, whole.
 *
 * ```
 * getSession → rateLimit(identity.reveal)
 *   → audit_event 'pilot_profile.identity_revealed'  ← BEFORE the return
 *   → the unmasked number
 * ```
 *
 * **The sibling of `revealPilotIdentityAction`, not a widening of it.** That
 * one is a reviewer looking at somebody else and it demands a written reason,
 * because the trail has to answer *why* a stranger's identity was exposed.
 * Asking a person to justify seeing their own number, to themselves, would be
 * a form with no reader — so this one takes **no argument at all**. There is
 * nothing to pass, which means there is no identifier to tamper with: the only
 * row it can ever return is the session's own.
 *
 * **The audit write happens first, in its own transaction.** If it fails the
 * reveal fails and nothing comes back. F11 established this by forcing the
 * write to fail, and the property has to hold on every path to a whole document
 * number or it is not a property. That is also what keeps `MaskedId`'s claim
 * true: no screen renders a full national ID *without a logged reveal*, and
 * this reveal is logged.
 *
 * It is deliberately the **same** `pilot_profile.identity_revealed` action as
 * the reviewer's. An admin auditing reveals wants one query, and the actor on
 * the row already says whether it was the owner or a stranger.
 */
export async function revealOwnIdentityAction(): Promise<
  ActionResult<RevealedOwnIdentity>
> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");

  const limit = await enforceLimit("identity.reveal", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const profile = await db.query.pilotProfile.findFirst({
    where: eq(pilotProfile.userId, session.user.id),
  });
  if (!profile) return refuse("not_found");

  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders);

  try {
    await db.transaction(async (tx) => {
      await audit(tx, {
        actor: actorFrom(session),
        entityType: "pilot_profile",
        entityId: profile.id,
        action: "pilot_profile.identity_revealed",
        /**
         * **The number itself is never in the audit row.** `before`/`after`
         * hold what changed, and nothing changed — a reveal is a read. Copying
         * the document number into the log would put a second, permanent,
         * unmasked copy of it in the one table the app never deletes from.
         */
        reason: "owner",
        ipHash: ip ? hashIp(ip) : null,
        userAgent: requestHeaders.get("user-agent"),
      });
    });
  } catch {
    return refuse("reveal_not_logged");
  }

  return {
    ok: true,
    data: {
      idDocumentType: profile.idDocumentType,
      idDocumentNumber: profile.idDocumentNumber,
    },
  };
}
