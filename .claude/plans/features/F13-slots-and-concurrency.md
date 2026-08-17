# F13 — Slot Derivation & Booking Concurrency

**Wave:** 5 · **Depends on:** [F12](./F12-airspace-engine.md)

## Purpose

Turn a zone's operating hours into bookable slots, and make sure two pilots racing for the last seat produce one booking and one graceful refusal — never two bookings, and never a 500.

## Technical design

### Slots are derived, not stored

`deriveSlots(zone, hours, ymd): DerivedSlot[]` — a pure function in
`src/lib/booking/slots.ts`. Only **bookings and closures** are rows.

**Closures are not a derivation parameter.** They decide a slot's *state*, not
whether it exists, so they belong to `slotStates` — a closed slot still has to
render, greyed, or the picker silently loses hours with nothing to explain the
gap.

Three reasons:
1. A zone's hours change, and pre-generated rows go stale silently — the worst failure mode, because nothing errors.
2. 8 zones × 365 days × 12 slots is ~35 000 rows a year, almost all empty.
3. Capacity is already enforceable on the `booking` table, so slot rows would be a second source of truth for a number the booking table already knows.

### Grid anchoring

Each slot starts at `window.opensMinute + n × slotDurationMinutes` in **Riyadh local time**, and is emitted only if it fits **entirely** inside the window. A 90-minute tail on a 120-minute grid is not a slot.

This determinism is what makes the unique index below mean anything: two clients computing the same slot must produce a byte-identical `slotStart`, or the constraint protects nothing.

A zone with two windows on a Friday produces two independent grids — the second does not continue the first's numbering.

### Slot states

| State | Meaning |
|---|---|
| `available` | Free capacity, bookable now |
| `full` | Capacity taken |
| `closed` | Inside a published `zone_closure` |
| `past` | `slotStart` before now, or inside `minLeadMinutes` |
| `blocked` | Pilot already has a booking at this instant, or is at `maxSlotsPerPilotPerDay` |

Precedence, from the top: **`past` > `closed` > `blocked` > `full`**. `blocked`
sits above `full` deliberately — telling a pilot a slot is full when the
obstacle is their own existing booking sends them hunting for another zone
instead of looking at their own diary.

Availability for a day is one grouped query merged into the derived grid:

```sql
select slot_start, count(*)::int as taken
from booking
where zone_id = $1 and slot_start >= $2 and slot_start < $3
  and status in ('pending','approved')
group by slot_start;
```

One query per day view — never one per slot.

### The last-seat race

**Seat index plus a unique partial index. No `SELECT … FOR UPDATE`, no `SERIALIZABLE`.**

```sql
create unique index booking_seat_uniq
  on booking (zone_id, slot_start, seat_index)
  where status in ('pending','approved');
```

`createBooking`:

1. `evaluateAirspace` — everything except capacity.
2. `select seat_index …` for that zone and slot; pick the lowest free integer in `0 … capacity-1`.
3. Insert with that `seatIndex`.
4. On Postgres `23505` against `booking_seat_uniq` → recompute and retry, bounded at `capacity + 1` attempts, then return `slot_full`. **Each insert is a savepoint** — a unique violation aborts the whole Postgres transaction, so a bare retry answers "current transaction is aborted" instead of claiming the next seat. The seat picker is **injectable** so this ceiling can actually be executed; every caller in the app uses the default. (Same reasoning as F10's injectable `generate`.)
5. On `23505` against the per-drone or per-pilot index → return `duplicate_booking`. **A different message, not a retry** — retrying would loop forever, since the conflict isn't going to clear.

Steps 2–4 sit in **one transaction** with the audit write, so a failed booking
leaves no orphan trail.

**No notification is written on creation.** The pilot is looking at the answer
on screen, and a row telling somebody what they have just done is the noise F08
already refused for `booking-closeout`. F14's decision is the news.

**Rejected alternatives, one line each.** `SELECT … FOR UPDATE` on the zone row serialises every booking for that zone across *all* slots and deadlocks against an admin editing zone hours. `SERIALIZABLE` needs the same retry loop plus a `40001` handler, and taxes unrelated writes on Neon.

### What the loser sees

Never a 500, never a stack trace, never a lost form:

```ts
{ ok: false,
  reasons: [{ code: 'slot_full', params: { zoneNameAr, zoneNameEn, slotStart } }],
  alternatives: [ /* 3 nearest free slots */ ] }
```

A bilingual toast, that slot greys out **in place**, and the three alternatives render as one-click buttons. The whole race is invisible except that the button they pressed became unavailable while they were reading it.

### Alternatives

`findAlternativeSlots(zone, from, count = 3)` — nearest free slots forward in time, skipping closed and past ones, crossing into following days if needed. Also used by [F12](./F12-airspace-engine.md) for `zone_closed_now`, so there is exactly one implementation of "what would work instead".

### Timezone correctness

Every boundary is Riyadh-local. A slot at 06:00 Riyadh is `03:00Z`. The day grid for `2026-03-15` runs Riyadh midnight to Riyadh midnight, **not** UTC midnight — otherwise a 06:00 slot lands in the wrong day view and disappears from the picker for three hours each evening.

## Files

```
src/lib/booking/slots.ts            deriveSlots, slotStates, findAlternativeSlots, isOnGrid
src/lib/booking/create.ts           the transactional seat-claim
src/lib/actions/booking.ts          listSlotsAction, createBookingAction
src/lib/booking/slots.test.ts       derivation and states
scripts/probe-booking.mts           the concurrency half, against the live database
```

**`cancelBooking` and `checkInBooking` are F14's.** Both are status changes, and
rule 11 puts every one behind `applyTransition` — whose table holds only the
four *system* edges, and whose `apply.ts` maps only the `"system"` actor.
Building the human edges here would have left the app with two state machines.

**Concurrency is not unit-tested, and cannot be.** "Two pilots racing for the
last seat produce one booking and one graceful refusal" is a claim about
Postgres, its partial unique index and read-committed snapshots.
`scripts/probe-booking.mts` drives it against the live database instead.

## Acceptance criteria

**Derivation**
- [ ] A zone open 06:00–11:00 with 60-minute slots yields exactly 5 slots starting at 06:00 Riyadh.
- [ ] A zone open 06:00–11:00 with **90**-minute slots yields 3 slots — the trailing 30 minutes is not emitted.
- [ ] The Friday zone with two windows yields both grids, independently anchored.
- [ ] Slot start times are byte-identical across repeated calls and across server and client.
- [ ] The day grid for a date covers Riyadh midnight to Riyadh midnight; a 06:00 slot appears on the correct day.
- [ ] A slot inside a published closure is `closed`, not `available`.
- [ ] A slot inside `minLeadMinutes` is `past`.
- [ ] A day's availability is fetched in **one** query, not one per slot.

**Concurrency**
All ten concurrency criteria below were verified by `scripts/probe-booking.mts`
against the live database, run twice. See the Session 11 build-log entry.

- [ ] `booking_seat_uniq` exists with the `where status in ('pending','approved')` clause.
- [ ] Capacity 1: **two simultaneous** `createBooking` calls produce exactly **one** booking row; the loser gets `slot_full`.
- [ ] Capacity 3: five simultaneous calls produce exactly **three** rows with `seatIndex` 0, 1, 2 — no gaps, no duplicates.
- [ ] The loser receives 3 alternative slots and **no exception is thrown**.
- [ ] Cancelling a booking frees its seat, and a new booking reuses that index.
- [ ] The same pilot booking the same instant in two zones is refused with `duplicate_booking`, not retried.
- [ ] The same drone booked at the same instant by two pilots is refused with `duplicate_booking`.
- [ ] Exceeding `maxSlotsPerPilotPerDay` returns `max_slots_per_day`.
- [ ] A failed booking leaves **no** audit event and **no** notification — confirm both tables are unchanged.
- [ ] Forcing `capacity + 1` consecutive conflicts returns `slot_full` rather than looping.

**UI — deferred to [F21](./F21-booking-flow.md), which builds the picker.**
These describe a surface F13 does not create; the data behind them is here and
tested, and the rendering is F21's to satisfy.
- [ ] The date strip and slot picker render correctly in Arabic RTL, with Latin numerals and Gregorian dates.
- [ ] A losing booking greys the slot in place and shows alternatives as buttons — no page reload, no lost form state.
- [ ] `pnpm test` passes the slots and concurrency suites; `tsc`, `lint`, `build` pass.
