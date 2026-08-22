import type { ComponentType } from "react";
import { DOC_SLUGS, isDocMeta, type DocMeta, type DocSlug } from "./slugs";
import type { Locale } from "@/lib/locale";

/**
 * Loading one documentation page, and the whole ordered set.
 *
 * **The `.mdx` files are imported, not read.** A `fs.readFile` of
 * `src/content/…` works on this machine and fails in a deployed function, where
 * the source tree is not part of the bundle — only what the bundler traced is.
 * A dynamic `import()` is traced, which is why every fact this module returns
 * comes out of the module itself rather than off the disk beside it.
 *
 * The template literal has two variables in it. Both bundlers turn that into a
 * glob over `src/content/docs/*​/*.mdx` and include the lot, which is exactly
 * what is wanted here: twelve small files, all of them public, none of them
 * conditional.
 */

export type LoadedDoc = {
  slug: DocSlug;
  meta: DocMeta;
  Content: ComponentType;
};

async function importDoc(locale: Locale, slug: DocSlug) {
  return (await import(`@/content/docs/${locale}/${slug}.mdx`)) as {
    default: ComponentType;
    meta?: unknown;
  };
}

/**
 * Throws on a missing or malformed `meta`, rather than rendering a page with an
 * empty title. A documentation file is authored by hand and shipped in the
 * bundle; a bad one is a build-time mistake to fix, not a runtime state the
 * reader should have to look at.
 */
export async function loadDoc(
  locale: Locale,
  slug: DocSlug,
): Promise<LoadedDoc> {
  const mod = await importDoc(locale, slug);
  if (!isDocMeta(mod.meta)) {
    throw new Error(`content/docs/${locale}/${slug}.mdx exports no valid meta`);
  }
  return { slug, meta: mod.meta, Content: mod.default };
}

/** Every page, in `order`. The sidebar, the index and F30's manifest share it. */
export async function listDocs(locale: Locale): Promise<LoadedDoc[]> {
  const docs = await Promise.all(
    DOC_SLUGS.map((slug) => loadDoc(locale, slug)),
  );
  return docs.sort((a, b) => a.meta.order - b.meta.order);
}
