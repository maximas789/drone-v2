"use server";

import { revalidatePath } from "next/cache";
import { refuse, type ActionResult } from "@/lib/actions/result";
import { getSession } from "@/lib/auth-guards";
import { setUserRole } from "@/lib/data/user";
import { isAdmin, isRole, type Role } from "@/lib/session";

/**
 * Assign a role. The only path there is — there is no self-service escalation,
 * and `role` is `input: false` in `src/lib/auth.ts` so the ordinary
 * update-user endpoint cannot touch it.
 *
 * The guard is repeated here **on purpose**. `(admin)/layout.tsx` already calls
 * `requireReviewer`, but a server action is an ordinary POST to a URL: it can
 * be invoked with `fetch` by anyone who knows the action id, and the layout
 * never runs. A layout guard protects a page, never an action.
 *
 * Missing from the standard chain: `rateLimit()`, which F09 owns, and a zod
 * schema — the whole input is one identifier and one enum, and `isRole` is
 * already the narrowing function the rest of the app uses.
 */
export async function setUserRoleAction(
  targetUserId: string,
  role: string,
): Promise<ActionResult<{ id: string; role: Role }>> {
  const session = await getSession();
  if (!session) return refuse("not_authenticated");
  if (!isAdmin(session)) return refuse("not_admin");
  if (!isRole(role)) return refuse("invalid_role");

  // An admin who demotes themselves by mistake locks the system's only
  // administrator out of role management entirely, with no way back in.
  if (targetUserId === session.user.id) return refuse("cannot_change_own_role");

  const updated = await setUserRole(session, targetUserId, role);
  if (!updated) return refuse("user_not_found");

  revalidatePath("/[locale]/admin", "page");

  return { ok: true, data: { id: updated.id, role } };
}
