# F23 — Zone & Closure Management

**Wave:** 7 · **Depends on:** [F20](./F20-airspace-map.md), [F14](./F14-workflow-and-audit.md) · **Admin only**

## Split — settled in Session 29

F23 is three sessions, not one — it is F22's size again. The seam is the same
rule: **nothing in a part points at a route a later part builds.**

| Part | Scope | Status |
|---|---|---|
| **F23a** | The **geometry layer** — winding, self-intersection, area, the vertex cap, the Saudi-bounds check and the GeoJSON parser, all pure and tested — plus `/admin/zones` (the list) and `/admin/zones/new` and `/admin/zones/[id]`: draw with terra-draw, the bilingual form, the rules with their explanations, and create/update of a **draft** zone. | ✅ Session 29 |
| **F23b** | Operating hours (Sunday-first grid, overlap refusal), the live slot preview through the real `deriveSlots`, and the **publish lifecycle** — publish / suspend / archive with their impact warnings, plus the consequences of editing a published zone's geometry. | ✅ Session 30 |
| **F23c** | `/admin/zones/[id]/closures` — the NOTAM analogue with its cancellation preview and fan-out — and `/admin/cities`. | ⬜ |

**Everything F23a saves is a draft**, which is why the lifecycle can wait: a
draft zone is invisible to pilots and produces no slots, so nothing F23a writes
can affect a pilot until F23b gives somebody the button to publish it. That is
also what makes the parts safe to ship separately.

**Admin only, from the first line.** `requireReviewer` is not enough for any of
this: drawing airspace is not reviewing a submission. Every route and every
action in all three parts calls `requireAdmin`.

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

The preview also **marks the slots the engine will refuse for night** on a zone with `nightAllowed: false`, naming that day's sunrise and sunset — thread 38's reconciliation. Marked, not refused: the hours are not wrong, they are optimistic about the sun, and which day it bites depends on the date.

**Times are typed as text (`06:00`), never into `<input type="time">`** — thread 46's rule, extended. Chrome renders the native time control from the *browser's* locale and ignores `lang`, so under an Arabic Chrome the field prints Arabic-Indic digits and an AM/PM marker: rule 6 broken through a surface `format.ts` cannot reach.

### Publish lifecycle

`draft → active → suspended → archived`.

- A **draft** zone is invisible to pilots and produces no slots.
- **Publishing** requires: valid geometry, both language names, at least one operating-hour window (permitted zones), a `capacity ≥ 1`, and — added in F23b for **threads 37 and 55** — **no overlap with a published no-fly zone** for a permitted one. A booking names a zone rather than a point, so `createBookingAction` cannot see such an overlap while the map can; refusing at publish is the one moment somebody is looking at the boundary and can move it.
- **Suspending** an active zone with future bookings warns with the **names and times**, not only a count, and requires a reason **in both languages**; on confirmation it cancels them through a fan-out of the same shape as the closure one ([F08](./F08-background-jobs.md)) — `zone/suspended` → `zone-suspended.ts`, one `step.run` per booking, driving `booking.cancelled_by_closure`. A suspension and a closure are the same thing to a pilot, so the trail uses one word for it.

  The reason lives in `audit_event.reason` and on the event, **not in a column**: a `suspensionReason` pair on `zone` would be a second copy that the next suspension silently overwrites.
- **Archiving** is only allowed with no future bookings.

### Geometry edits are consequential

Editing a published zone's polygon:

1. Increments `geometryVersion`.
2. Writes an audit event with the **full polygon in both `before` and `after`** — the one deliberate exception to "only changed fields", because "who moved this boundary and where was it" is otherwise unanswerable.
3. Asks whether the boundary **shrank or moved** — `geometryShrinks`, which is `areaWithinGeometry` applied to the old polygon against the new one. If the new boundary contains the old one, nothing can have fallen outside and nothing is disturbed.
4. Otherwise **shows the admin every approved flight still ahead in the zone, by name and time, before saving** — and says plainly why it is all of them rather than a subset. **A booking carries no launch point** (threads 37 and 55): it names a zone, so "was *this* flight in the part you cut away" is a question the row cannot answer. A confident subset would be a guess about whose authorisation to disturb.
5. On confirmation, flags those bookings for review rather than silently cancelling them — `booking.flagged_for_review`, `approved → pending`, keeping the seat, with a `bookingUnderReview` notification. A boundary tweak should not quietly void someone's authorised flight, and it should not quietly leave one standing outside its zone either.
6. Invalidates the `/api/zones/geojson` cache.

### Closures

`/[locale]/admin/zones/[id]/closures` — the NOTAM analogue. Start, end, bilingual reason, optional `authorityRef`.

Creating a closure shows **exactly which bookings it will cancel, with pilot names, before publishing**. On publish, the fan-out cancels each with `cancelled_by_closure` and notifies each pilot individually.

### Cities

`/[locale]/admin/cities` — create a city with bilingual name, code, and centroid. This is what turns an `isModelled: false` city into a drawable one.

## Files

```
src/app/[locale]/(admin)/admin/zones/{page,new/page,[id]/page,[id]/closures/page}.tsx
src/app/[locale]/(admin)/admin/cities/page.tsx
src/lib/actions/admin.ts               createZone, updateZone, setZoneHours, publishZone,
                                       suspendZone, archiveZone, previewGeometryChange,
                                       createZoneClosure, createCity
src/lib/workflow/zone.ts               publishZone, suspendZone, archiveZone, setZoneHours,
                                       flagBookingsForGeometryReview  (rule 11)
src/lib/validation/{zone-hours,zone-publish}.ts   + their tests
src/lib/inngest/functions/zone-suspended.ts
scripts/probe-zone-lifecycle.mts
src/lib/geo/{validate,winding,bbox}.ts
src/lib/validation/geojson.ts          GeoJSONGeometrySchema (ring + vertex caps)
src/components/admin/zone/{editor,draw-toolbar,form,hours-grid,slot-preview,
                           lifecycle-panel,closure-form}.tsx
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
- [x] The hours grid starts on **Sunday**. *(Seen — `formatWeekday(0)` first, in both languages.)*
- [x] Two windows on one Friday can be added and saved. *(Sunday, in a browser; Friday is the same code path, and RUH-P-01's seeded two-window Sunday round-trips through the grid.)*
- [x] A window with `closes <= opens` is refused; overlapping windows on the same day are refused. *(Both in `zone-hours.test.ts`; the overlap refusal also seen on screen, with the save button disabled.)*
- [x] The slot preview uses the real `deriveSlots` and shows zero slots when the window is shorter than the slot duration. *(Tested, and seen: 6 slots from 06:00–12:00 at 60 minutes, 4 from RUH-P-01's real week at 120.)*

**Lifecycle & consequences**
- [x] A draft zone is invisible to pilots and produces no slots. *(F23a; unchanged.)*
- [x] Publishing without an operating-hour window is refused for a permitted zone. *(Probe, and on screen as a named blocker.)*
- [ ] Suspending a zone with 3 future bookings warns with the count, requires a reason, and cancels all 3 with notifications. **Half done.** The warning names each flight and its time, the reason is required in both languages, and the suspension itself was driven over HTTP. **The fan-out has never run** — no Inngest dev server on this machine, so `zone-suspended.ts` is written and registered and unexecuted. See thread 68.
- [x] Archiving with future bookings is refused. *(Probe: `archive_has_bookings` against a real approved booking.)*
- [x] Editing geometry increments `geometryVersion` and writes an audit event containing the **full polygon** in both `before` and `after`. *(F23a wrote it; F23b removed the draft-only refusal around it.)*
- [ ] Before saving a geometry edit, the admin is shown which future bookings would fall outside the new boundary. **Changed, and half verified.** It cannot be *which* — a booking has no launch point — so the screen shows every approved flight still ahead and says why. The server half is proven by the probe; **the browser handshake is unrun**, because dragging a terra-draw vertex through CDP could not be made to land. Thread 69.
- [x] Those bookings are flagged for review, **not silently cancelled**. *(Probe: `approved → pending`, seat kept, `bookingUnderReview` notification, and the trail carries `booking.flagged_for_review` and no cancellation.)*
- [ ] The pilot map shows the new geometry after the cache invalidates. **Unrun** — no boundary was moved in a browser. `revalidateZoneSurfaces()` already covered `/api/zones/geojson` from F23a.

**Closures & access**
- [ ] Creating a closure previews exactly which bookings it will cancel, with pilot names, before publishing.
- [ ] Publishing cancels them all with `cancelled_by_closure` and notifies each pilot.
- [ ] The closure reason is required in both languages and reaches the pilot in theirs.
- [ ] A **reviewer** (not admin) gets 404 on every zone-write route and is refused by every zone action.
- [ ] Creating a city makes it selectable in the zone editor.
- [ ] The editor is usable in Arabic RTL — toolbar, form, and hours grid all mirror correctly while the map itself does not.
- [x] `pnpm test` passes the geometry validation and winding suites; `tsc`, `lint`, `build` pass. *(831 tests, all green after F23b; each new claim proven to fail on a deliberate mutation.)*
