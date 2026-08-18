"use client";

import dynamic from "next/dynamic";
import type { Locale } from "@/lib/locale";
import type { DrawableZone } from "@/lib/maps/layer-styles";

/**
 * Loads the map **client-side only**.
 *
 * MapLibre reaches for `window`, `document` and a WebGL context at module
 * scope, so importing it during a server render throws. `ssr: false` keeps it
 * out of that pass entirely — and keeps ~800 kB of map engine out of the
 * initial payload of a page whose first job is to be readable.
 *
 * **This wrapper is a client component itself, deliberately.** In this version
 * of Next, `ssr: false` is not allowed in a Server Component, so a server page
 * cannot call `dynamic` directly. Putting the boundary here means `/zones`
 * stays a server component and the whole zone list is still server-rendered.
 */
const AirspaceMap = dynamic(
  () => import("./airspace-map").then((module) => module.AirspaceMap),
  {
    ssr: false,
    loading: () => (
      <div className="bg-card h-[26rem] w-full animate-pulse rounded-lg border sm:h-[32rem]" />
    ),
  },
);

export function MapMount(props: {
  initialZones: readonly DrawableZone[];
  locale: Locale;
  labels: { tileFailure: string; loading: string; mapLabel: string };
  className?: string;
}) {
  return <AirspaceMap {...props} />;
}
