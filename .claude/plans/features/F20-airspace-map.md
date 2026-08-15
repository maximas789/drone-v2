# F20 — Interactive Airspace Map

**Wave:** 6 · **Depends on:** [F12](./F12-airspace-engine.md), [F04](./F04-riyadh-seed-data.md)

## Purpose

The screen that makes default-deny airspace comprehensible at a glance, and answers "can I fly here?" the moment a pilot taps — the Aloft one-tap pattern, without an API key.

## Technical design

### Stack

**MapLibre GL JS + OpenFreeMap** — open source engine, free vector tiles, **no API key and no billing account**, so the app works for anyone who clones it.

`terra-draw` (MapLibre adapter) for admin drawing in [F23](./F23-zone-management.md); the pilot map is read-only plus a point marker.

### Arabic labels and RTL text

Two separate things, both required:

1. **`setRTLTextPlugin()`** must be called **once, before the first map instance**, or Arabic labels render with letters disconnected and in reverse order. A module-level singleton guard handles this; calling it twice throws.
2. **Label language** comes from the tiles' `name:ar` field via a layout expression:
   ```
   ["coalesce", ["get", "name:ar"], ["get", "name"]]
   ```
   `coalesce` matters — not every feature has an Arabic name, and without a fallback those labels vanish.

The map container itself is `dir="ltr"` regardless of locale. Geography is not mirrored; only the UI chrome around it is.

### Layers, bottom to top

| Layer | Style |
|---|---|
| Basemap | OpenFreeMap vector tiles |
| Restricted city boundary | Amber fill at low opacity, dashed outline |
| Permitted zones | Green fill, solid outline, label with zone name |
| No-fly zones | Red fill at higher opacity, hatched pattern |
| Zone labels | Localised names |
| Query marker | The tapped point |
| Result halo | Green / amber / red around the marker |

Colours come from the `--zone-*` CSS variables ([F16](./F16-public-landing.md)). MapLibre needs concrete colour values, so an `oklch()` token is resolved to hex once at map init via a canvas `fillStyle` round-trip, with a hard-coded fallback if that fails. **No hex literals scattered through map code** — a zone must be the same green on the map as on its badge.

### Live authorization — the core interaction

Tap the map → a marker drops → the status panel answers immediately.

Zones for the current viewport are fetched **once** from `/api/zones/geojson?bbox=`, then `evaluateAirspace` from [F12](./F12-airspace-engine.md) runs **client-side** on every tap. No round trip per tap.

This is why `evaluate.ts` is pure. The server re-evaluates authoritatively at booking time; because it is literally the same function, the map can never promise something the server then refuses.

### The status panel

Three states, visually distinct — **three, not two**:

| State | Shows |
|---|---|
| **Allowed** (green) | Zone name, ceiling, today's hours, capacity, **Book this zone** |
| **Needs review** (amber) | Same, plus "subject to GACA approval" — the `autoApprove: false` case |
| **Denied** (red) | Every reason, bilingual, each with its fix hint |

A denial always offers something: the nearest permitted zone, `nextOpenAt` for a closed zone, or a suggested altitude for `above_ceiling`. **Never a bare "not permitted".**

Panel controls: an altitude slider (default 120 m, the GACAR limit, marked on the scale), a drone selector defaulting to the pilot's only approved drone, and a date/time selector defaulting to the next open slot.

### Performance

- Zones are fetched per viewport with a bbox query, debounced ~300 ms on `moveend`, and cached client-side by bbox tile.
- Evaluation is debounced ~250 ms; the server `checkAirspace` limit is deliberately generous ([F09](./F09-rate-limiting.md)) because this fires on interaction.
- `/api/zones/geojson` is cached with a short revalidate and keyed on `geometryVersion`, so an admin edit invalidates it.

### Degradation

If tiles fail to load, the map renders zone polygons on a plain background with a bilingual notice — the airspace is still readable. An unreachable tile host must not blank the screen.

### Mobile

Full-screen map with the status panel as a bottom sheet (drag to expand). Zone list collapses into the sheet. This is the primary viewport — a pilot uses it standing in a field.

## Files

```
src/components/map/{airspace-map,map-provider,zone-layers,status-panel,
                    altitude-slider,zone-legend,map-controls,tile-error}.tsx
src/lib/maps/{config,rtl-plugin,color-resolve,layer-styles}.ts
src/app/[locale]/(app)/map/page.tsx
src/app/[locale]/(public)/zones/page.tsx        read-only variant
src/app/api/zones/geojson/route.ts
```

## Acceptance criteria

**Rendering**
- [ ] The map loads with **no API key** in `.env`.
- [ ] All 12 seeded Riyadh zones render, correctly positioned and coloured by kind.
- [ ] Zone colours match the `--zone-*` tokens used by badges elsewhere — no hex literals in map code.
- [ ] Arabic place labels render **connected and in the correct order** (the `setRTLTextPlugin` test).
- [ ] `setRTLTextPlugin` is called exactly once across the app; navigating between two map pages does not throw.
- [ ] A feature with no `name:ar` falls back to `name` rather than rendering blank.
- [ ] The map container is `dir="ltr"` in both locales; geography is not mirrored.
- [ ] The KKIA CTR's interior ring renders as a hole.

**Interaction**
- [ ] Tapping a permitted zone shows **allowed** with the zone name, ceiling, and today's hours.
- [ ] Tapping empty desert outside every zone shows **denied / `outside_permitted_zone`** — default-deny is visible.
- [ ] Tapping a no-fly zone that overlaps a permitted zone shows **denied**, `inside_no_fly_zone`.
- [ ] A zone with `autoApprove: false` shows the **amber "needs review"** state, distinct from both green and red.
- [ ] Raising altitude above a zone's ceiling flips the panel to denied with `above_ceiling` **and** a suggested altitude.
- [ ] Selecting a time outside operating hours shows `zone_closed_now` **with `nextOpenAt`** rendered as a Gregorian Latin-numeral time.
- [ ] Every denial offers at least one concrete next step.
- [ ] "Book this zone" carries the zone, point, altitude, and time into [F21](./F21-booking-flow.md) with nothing re-entered.

**Consistency & performance**
- [ ] A point the map shows green is accepted by `createBooking`; a red point is refused with the **same reason code**.
- [ ] Panning fires **one** debounced zone fetch, not one per frame.
- [ ] Rapid tapping does not trip the rate limit.
- [ ] Editing a zone in [F23](./F23-zone-management.md) invalidates the cache and the pilot map shows the new geometry on reload.

**Resilience & mobile**
- [ ] Blocking the tile host still renders zone polygons with a bilingual notice — the screen is not blank.
- [ ] At 375 px the map is full-screen with a working bottom-sheet panel.
- [ ] The authored-data disclaimer is visible on every map surface, both locales.
- [ ] The map works in light and dark mode with legible zone fills in both.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
