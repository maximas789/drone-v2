/**
 * The session shape the data layer is scoped by.
 *
 * **Provisional (F03).** F05 replaces this with Better Auth's inferred session
 * type and adds the `requireUser` / `requireReviewer` / `requireAdmin` guards.
 * It is declared here only so `src/lib/data/*.ts` can take a session as its
 * first argument from the very first query — retrofitting that argument later
 * across a finished data layer is how ownership checks get missed.
 */
export type Role = "pilot" | "reviewer" | "admin";

export type Session = {
  user: {
    /** Better Auth's `user.id`. Text, never uuid. */
    id: string;
    role: Role;
  };
};

/** Reviewers and admins both staff the queues; only admins manage the system. */
export function isReviewer(session: Session): boolean {
  return session.user.role === "reviewer" || session.user.role === "admin";
}

export function isAdmin(session: Session): boolean {
  return session.user.role === "admin";
}
