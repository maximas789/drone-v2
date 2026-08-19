"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { AirspaceMap } from "./airspace-map";

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
 *
 * **It is a pass-through and nothing else.** The state — the tapped point, the
 * altitude, the chosen aircraft and time, and the decision — belongs to
 * `AirspaceExplorer`, which is an ordinary client component and therefore
 * renders the panel and the controls on the server pass as well. Only the map
 * itself has to wait for the browser, and only the map does.
 */
const LazyAirspaceMap = dynamic(
  () => import("./airspace-map").then((module) => module.AirspaceMap),
  {
    ssr: false,
    loading: () => (
      <div className="bg-card h-[26rem] w-full animate-pulse rounded-lg border sm:h-[32rem]" />
    ),
  },
);

export function MapMount(props: ComponentProps<typeof AirspaceMap>) {
  return <LazyAirspaceMap {...props} />;
}
