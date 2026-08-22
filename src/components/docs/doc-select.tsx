"use client";

import { useRouter } from "@/i18n/navigation";
import { Select } from "@/components/ui/select";
import type { DocSlug } from "@/lib/docs/slugs";

/**
 * The sidebar at 375 px.
 *
 * A native `<select>`, for the reasons `src/components/ui/select.tsx` gives:
 * under `dir="rtl"` the browser puts the drop indicator on the correct side
 * without help, and on a phone this is the platform's own sheet.
 *
 * `useRouter` from `@/i18n/navigation`, never `next/navigation` — the latter
 * would push a path with no locale prefix and drop an Arabic reader into
 * English on their own docs page.
 */
export function DocSelect({
  items,
  current,
  label,
}: {
  items: readonly { slug: DocSlug; title: string }[];
  current: DocSlug;
  label: string;
}) {
  const router = useRouter();

  return (
    <label className="flex flex-col gap-1 md:hidden">
      <span className="text-muted-foreground text-xs">{label}</span>
      <Select
        value={current}
        onChange={(event) => router.push(`/docs/${event.target.value}`)}
      >
        {items.map((item) => (
          <option key={item.slug} value={item.slug}>
            {item.title}
          </option>
        ))}
      </Select>
    </label>
  );
}
