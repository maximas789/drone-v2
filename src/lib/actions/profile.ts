"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { refuse, refuseWith, type ActionResult } from "@/lib/actions/result";
import { audit, type Actor } from "@/lib/audit";
import { getSession } from "@/lib/auth-guards";
import { db, type DbExecutor } from "@/lib/db";
import { pilotProfile } from "@/lib/db/schema";
import { hashIdDocument } from "@/lib/id-hash";
import { clientIpFrom, hashIp } from "@/lib/ip-hash";
import { enforceLimit } from "@/lib/rate-limit";
import { maskIdDocument } from "@/lib/remote-id/redact";
import { uniqueViolationConstraint } from "@/lib/remote-id/issue";
import { roleOf } from "@/lib/session";
import {
  isProfileComplete,
  validateContact,
  validateIdentity,
  type ContactDraft,
  type IdentityDraft,
} from "@/lib/validation/profile";

/**
 * The two writes behind the profile wizard and the profile settings page.
 *
 * **One action per half, two surfaces each.** `saveIdentityAction` is step 2 of
 * the wizard *and* the identity section of `/settings/profile`; `saveContactAction`
 * is step 3 and the contact section. Splitting them by surface instead would
 * have put the "changing an ID clears verification" rule in two places, and a
 * rule with two homes is a rule that eventually only holds in one of them.
 *
 * Both follow the house prologue —
 * `guard → rateLimit → validate → write + audit in ONE transaction →
 * revalidatePath → { ok } | { ok: false, reasons }` — and both repeat the guard
 * that the layout already ran, because an action is an ordinary POST reachable
 * without the layout ever rendering.
 *
 * Neither returns a translated sentence, so neither needs `getTranslations` and
 * neither trips open thread 4: refusals leave here as codes and become words at
 * render, like every other refusal in this app.
 */

/** The constraint that says somebody else already registered this document. */
const ID_HASH_CONSTRAINT = "pilot_profile_idDocumentHash_unique";

export type ProfileSaved = {
  /** True once every field a booking decision needs is on the row. */
  completed: boolean;
  /**
   * True when this save invalidated a human verification — the pilot has to be
   * told, and told *before* they press save, which is why the UI warns and this
   * only confirms what happened.
   */
  verificationCleared: boolean;
};

/**
 * Steps 1 and 2 of the wizard: the names and the identity document.
 *
 * **Saved as one write.** `id_document_number` and `id_document_hash` are NOT
 * NULL, so there is no row that holds a name and no document — and loosening
 * those columns so a wizard could save half an identity would weaken a
 * regulator-facing record for the sake of a form. The wizard shows two panes
 * and creates the row when the second is answered.
 */
export async function saveIdentityAction(
  input: IdentityDraft,
): Promise<ActionResult<ProfileSaved>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");

  const limit = await enforceLimit("profile.save", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const checked = validateIdentity(input);
  if (!checked.ok) return refuse(...checked.problems);
  const value = checked.value;

  const idDocumentHash = hashIdDocument(value.idDocumentNumber);
  const actor: Actor = {
    userId: session.user.id,
    role: roleOf(session),
    isSystem: false,
  };
  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders);
  const ipHash = ip ? hashIp(ip) : null;
  const userAgent = requestHeaders.get("user-agent");

  try {
    const outcome = await db.transaction(async (tx) => {
      const existing = await tx.query.pilotProfile.findFirst({
        where: eq(pilotProfile.userId, session.user.id),
      });

      if (!existing) {
        const [row] = await tx
          .insert(pilotProfile)
          .values({
            userId: session.user.id,
            fullNameAr: value.fullNameAr,
            fullNameEn: value.fullNameEn,
            idDocumentType: value.idDocumentType,
            idDocumentNumber: value.idDocumentNumber,
            idDocumentHash,
            dateOfBirth: value.dateOfBirth,
          })
          .returning({ id: pilotProfile.id });

        if (!row) throw new Error("pilot_profile insert returned no row");

        await audit(tx, {
          actor,
          entityType: "pilot_profile",
          entityId: row.id,
          action: "pilot_profile.created",
          after: auditableIdentity(value),
          ipHash,
          userAgent,
        });

        // Never complete on creation: the contact half has not been asked yet.
        return { completed: false, verificationCleared: false };
      }

      /**
       * **The re-verification rule.** Changing the document or the date of
       * birth changes *who this row claims to be*, so a human verification of
       * the old claim no longer says anything about the new one. Names and
       * contact details do not trigger it — a spelling correction is not a new
       * person.
       */
      const identityChanged =
        existing.idDocumentNumber !== value.idDocumentNumber ||
        existing.idDocumentType !== value.idDocumentType ||
        existing.dateOfBirth !== value.dateOfBirth;
      const verificationCleared = identityChanged && existing.verifiedAt !== null;

      const merged = {
        ...existing,
        ...value,
      };
      const completed = isProfileComplete(merged);

      await tx
        .update(pilotProfile)
        .set({
          fullNameAr: value.fullNameAr,
          fullNameEn: value.fullNameEn,
          idDocumentType: value.idDocumentType,
          idDocumentNumber: value.idDocumentNumber,
          idDocumentHash,
          dateOfBirth: value.dateOfBirth,
          ...(identityChanged
            ? {
                verifiedAt: null,
                verifiedByUserId: null,
                /**
                 * A rejection is cleared too. It was a decision about the
                 * document that has just been replaced, and leaving it on the
                 * row would show a pilot "rejected: the number does not match
                 * your document" next to the number they have just corrected.
                 */
                rejectedAt: null,
                rejectionReason: null,
              }
            : {}),
          completedAt: completed ? (existing.completedAt ?? new Date()) : null,
          updatedAt: new Date(),
        })
        .where(eq(pilotProfile.id, existing.id));

      await audit(tx, {
        actor,
        entityType: "pilot_profile",
        entityId: existing.id,
        action: "pilot_profile.identity_updated",
        before: auditableIdentity(existing),
        after: auditableIdentity(value),
        ipHash,
        userAgent,
      });

      if (verificationCleared) {
        await audit(tx, {
          actor,
          entityType: "pilot_profile",
          entityId: existing.id,
          action: "pilot_profile.verification_cleared",
          before: { verifiedAt: existing.verifiedAt },
          after: { verifiedAt: null },
          // Not a translated sentence: a stable phrase in the regulator's trail,
          // which reads the same in either language because it is not language.
          reason: "identity_document_changed",
          ipHash,
          userAgent,
        });
      }

      await auditCompletion(tx, {
        actor,
        profileId: existing.id,
        wasComplete: existing.completedAt !== null,
        isComplete: completed,
        ipHash,
        userAgent,
      });

      return { completed, verificationCleared };
    });

    revalidateProfilePaths();
    return { ok: true, data: outcome };
  } catch (caught) {
    const constraint = uniqueViolationConstraint(caught);
    if (constraint === ID_HASH_CONSTRAINT) {
      /**
       * **Deliberately vague, and deliberately the same answer either way.**
       * The caller is told this document is registered and nothing about *who*
       * holds it — no email, no name, no hint that the holder is or is not
       * them. Anything more would turn this action into a lookup service for
       * "is this person on the platform".
       */
      return refuse("id_already_registered");
    }
    throw caught;
  }
}

/** Step 3 of the wizard, and the contact section of the settings page. */
export async function saveContactAction(
  input: ContactDraft,
): Promise<ActionResult<ProfileSaved>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");

  const limit = await enforceLimit("profile.save", "user", session.user.id);
  if (!limit.ok) {
    return refuseWith("rate_limited", {
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const checked = validateContact(input);
  if (!checked.ok) return refuse(...checked.problems);
  const value = checked.value;

  const actor: Actor = {
    userId: session.user.id,
    role: roleOf(session),
    isSystem: false,
  };
  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders);
  const ipHash = ip ? hashIp(ip) : null;
  const userAgent = requestHeaders.get("user-agent");

  const outcome = await db.transaction(async (tx) => {
    const existing = await tx.query.pilotProfile.findFirst({
      where: eq(pilotProfile.userId, session.user.id),
    });

    /**
     * No row means the identity step has not been answered. Refusing rather
     * than creating one is the same reasoning as the NOT NULL columns: a
     * profile that holds a mobile number and no identity is not a pilot.
     */
    if (!existing) return null;

    const completed = isProfileComplete({ ...existing, ...value });

    await tx
      .update(pilotProfile)
      .set({
        mobileE164: value.mobileE164,
        addressCityId: value.addressCityId,
        addressLine: value.addressLine,
        emergencyContact: value.emergencyContact,
        completedAt: completed ? (existing.completedAt ?? new Date()) : null,
        updatedAt: new Date(),
      })
      .where(eq(pilotProfile.id, existing.id));

    await audit(tx, {
      actor,
      entityType: "pilot_profile",
      entityId: existing.id,
      action: "pilot_profile.contact_updated",
      before: auditableContact(existing),
      after: auditableContact(value),
      ipHash,
      userAgent,
    });

    await auditCompletion(tx, {
      actor,
      profileId: existing.id,
      wasComplete: existing.completedAt !== null,
      isComplete: completed,
      ipHash,
      userAgent,
    });

    // Contact details say nothing about identity, so a human verification of
    // the document still stands. `verifiedAt` is untouched here on purpose.
    return { completed, verificationCleared: false };
  });

  if (!outcome) return refuse("profile_identity_first");

  revalidateProfilePaths();
  return { ok: true, data: outcome };
}

/**
 * `completedAt` crossing from unset to set is worth one event of its own.
 *
 * The field updates already say what changed; this says what it *meant* — the
 * moment an account became a pilot, which is the fact a regulator would look
 * for and the fact `pilot_profile_incomplete` refers to.
 */
async function auditCompletion(
  tx: DbExecutor,
  args: {
    actor: Actor;
    profileId: string;
    wasComplete: boolean;
    isComplete: boolean;
    ipHash: string | null;
    userAgent: string | null;
  },
): Promise<void> {
  if (args.wasComplete === args.isComplete) return;
  await audit(tx, {
    actor: args.actor,
    entityType: "pilot_profile",
    entityId: args.profileId,
    action: args.isComplete
      ? "pilot_profile.completed"
      : "pilot_profile.incompleted",
    before: { completed: args.wasComplete },
    after: { completed: args.isComplete },
    ipHash: args.ipHash,
    userAgent: args.userAgent,
  });
}

/**
 * What of an identity change is safe to write into the trail.
 *
 * **The document number is masked, in both `before` and `after`.** `audit.ts`
 * says never a full national ID, and a trail that carried one would be a second
 * copy of the thing the whole masking rule exists to keep in one place — one
 * with no reveal control in front of it and no delete path behind it. The mask
 * still answers the question the trail is for: which document, and did it
 * change.
 */
function auditableIdentity(row: {
  fullNameAr: string;
  fullNameEn: string;
  idDocumentType: string;
  idDocumentNumber: string;
  dateOfBirth: string | null;
}) {
  return {
    fullNameAr: row.fullNameAr,
    fullNameEn: row.fullNameEn,
    idDocumentType: row.idDocumentType,
    idDocumentNumberMasked: maskIdDocument(row.idDocumentNumber),
    dateOfBirth: row.dateOfBirth,
  };
}

function auditableContact(row: {
  mobileE164: string | null;
  addressCityId: string | null;
  addressLine: string | null;
  emergencyContact: string | null;
}) {
  return {
    mobileE164: row.mobileE164,
    addressCityId: row.addressCityId,
    addressLine: row.addressLine,
    emergencyContact: row.emergencyContact,
  };
}

/**
 * Both surfaces, because either action can be driven from either one — the
 * wizard and the settings page write the same row and must never disagree
 * about what is on it.
 *
 * The paths carry no locale prefix: `revalidatePath` matches the route, and the
 * route is `/[locale]/…`.
 */
function revalidateProfilePaths(): void {
  revalidatePath("/[locale]/(app)/profile/complete", "page");
  revalidatePath("/[locale]/(app)/settings/profile", "page");
}
