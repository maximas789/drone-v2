# F22 — Admin Review Queues & Decisions

**Wave:** 7 · **Depends on:** [F14](./F14-workflow-and-audit.md), [F18](./F18-drone-registration.md), [F21](./F21-booking-flow.md)

## Purpose

The GACA side of the product, and the thing that makes v2 real rather than simulated: a human reviewer looking at a submission and deciding, with the decision and its reason permanently recorded.

## Technical design

### Queue — `/[locale]/admin`

Two tabs, both defaulting to **oldest first** — a queue sorted newest-first buries the submissions that have been waiting longest, which is the opposite of what a regulator needs.

**Drone registrations** (`status = 'pending'`), each row: submitted date + **age** ("waiting 3 days", with anything over 7 flagged), pilot name, build type, **"no serial number" as an explicit badge** rather than an empty cell, Remote ID mode, and photo count.

**Bookings** (`status = 'pending'`, `autoApprove: false` zones), each row: requested date, pilot, drone Remote ID, zone, slot time, and **time until the slot** — a booking for tomorrow morning is more urgent than one for next month, and the queue must show that.

Filters: build type, city, age bucket, and free-text over pilot name or Remote ID. Counts per tab in the header.

### Drone review — `/[locale]/admin/drones/[id]`

Everything a reviewer needs on one screen, no tabs to hunt through:

- **Photos** — full-size with a lightbox, and a zoom, because a reviewer is checking a build against its description.
- **Specifications** — make, model, build type, weight, weight class, propulsion, camera.
- **Serial number** — the real one, or an explicit **"Self-built — no manufacturer serial. Identified by Ajniha Remote ID."** This framing matters: the reviewer should see a deliberate design, not missing data.
- **Pilot** — name (ar/en), national ID **masked** with a Reveal control, mobile, city, account age, and their history: drones registered, bookings, no-shows, prior rejections.
- **Declared Remote ID modules** — with their own verify/reject controls and the DoC PDF inline.
- **Audit trail** for this drone, including any prior rejection and its reason.

Decision controls: **Approve** and **Reject**, reject requiring a reason of ≥ 20 characters. A set of one-click reason templates (photos unclear, specifications inconsistent, identity document unreadable, weight class mismatch) that **pre-fill an editable field** — they are a starting point, never a substitute for a written reason, and the submitted text is what the pilot receives verbatim.

Approving states plainly what will happen: a Remote ID is issued, registration runs 3 years, and the pilot is emailed.

### Booking review — `/[locale]/admin/bookings/[id]`

- **The airspace decision, re-run live** and displayed — the reviewer sees the same evaluation the pilot did, including anything that has changed since the request.
- A map with the zone and the planned point.
- Drone summary with Remote ID and registration validity **at the time of the slot** — a registration expiring mid-slot is flagged prominently.
- Pilot history and no-show count.
- Slot occupancy: who else is booked in that slot.
- Approve / Reject with a required reason.

**Approving re-runs `evaluateAirspace`.** If the zone has since closed or the registration has since expired, approval is refused with the reason — a reviewer must not be able to authorise a flight against stale facts, even by accident.

### Reviewer discipline

- **A reviewer cannot decide their own submission.** If the pilot user is the reviewer, both controls are disabled with an explanation, and the server action refuses it independently.
- **Concurrent review** — the detail page shows "being viewed by {name}" using a short-lived soft lock. Deciding an already-decided item returns `invalid_transition` and refreshes to show what happened, rather than overwriting.
- Every decision writes an `audit_event` with actor, role at the time, reason, and before/after.
- Revoke and reinstate are **admin-only** and are not on the reviewer screen at all.

### Pilots list — `/[locale]/admin/pilots`

Searchable by name, mobile, national ID, or Remote ID. Detail shows profile (ID masked, reveal logged), drones, bookings, no-show history, and identity verification state with a **Verify identity** action that sets `verifiedAt` / `verifiedByUserId`.

## Files

```
src/app/[locale]/(admin)/admin/page.tsx
src/app/[locale]/(admin)/admin/drones/{page,[id]/page}.tsx
src/app/[locale]/(admin)/admin/bookings/{page,[id]/page}.tsx
src/app/[locale]/(admin)/admin/pilots/{page,[id]/page}.tsx
src/lib/actions/review.ts              decideDrone, decideBooking, verifyDeclaration,
                                       verifyIdentity, cancelBookingAsAuthority
src/components/admin/{queue-table,queue-filters,age-badge,decision-panel,
                      reason-templates,photo-lightbox,pilot-history,
                      airspace-recheck,soft-lock-indicator}.tsx
```

## Acceptance criteria

**Access**
- [ ] A pilot visiting `/ar/admin` gets **404**.
- [ ] A reviewer can decide drones and bookings; **revoke and reinstate are absent from their UI and refused server-side**.
- [ ] An admin has both.
- [ ] Calling `decideDrone` directly as a pilot is refused.

**Queue**
- [ ] Both tabs default to **oldest first**.
- [ ] Age is shown per row; anything over 7 days is flagged.
- [ ] The booking queue shows time-until-slot and surfaces imminent slots.
- [ ] A drone with no serial number shows an explicit **badge**, not an empty cell.
- [ ] Filters and free-text search over pilot name and Remote ID work.
- [ ] Tab counts match the actual pending totals.

**Drone review**
- [ ] Photos open full-size and zoom.
- [ ] A self-built drone shows the explicit "no manufacturer serial — identified by Ajniha Remote ID" framing.
- [ ] The national ID is masked; revealing requires a reason and writes an audit event.
- [ ] Pilot history shows prior rejections with their reasons.
- [ ] Declared modules can be verified or rejected, and verifying sets `broadcastCapable`.
- [ ] Rejecting with under 20 characters is refused; the accepted text reaches the pilot **verbatim** in their own locale.
- [ ] Reason templates pre-fill an **editable** field and are never submitted unedited by default.
- [ ] Approving issues a Remote ID, sets 3-year validity, enqueues the QR, and emails the pilot.

**Booking review**
- [ ] The airspace decision is re-run and displayed on the page.
- [ ] Approving a booking whose zone closed after the request is **refused with the reason**.
- [ ] A registration expiring mid-slot is flagged prominently.
- [ ] Slot occupancy shows other bookings in the same slot.

**Integrity**
- [ ] A reviewer cannot decide a submission they own — disabled in UI **and** refused server-side.
- [ ] Two reviewers on the same item: the second sees the soft-lock indicator, and deciding an already-decided item returns `invalid_transition` and refreshes.
- [ ] Every decision writes exactly one audit event with actor, role-at-the-time, and reason.
- [ ] Every admin screen renders correctly in Arabic RTL, and tables are readable at 1024 px.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
