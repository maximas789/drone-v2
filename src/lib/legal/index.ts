/**
 * `@/lib/legal` resolves here, so the pages get the fields, the slugs and the
 * loader from one import.
 *
 * **`src/mdx-components.tsx` deliberately does not come through this barrel** —
 * it imports `./fields` directly. It is reached *from* a compiled `.mdx`
 * module, and `load.ts` imports those same modules back; going through the
 * barrel would close that loop. The `import()` is dynamic, so the cycle would
 * probably resolve, and "probably resolves" is not a property to build a build
 * on when a direct import costs nothing.
 */
export * from "./fields";
export * from "./documents";
export * from "./load";
