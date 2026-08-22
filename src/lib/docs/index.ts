/**
 * `@/lib/docs` resolves here. **`updated.ts` is deliberately not re-exported**
 * — it carries `server-only`, and `src/mdx-components.tsx` reaches `slugs.ts`
 * while rendering. One barrel pulling the git call into that graph is how a
 * pure helper stops being importable.
 */
export * from "./slugs";
export * from "./load";
