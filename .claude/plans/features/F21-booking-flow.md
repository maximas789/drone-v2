# F21 — Booking Flow & Pilot Dashboard

**Wave:** 6 · **Depends on:** [F13](./F13-slots-and-concurrency.md), [F14](./F14-workflow-and-audit.md), [F20](./F20-airspace-map.md)

## Purpose

Turn "I can fly here" into a booked, authorised slot — and give the pilot one screen that tells them what's happening with their aircraft and flights.

## Technical design

### Booking wizard — `/[locale]/bookings/new`

Entered from the map with zone, point, altitude, and time already carried over. **Nothing already chosen is re-asked.**

1. **Zone & date** — pre-filled from the map, changeable. A date strip of the next 14 days (`maxAdvanceDays`) with per-day availability.
2. **Slot** — the derived grid from [F13](./F13-slots-and-concurrency.md), each slot showing a capacity meter (`2 / 4`) and its state. Full, closed, and past slots are visibly distinct and unclickable — never merely dimmed.
3. **Drone** — the pilot's approved drones only. An unapproved or expired drone appears **disabled with the reason**, not hidden, so the pilot understands why it isn't selectable.
4. **Details** — purpose (recreational / training / photography / inspection / research), optional note, planned altitude (pre-filled, validated against the ceiling), co-pilots (up to 3: names, optional mobile).
5. **Safety acknowledgement** — the zone's rules restated (ceiling, VLOS, hours, restrictions) with an explicit acknowledgement. Not a dark-pattern pre-tick; the box starts unchecked.
6. **Review & confirm** — everything on one screen, plus a clear statement of what happens next: **instant approval** in an auto-approve zone, or **"enters GACA review"** otherwise. The pilot must never be surprised by a pending state.

### Submission

`createBooking` re-runs the **full** `evaluateAirspace` server-side. The client evaluation was for responsiveness; this one is authoritative. Then the seat-claim transaction from [F13](./F13-slots-and-concurrency.md).

Every refusal renders in place, bilingual, with alternatives where they exist — the form is never lost, and the pilot is never bounced to an error page.

### Booking detail — `/[locale]/bookings/[id]`

- Status timeline: requested → reviewed → approved → checked in → completed, with timestamps.
- Zone, slot (Riyadh time, Gregorian, Latin numerals), altitude, purpose, co-pilots.
- **The Remote ID of the booked drone**, prominent — this is the identifier an inspector will ask for.
- A rejection or cancellation shows the reason **verbatim**.
- **Check-in** appears only within the slot window (from `slotStart − 15 min` to `slotEnd`), and states plainly that it records attendance and that a missed check-in counts as a no-show.
- **Cancel** available until `slotStart − 2h`, with the cutoff shown as an absolute time, not "2 hours before".
- A mini-map showing the zone and the planned point.

### Pilot dashboard — `/[locale]/dashboard`

The landing place after sign-in, showing real data, not a greeting.

1. **Action required**, only when it exists: an incomplete profile, a rejected drone, a registration expiring within 30 days, a booking today.
2. **Next flight** — the soonest approved booking as a large card with zone, time, countdown, Remote ID, and check-in when in window.
3. **My drones** — compact cards with Remote ID and status; expiring ones flagged.
4. **Recent bookings** — last 5 with status.
5. **Quick actions** — Register a drone · Open the map · Book a flight.

**Day-one state:** a signed-up pilot with nothing has no empty grid. They get a short, purposeful onboarding — complete your profile → register your drone → book a flight — with the first step live and the rest shown as upcoming. Every list has an empty state that reads as intentional.

### Bookings list — `/[locale]/bookings`

Tabs: Upcoming · Pending · Past · Cancelled. Each row: zone, date/time, drone Remote ID, status badge. Sorted soonest-first for upcoming, most-recent-first for past. Empty states per tab.

## Files

```
src/app/[locale]/(app)/dashboard/page.tsx
src/app/[locale]/(app)/bookings/{page,new/page,[id]/page}.tsx
src/lib/actions/booking.ts
src/components/booking/{wizard,date-strip,slot-picker,slot-card,capacity-meter,
                        drone-select,copilots,safety-ack,review,confirmation}.tsx
src/components/dashboard/{action-required,next-flight,drone-summary,
                          recent-bookings,onboarding}.tsx
```

## Acceptance criteria

**Wizard**
- [ ] Arriving from the map pre-fills zone, altitude, and time; **nothing already chosen is re-asked**.
- [ ] The date strip shows exactly `maxAdvanceDays` days and per-day availability.
- [ ] Full, closed, and past slots are visually distinct and **not clickable**.
- [ ] The capacity meter shows real counts (`2 / 4`).
- [ ] An unapproved or expired drone is **disabled with the reason shown**, not hidden.
- [ ] Planned altitude above the zone ceiling is refused with `above_ceiling` before submission.
- [ ] Up to 3 co-pilots can be added; a 4th is refused.
- [ ] The safety acknowledgement starts **unchecked** and blocks submission until ticked.
- [ ] The review screen states whether approval will be instant or enters review, matching the zone's `autoApprove`.

**Submission**
- [ ] Booking in an auto-approve zone lands `approved`; a normal zone lands `pending` — and the confirmation screen says which.
- [ ] The server re-runs the full airspace evaluation — a booking whose zone closed between page load and submit is refused.
- [ ] Losing the last-seat race shows a bilingual toast with 3 alternatives, **keeps the form state**, and greys that slot in place.
- [ ] Every refusal renders in place — no error page, no lost input.
- [ ] Rate-limited booking attempts show the countdown toast, not a 429.

**Detail & lifecycle**
- [ ] The detail page shows the drone's Remote ID prominently.
- [ ] Check-in appears only from `slotStart − 15 min` to `slotEnd`, and is absent outside it.
- [ ] Checking in sets `checkedInAt` without changing status.
- [ ] Cancel is offered until `slotStart − 2h` with the cutoff shown as an absolute time; after it, cancel is gone and a direct action call is refused.
- [ ] A rejected or authority-cancelled booking shows the reason **verbatim**.
- [ ] All times are Riyadh, Gregorian, Latin numerals, in both locales.

**Dashboard & ownership**
- [ ] A brand-new account sees purposeful onboarding, not an empty grid.
- [ ] "Action required" appears only when something is genuinely required, and is absent otherwise.
- [ ] The next-flight card shows the soonest approved booking with a live countdown.
- [ ] A registration expiring within 30 days appears in "Action required".
- [ ] Pilot B opening pilot A's booking gets **404**; the dashboard shows only the signed-in pilot's data.
- [ ] Every list has an empty state that reads as intentional in both languages.
- [ ] The whole flow works in Arabic RTL at 375 px.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
