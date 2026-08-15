# F04 — Riyadh Airspace Seed Data

**Wave:** 2 · **Depends on:** [F03](./F03-database-schema.md)

## Purpose

Give the app a realistic Riyadh airspace on first run: a default-deny city boundary with GACA-style permitted carve-outs and genuine no-fly overlays. Without this the map is empty and nothing about the product is demonstrable.

## Technical design

### Honesty constraint

These zones are **authored, not official GACA airspace**. A persistent disclaimer appears on every map surface and on the public zones page, in both languages. Fabricating an official-looking dataset and presenting it as real would be the one thing that could genuinely embarrass this pitch in front of the regulator.

Real geographic anchors (airport positions, district boundaries, the city extent) are public facts and used as such. The *permissions* attached to them are the proposal.

### Structure

Airspace is **default-deny**: nothing is flyable unless a permitted zone explicitly says so.

```
RUH-R-CITY     restricted   greater Riyadh boundary — the default-deny base
RUH-P-01..07   permitted    carve-outs, each with hours, ceiling, capacity
RUH-NF-*       no_fly       overlays that beat everything, including permitted
```

**Permitted zones are separate rows, not holes punched in the restricted polygon.** Precedence in [F12](./F12-airspace-engine.md) handles the carve-out; interior rings stay reserved for genuinely annular geometry, such as a CTR with an excluded core.

### Rows

**City:** Riyadh (`RUH`, centroid ≈ 24.7136 / 46.6753, `isModelled: true`). Jeddah (`JED`), Dammam (`DMM`), Makkah (`MAK`), Madinah (`MED`), Abha (`ABT`) as rows with `isModelled: false` — they exist so an admin can draw into them later.

**Restricted base:** `RUH-R-CITY`, a hand-authored ring covering greater Riyadh, roughly 24.30–25.25 °N and 46.15–47.15 °E. `ceilingAglM: null` — nothing is permitted there, so a ceiling is meaningless.

**Permitted carve-outs** (seven), each anchored on a real location with plausible parameters:

| Code | Area | Notes |
|---|---|---|
| `RUH-P-01` | الثمامة — Thumamah | Open desert north-east; the FPV-friendly one. Highest ceiling, all build types. |
| `RUH-P-02` | الدرعية / وادي حنيفة — Diriyah, Wadi Hanifah | Heritage area; camera drones, low ceiling, `requiresBroadcastRid: true`. |
| `RUH-P-03` | وادي نمار — Wadi Namar | Recreational, weekend capacity. |
| `RUH-P-04` | حديقة الملك سلمان — King Salman Park | Urban, tight ceiling, `micro`/`light` only. |
| `RUH-P-05` | الحاير — Al Hair | Large southern area, training-oriented. |
| `RUH-P-06` | العمارية — Ammariyah | Remote; higher ceiling, night flying allowed. |
| `RUH-P-07` | الجنادرية — Janadriyah | Events area, closures common — exercises `zone_closure`. |

Each carries: bilingual name/district/notes, `ceilingAglM` (60–120 m), `capacity` 2–6, `slotDurationMinutes` 60 or 120, `minLeadMinutes`, `maxAdvanceDays` 14, `permittedBuildTypes`, `maxWeightClass`, `nightAllowed`, `autoApprove` (true on two zones only, so both booking paths are demonstrable), and an `authorityRef` placeholder.

**No-fly overlays** (four), which override permitted zones entirely:

| Code | Area | Shape |
|---|---|---|
| `RUH-NF-KKIA` | King Khalid International CTR (≈ 24.9576 / 46.6988) | ~8 km ring, `ceilingAglM: 0` |
| `RUH-NF-MOD` | Ministry of Defence | polygon |
| `RUH-NF-DQ` | Diplomatic Quarter | polygon |
| `RUH-NF-ROYAL` | Royal properties / Yamamah Palace | polygon |

**At least one no-fly polygon must overlap a permitted zone's bounding box** — that overlap is the fixture proving `no_fly > permitted` in [F12](./F12-airspace-engine.md)'s tests.

**One zone must be modelled as an annulus** (a `Polygon` with an interior ring) — the KKIA CTR with an excluded core — so the hole-handling code path is genuinely exercised rather than dead.

### Operating hours

`zone_hour` rows per zone, weekday **0 = Sunday**. Realistic Saudi pattern:

- Sunday–Wednesday: 06:00–11:00 and 15:00–18:00 (avoiding midday heat).
- Thursday: 06:00–11:00 and 15:00–20:00.
- **Friday: 06:00–10:00 and 15:30–20:00** — two windows, split around Jumu'ah. This zone is the fixture for double-window slot derivation in [F13](./F13-slots-and-concurrency.md).
- Saturday: 06:00–11:00 and 15:00–19:00.

### Closures

Two seeded `zone_closure` rows on `RUH-P-07`: one in the past and one in the near future, each with a bilingual reason and an `authorityRef`.

### Determinism

The seed uses **frozen literal coordinates and a fixed epoch** — no `Math.random()`, no `Date.now()`, no `crypto.randomUUID()` in coordinate or date generation. Relative dates (closures, expiry demos) are computed from a single `SEED_EPOCH` constant so re-seeding produces an identical, reproducible airspace.

`pnpm db:seed` is idempotent — it upserts on `zone.code` and `city.code`, so running it twice changes nothing.

### bbox

`minLat/maxLat/minLng/maxLng` and `vertexCount` are **computed by the seed script from the geometry**, never hand-written. The same helper computes them on every admin zone write in [F23](./F23-zone-management.md), so there is exactly one implementation.

## Files

```
src/lib/seed/index.ts           entry point, idempotent upserts
src/lib/seed/cities.ts
src/lib/seed/zones-riyadh.ts    the polygons
src/lib/seed/zone-hours.ts
src/lib/seed/closures.ts
src/lib/geo/bbox.ts             computeBbox + countVertices (shared with F23)
```

Script: `"db:seed": "tsx src/lib/seed/index.ts"`

## Acceptance criteria

- [ ] `pnpm db:seed` inserts 1 restricted + 7 permitted + 4 no-fly zones, 6 cities, and the `zone_hour` rows.
- [ ] Running `pnpm db:seed` a second time changes no row counts and no `updatedAt` values.
- [ ] Every zone has a bilingual name and district; no field contains placeholder text such as "Zone 1" or lorem ipsum.
- [ ] `computeBbox` output matches the geometry for every seeded zone (asserted in the seed itself).
- [ ] All coordinates are `[lng, lat]` order and land inside Saudi Arabia — a sanity assertion rejects any point outside 16–33 °N / 34–56 °E.
- [ ] At least one no-fly polygon overlaps a permitted zone's bbox.
- [ ] `RUH-NF-KKIA` has an interior ring, and a point inside that ring is **not** contained by the polygon.
- [ ] `RUH-P-07` has two Friday `zone_hour` rows.
- [ ] Two `zone_closure` rows exist on `RUH-P-07`, one past and one future.
- [ ] Exactly two permitted zones have `autoApprove: true`.
- [ ] Rendering the seeded zones on a map shows them over Riyadh, correctly positioned, with no self-intersecting polygons.
- [ ] The disclaimer string exists in both `messages/ar.json` and `messages/en.json` and renders on every map surface.
