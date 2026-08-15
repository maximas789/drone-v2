# F23 — Zone & Closure Management

**Wave:** 7 · **Depends on:** [F20](./F20-airspace-map.md), [F14](./F14-workflow-and-audit.md) · **Admin only**

## Purpose

Let GACA draw the airspace: carve permitted zones out of restricted airspace, mark no-fly areas, set the rules that apply inside each, and close a zone at short notice — with every boundary change recorded.

## Technical design

### Drawing

`terra-draw` with the MapLibre adapter, loaded **`ssr: false` and only in the admin bundle** — a drawing library has no business in the pilot map's payload.

Modes: polygon, rectangle (quick bounding areas), and edit (drag vertices, insert, delete). Snap-to-vertex when a new zone abuts an existing one, so adjacent boundaries share coordinates exactly and the half-open point-in-polygon rule from [F12](./F12-airspace-engine.md) resolves them cleanly.

### Validation before save

Client-side as guidance, **server-side as the rule** — the client can be bypassed:

- Valid GeoJSON `Polygon` or `MultiPolygon`, WGS84, `[lng, lat]`.
- **Ring closure** — first coordinate equals last; auto-closed with a warning if not.
- **No self-intersection** — refused, with the offending segment highlighted. A self-intersecting polygon makes ray-casting containment meaningless.
- **Winding** — outer ring counter-clockwise, interior rings clockwise. Auto-corrected via `ensureWinding`, because a hole wound the same way as its outer ring is not a hole.
- **Vertex cap** ~5 000 total. An unbounded polygon in `jsonb` is both a denial-of-service vector and a slow containment check.
- **Inside Saudi Arabia** — a bounds sanity check, the same one the seed uses.
- **Minimum area** — a zone under ~0.01 km² is almost certainly a mis-click.

`bbox` and `vertexCount` are **computed server-side** from the geometry using the shared `computeBbox` helper from [F04](./F04-riyadh-seed-data.md) — never trusted from the client, and never a second implementation.

### Zone form

Bilingual fields side by side (`nameAr`/`nameEn`, `districtAr`/`districtEn`, `notesAr`/`notesEn`), each labelled with its language, the Arabic input `dir="rtl"` and the English `dir="ltr"`. **Both languages are required** — a zone with only an English name is broken for the app's primary audience, so the form refuses rather than silently falling back.

Rules: `kind`, `ceilingAglM`, `floorAglM`, `capacity`, `slotDurationMinutes`, `minLeadMinutes`, `maxAdvanceDays`, `maxSlotsPerPilotPerDay`, `autoApprove`, `nightAllowed`, `maxWeightClass`, `permittedBuildTypes[]`, `requiresBroadcastRid`, `authorityRef`.

Each rule carries a one-line explanation of its effect on pilots — an admin setting `requiresBroadcastRid` should know it excludes every pilot without a *verified* module.

### Operating hours editor

A weekly grid, **Sunday first**. Multiple windows per day, added and removed individually. Times in Riyadh local, entered as `HH:mm`, stored as `opensMinute`/`closesMinute`.

Validation: `closesMinute > opensMinute` (a window never crosses midnight — split it into two), and overlapping windows on the same weekday are refused.

A **live preview of derived slots** for a chosen date, using the real `deriveSlots` from [F13](./F13-slots-and-concurrency.md). This is what stops an admin discovering at 06:00 that their window produces zero slots because it's shorter than the slot duration.

### Publish lifecycle

`draft → active → suspended → archived`.

- A **draft** zone is invisible to pilots and produces no slots.
- **Publishing** requires: valid geometry, both language names, at least one operating-hour window (permitted zones), and a `capacity ≥ 1`.
- **Suspending** an active zone with future bookings warns with the exact count and requires a reason; on confirmation it cancels them via the closure fan-out ([F08](./F08-background-jobs.md)).
- **Archiving** is only allowed with no future bookings.

### Geometry edits are consequential

Editing a published zone's polygon:

1. Increments `geometryVersion`.
2. Writes an audit event with the **full polygon in both `before` and `after`** — the one deliberate exception to "only changed fields", because "who moved this boundary and where was it" is otherwise unanswerable.
3. Re-evaluates every future booking in that zone against the new geometry and **shows the admin which would now fall outside, before saving**.
4. On confirmation, flags those bookings for review rather than silently cancelling them — a boundary tweak should not quietly void someone's authorised flight.
5. Invalidates the `/api/zones/geojson` cache.

### Closures

`/[locale]/admin/zones/[id]/closures` — the NOTAM analogue. Start, end, bilingual reason, optional `authorityRef`.

Creating a closure shows **exactly which bookings it will cancel, with pilot names, before publishing**. On publish, the fan-out cancels each with `cancelled_by_closure` and notifies each pilot individually.

### Cities

`/[locale]/admin/cities` — create a city with bilingual name, code, and centroid. This is what turns an `isModelled: false` city into a drawable one.

## Files

```
src/app/[locale]/(admin)/admin/zones/{page,new/page,[id]/page,[id]/closures/page}.tsx
src/app/[locale]/(admin)/admin/cities/page.tsx
src/lib/actions/admin.ts               createZone, updateZone, publishZone, suspendZone,
                                       setZoneHours, createZoneClosure, createCity
src/lib/geo/{validate,winding,bbox}.ts
src/lib/validation/geojson.ts          GeoJSONGeometrySchema (ring + vertex caps)
src/components/admin/zone/{editor,draw-toolbar,form,hours-grid,slot-preview,
                           closure-form,impact-warning,geometry-diff}.tsx
src/lib/geo/__tests__/{validate,winding}.test.ts
```

## Acceptance criteria

**Drawing & validation**
- [ ] `terra-draw` loads only on admin routes — confirmed absent from the pilot map bundle.
- [ ] A polygon can be drawn, vertices dragged, inserted, and deleted.
- [ ] A self-intersecting polygon is **refused server-side**, not merely warned about client-side.
- [ ] An unclosed ring is auto-closed with a visible warning.
- [ ] A clockwise outer ring is corrected to counter-clockwise; an interior ring is corrected to clockwise.
- [ ] A polygon with an interior ring saves and renders as a hole, and a point in the hole is not contained.
- [ ] A polygon exceeding the vertex cap is refused.
- [ ] A polygon outside Saudi Arabia is refused.
- [ ] `bbox` and `vertexCount` are computed server-side and match the geometry — verified by posting a **wrong** bbox directly to the action and confirming it's ignored.

**Form & hours**
- [ ] A zone with only an English name is refused.
- [ ] Arabic inputs are `dir="rtl"`, English `dir="ltr"`.
- [ ] Each rule field shows a one-line explanation of its effect.
- [ ] The hours grid starts on **Sunday**.
- [ ] Two windows on one Friday can be added and saved.
- [ ] A window with `closes <= opens` is refused; overlapping windows on the same day are refused.
- [ ] The slot preview uses the real `deriveSlots` and shows zero slots when the window is shorter than the slot duration.

**Lifecycle & consequences**
- [ ] A draft zone is invisible to pilots and produces no slots.
- [ ] Publishing without an operating-hour window is refused for a permitted zone.
- [ ] Suspending a zone with 3 future bookings warns with the count, requires a reason, and cancels all 3 with notifications.
- [ ] Archiving with future bookings is refused.
- [ ] Editing geometry increments `geometryVersion` and writes an audit event containing the **full polygon** in both `before` and `after`.
- [ ] Before saving a geometry edit, the admin is shown which future bookings would fall outside the new boundary.
- [ ] Those bookings are flagged for review, **not silently cancelled**.
- [ ] The pilot map shows the new geometry after the cache invalidates.

**Closures & access**
- [ ] Creating a closure previews exactly which bookings it will cancel, with pilot names, before publishing.
- [ ] Publishing cancels them all with `cancelled_by_closure` and notifies each pilot.
- [ ] The closure reason is required in both languages and reaches the pilot in theirs.
- [ ] A **reviewer** (not admin) gets 404 on every zone-write route and is refused by every zone action.
- [ ] Creating a city makes it selectable in the zone editor.
- [ ] The editor is usable in Arabic RTL — toolbar, form, and hours grid all mirror correctly while the map itself does not.
- [ ] `pnpm test` passes the geometry validation and winding suites; `tsc`, `lint`, `build` pass.
