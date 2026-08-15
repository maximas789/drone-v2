# F12 — Airspace Authorization Engine

**Wave:** 5 · **Depends on:** [F03](./F03-database-schema.md), [F04](./F04-riyadh-seed-data.md)

## Purpose

One function that answers *can this drone fly here, at this altitude, at this time* — and when the answer is no, says why and what would work instead. The booking action and the live map both call it, so they can never disagree.

## Technical design

### Layout and the purity rule

```
src/lib/airspace/
  types.ts       AirspaceQuery, AirspaceContext, AirspaceDecision, ReasonCode   pure
  geometry.ts    ray casting, bbox, rings with holes                            pure
  time.ts        riyadhParts(), weekday Sun=0, minutesOfDay                     pure
  evaluate.ts    evaluateAirspace(query, context): AirspaceDecision             pure
  query.ts       "server-only": bbox SQL → builds AirspaceContext
  index.ts
```

**`evaluate.ts` must not import `@/lib/db`, `server-only`, `next-intl`, or `react`.** Enforced by the ESLint `no-restricted-imports` rule from [F01](./F01-project-shell.md).

That purity is the entire architectural point. The map fetches visible zones once from `/api/zones/geojson?bbox=` and evaluates **locally** on every pan and click for instant feedback; the server re-evaluates **authoritatively** inside the booking transaction. Same code, so the map can never promise something the server then refuses.

### Precedence

```
no_fly  >  permitted  >  restricted  >  default-deny
```

### Evaluation order

**1 — Eligibility** (cheap, no geometry): profile complete, drone `approved`, `registrationExpiresAt > slotEnd`, Remote ID `active`, broadcast capability if the zone demands it.

**Eligibility failures do not short-circuit.** Geometry still runs, so the map can show a pilot *where* they could fly once eligible. Reasons are collected, not returned early — a screen saying only "your profile is incomplete" over a blank map is a worse product.

**2 — bbox pre-filter, in SQL:**

```sql
where min_lat <= :lat and max_lat >= :lat
  and min_lng <= :lng and max_lng >= :lng
  and status = 'active'
```

For a drawn area, bbox **overlap** rather than containment.

**3 — `no_fly` containment** → DENY, terminal. Overrides everything, including a permitted zone.
**4 — `permitted` containment** → the carve-out. Overrides any restricted containment.
**5 — `restricted` with no permitted match** → `inside_restricted_zone`.
**6 — neither** → `outside_permitted_zone`. This is default-deny, and it is the normal answer over most of the map.

**7 — Zone-level checks** against the matched permitted zone: build type, weight class, broadcast requirement, altitude ceiling, operating-hour window, closures, night rules, lead time, advance window, capacity.

### Point-in-polygon

- `pointInRing` — ray casting on the **half-open rule** `(yi > y) !== (yj > y)`. This makes a point on a shared edge between adjacent zones resolve to exactly one zone rather than both or neither, which matters wherever two permitted zones abut.
- `pointInPolygon` — inside the outer ring **and** not inside any interior ring. Holes are how the KKIA CTR with an excluded core is modelled.
- `pointInMultiPolygon` — any member.
- Every call is guarded by `bboxContains` first.
- **Coordinates are `[lng, lat]` GeoJSON order everywhere**, with the type named `Position` rather than a tuple alias, so a reversed pair is a type error rather than a drone authorised in the Indian Ocean. One fixture asserts a known Riyadh point.
- Drawn areas: `areaIntersectsZone` = any query vertex inside the zone, OR any zone vertex inside the query, OR any edge pair crossing. For an area the rule is **stricter** than for a point — the whole area must sit inside a single permitted zone, and *any* intersection with a no-fly zone denies.

### Refusal reasons

Stable machine-readable codes, bilingual only at render:

```
outside_permitted_zone    inside_restricted_zone      inside_no_fly_zone
above_ceiling             below_floor                 zone_suspended
zone_closed_now           zone_closed_window          night_operation_not_permitted
slot_full                 slot_not_on_grid            slot_in_past
booking_lead_time         booking_too_far_ahead       duplicate_booking
max_slots_per_day         drone_not_approved          drone_registration_expired
drone_revoked             no_remote_id                remote_id_not_active
broadcast_rid_required    build_type_not_permitted    weight_class_not_permitted
pilot_profile_incomplete  rate_limited
```

Shape: `{ code, params?, zoneId?, zoneNameAr?, zoneNameEn? }`, rendered via `t('airspace.reasons.' + code, params)`. Both catalogues carry the full set, so a missing key is a **build-visible failure** ([F02](./F02-i18n-rtl-foundation.md)'s `i18n:check`).

### A refusal is always a suggestion

Every decision returns `fix` hints, `nextOpenAt`, and `alternativeSlots`. `above_ceiling` offers "reduce to 120 m"; `zone_closed_now` returns the next open window as an ISO instant the UI formats. One call answers **no, because, and here's what would work** — that is the Aloft one-tap feel, and it's what separates this from a form that just says "invalid".

### Decision shape

```ts
{
  status: "allowed" | "denied" | "needs_review",
  zone: { id, code, nameAr, nameEn, kind, ceilingAglM } | null,
  reasons: Reason[],
  nextOpenAt: string | null,
  alternativeSlots: Slot[],
  evaluatedAt: string,
  geometryVersion: number,
}
```

`needs_review` is the state for a query that passes everything but lands in a zone with `autoApprove: false`. The map must show "bookable, subject to approval" distinctly from both green and red — three states, not two.

`geometryVersion` is captured into `booking.decisionSnapshot` at approval, so a later polygon redraw can't retroactively invalidate the record of why a flight was authorised.

## Files

```
src/lib/airspace/{types,geometry,time,evaluate,query,index}.ts
src/lib/actions/airspace.ts          checkAirspace server action
src/app/api/zones/geojson/route.ts   bbox-filtered, cached
src/lib/airspace/__tests__/{geometry,evaluate,precedence}.test.ts
```

## Acceptance criteria

**Purity**
- [ ] `pnpm lint` fails if `evaluate.ts` imports `@/lib/db`, `server-only`, `next-intl`, or `react`.
- [ ] `evaluate.ts` is imported by both the booking server action and the map client component.

**Geometry**
- [ ] A point in central Riyadh outside every permitted zone → `outside_permitted_zone`.
- [ ] A point inside a permitted carve-out, itself inside `RUH-R-CITY` → **allowed** (the carve-out beats the restriction).
- [ ] A point inside the KKIA CTR's **interior ring** is not contained by that polygon.
- [ ] A point inside a no-fly zone that also sits in a permitted zone → **denied** with `inside_no_fly_zone`.
- [ ] A point exactly on a shared edge between two adjacent zones resolves to exactly **one**.
- [ ] Swapping a coordinate pair to `[lat, lng]` is a **type error**.
- [ ] A drawn area partly outside a permitted zone is denied; entirely inside is allowed; touching a no-fly zone at all is denied.

**Rules**
- [ ] Altitude above the zone ceiling → `above_ceiling`, with a `fix` hint naming the ceiling.
- [ ] A slot outside operating hours → `zone_closed_now` **plus a `nextOpenAt`**.
- [ ] A slot inside a published closure → `zone_closed_window` with the bilingual reason.
- [ ] An FPV drone in a zone whose `permittedBuildTypes` excludes `fpv` → `build_type_not_permitted`.
- [ ] A zone with `requiresBroadcastRid` refuses a drone with only an unverified declaration.
- [ ] An expired registration → `drone_registration_expired`, **and geometry still evaluates** so the map still shows where they could fly.
- [ ] A booking inside `minLeadMinutes` → `booking_lead_time`; beyond `maxAdvanceDays` → `booking_too_far_ahead`.

**Decision quality**
- [ ] A zone with `autoApprove: false` returns `needs_review`, rendered distinctly from both allowed and denied.
- [ ] Every reason code has an entry in **both** message catalogues; `i18n:check` passes.
- [ ] Every denial returns at least one `fix` hint or an alternative.
- [ ] `geometryVersion` is present on every decision.

**Consistency**
- [ ] A point the map shows green is accepted by `createBooking`; a point shown red is refused with the **same reason code**.
- [ ] `pnpm test` passes the geometry, evaluate, and precedence suites; `tsc`, `lint`, `build` pass.
