"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { ZoneMapEditor } from "./zone-map-editor";

/**
 * Loads the drawing editor **client-side only** — the admin twin of
 * `MapMount`.
 *
 * Two reasons, both hard requirements rather than optimisations. MapLibre and
 * terra-draw both touch `window` at module scope, so a server render throws;
 * and `ssr: false` is not allowed inside a Server Component in this version of
 * Next, so the boundary has to be a client component of its own. That is all
 * this file is.
 *
 * It is also what keeps terra-draw out of the pilot bundle. `/zones` imports
 * `MapMount`; nothing outside `(admin)` imports this.
 */
const LazyZoneMapEditor = dynamic(
  () => import("./zone-map-editor").then((module) => module.ZoneMapEditor),
  {
    ssr: false,
    loading: () => (
      <div className="bg-card h-[24rem] w-full animate-pulse rounded-lg border sm:h-[32rem]" />
    ),
  },
);

export function EditorMount(props: ComponentProps<typeof ZoneMapEditor>) {
  return <LazyZoneMapEditor {...props} />;
}
