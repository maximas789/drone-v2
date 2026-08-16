/**
 * **No status change happens outside this folder.** An ESLint rule enforces it
 * by banning `.set({ status:` everywhere else.
 *
 * F08 built the system edges — the ones the clock drives. F14 adds every human
 * edge to `transitions.ts` and the role branch in `apply.ts`; see the notes in
 * both files for exactly what is owed.
 */
export * from "./apply";
export * from "./remote-id";
export * from "./transitions";
