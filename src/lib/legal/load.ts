import type { ComponentType } from "react";
import { isLegalMeta, type LegalMeta, type LegalSlug } from "./documents";
import type { Locale } from "@/lib/locale";

/**
 * Loading one legal document.
 *
 * **The `.mdx` files are imported, not read** — the same call `src/lib/docs`
 * made and for the same reason: a `fs.readFile` of `src/content/…` works on
 * this machine and fails in a deployed function, where the source tree is not
 * part of the bundle. A dynamic `import()` is traced by the bundler; a path
 * built at runtime is not.
 *
 * The template literal has two variables in it, so both bundlers glob
 * `src/content/legal/*​/*.mdx` and include the lot. That is wanted here: with
 * F27b there are four small files, all public, none conditional.
 */

export type LoadedLegal = {
  slug: LegalSlug;
  meta: LegalMeta;
  Content: ComponentType;
};

/**
 * Throws on a missing or malformed `meta`, rather than rendering a policy with
 * an empty title and no table of contents. These files are hand-authored and
 * shipped in the bundle; a bad one is a build-time mistake, not a runtime state
 * a reader should be shown.
 */
export async function loadLegal(
  locale: Locale,
  slug: LegalSlug,
): Promise<LoadedLegal> {
  const mod = (await import(`@/content/legal/${locale}/${slug}.mdx`)) as {
    default: ComponentType;
    meta?: unknown;
  };
  if (!isLegalMeta(mod.meta)) {
    throw new Error(`content/legal/${locale}/${slug}.mdx exports no valid meta`);
  }
  return { slug, meta: mod.meta, Content: mod.default };
}
