"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { GeometryDiffMap } from "./geometry-diff-map";

/**
 * Loads the boundary diff **client-side only** — the third of these boundaries
 * in the build, for the same two hard reasons as `MapMount` and `EditorMount`.
 *
 * MapLibre touches `window` at module scope, so a server render throws; and
 * `ssr: false` is not allowed inside a Server Component in this version of
 * Next, so the boundary has to be a client component of its own.
 *
 * It also keeps MapLibre out of the audit page's bundle until a row that
 * actually holds a boundary change is expanded — most of this log is text, and
 * an administrator scrolling it should not pay for a map engine to read it.
 */
const LazyGeometryDiffMap = dynamic(
  () => import("./geometry-diff-map").then((module) => module.GeometryDiffMap),
  {
    ssr: false,
    loading: () => (
      <div className="bg-card h-64 w-full animate-pulse rounded-lg border" />
    ),
  },
);

export function GeometryDiffMount(
  props: ComponentProps<typeof GeometryDiffMap>,
) {
  return <LazyGeometryDiffMap {...props} />;
}
