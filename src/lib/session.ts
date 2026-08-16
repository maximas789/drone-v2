import type { auth } from "@/lib/auth";

/**
 * The session shape the data layer is scoped by.
 *
 * `import type` on purpose — this module must stay free of any runtime
 * dependency on `src/lib/auth.ts`, which reaches the database. Every
 * `src/lib/data/*.ts` file imports `isReviewer` from here.
 */
export type Session = typeof auth.$Infer.Session;

export const ROLES = ["pilot", "reviewer", "admin"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  );
}

/**
 * Better Auth types an `additionalField` declared with a list of literals as a
 * plain `string`, and it is nullable in the row. Narrowing happens here, in one
 * place, and **fails closed**: anything unrecognised is treated as a pilot, so a
 * typo or a hand-edited row can never widen someone's access.
 */
export function roleOf(session: Session): Role {
  return isRole(session.user.role) ? session.user.role : "pilot";
}

/** Reviewers and admins both staff the queues; only admins manage the system. */
export function isReviewer(session: Session): boolean {
  const role = roleOf(session);
  return role === "reviewer" || role === "admin";
}

export function isAdmin(session: Session): boolean {
  return roleOf(session) === "admin";
}
