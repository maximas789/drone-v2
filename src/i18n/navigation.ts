import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * The **only** sanctioned navigation primitives in this app.
 *
 * `next/link` and `next/navigation` are banned everywhere outside `src/i18n/`
 * by an ESLint rule. A bare `next/link` drops the locale prefix, so an Arabic
 * reader clicking it silently lands in English — a bug that looks like a
 * translation gap and gets "fixed" in the wrong place.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
