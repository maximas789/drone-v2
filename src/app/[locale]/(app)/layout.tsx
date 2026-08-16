import { locale as localeParam } from "next/root-params";
import { requireUser } from "@/lib/auth-guards";
import { toLocale } from "@/lib/locale";

/**
 * The signed-in boundary.
 *
 * `src/proxy.ts` may have redirected already, but that check reads only whether
 * a cookie exists. **This** is what actually decides — and every server action
 * under here calls a guard of its own, because an action is reachable without
 * this layout ever rendering.
 */
export default async function AppLayout({ children }: LayoutProps<"/[locale]">) {
  await requireUser(toLocale(await localeParam()));

  return <div className="flex flex-1 flex-col">{children}</div>;
}
