# F14 — Workflow State Machines & Audit Trail

**Wave:** 5 · **Depends on:** [F03](./F03-database-schema.md), [F10](./F10-remote-id-issuance.md)

## Purpose

Every status change in the app goes through one place that validates the transition, records who did it and why, and triggers the right notification — in a single transaction. This is what makes the approval workflow real rather than simulated, and it's what a regulator would actually audit.

## Technical design

### One entry point

```ts
applyTransition({ entity, id, to, actor, reason?, tx }): Result
```

A `TRANSITIONS` table declares every legal edge with its guard, its audit action, and its notification. `applyTransition` validates the edge, runs the guard, writes the row, writes the `audit_event`, and enqueues the notification — **all inside one transaction**.

**No server action changes a status by hand.** An illegal edge returns `invalid_transition`; it does not throw and does not partially apply. Enforced by an ESLint rule banning `.set({ status:` outside `src/lib/workflow/`.

### Drone registration

| From | To | Who | Guard | Audit action | Notify |
|---|---|---|---|---|---|
| — | `draft` | pilot | — | `drone.created` | — |
| `draft` | `pending` | owner | profile complete · ≥1 photo · RID mode chosen · serial present iff commercial | `drone.submitted` | reviewers (hourly digest) |
| `pending` | `approved` | reviewer, admin | — | `drone.approved` | pilot: in-app + email with QR |
| `pending` | `rejected` | reviewer, admin | **reason ≥ 20 chars, required** | `drone.rejected` | pilot: reason verbatim |
| `rejected` | `pending` | owner | edits saved; `rejectionCount++` | `drone.resubmitted` | reviewers |
| `approved` | `expired` | **system** | `registrationExpiresAt <= now()` | `drone.expired` | pilot |
| `expired` | `pending` | owner | renewal; **same Remote ID code retained** | `drone.renewal_submitted` | reviewers |
| `approved` | `revoked` | **admin only** | reason required | `drone.revoked` | pilot + cancels future bookings |
| `revoked` | `approved` | **admin only** | reason required | `drone.reinstated` | pilot |

**On approval:** set `registrationIssuedAt = now()`, `registrationExpiresAt = now() + 3 years`, create the `remote_id` row and code if absent ([F10](./F10-remote-id-issuance.md)), enqueue QR rendering.

**On revocation:** `remote_id.status = 'suspended'`, and every future `pending`/`approved` booking for that drone is cancelled with `cancellationReason = 'drone_revoked'`, fanned out one step per booking ([F08](./F08-background-jobs.md)).

### Booking

| From | To | Who | Guard | Audit action | Notify |
|---|---|---|---|---|---|
| — | `pending` | pilot | full `evaluateAirspace` passes | `booking.created` | reviewers if `!autoApprove` |
| — | `approved` | pilot (auto) | `zone.autoApprove` **and** no recent no-shows | `booking.auto_approved` | pilot |
| `pending` | `approved` | reviewer, admin | **re-run `evaluateAirspace`**, store `decisionSnapshot` | `booking.approved` | pilot |
| `pending` | `rejected` | reviewer, admin | reason required | `booking.rejected` | pilot + alternatives |
| `pending`/`approved` | `cancelled` | owner | before `slotStart − 2h` | `booking.cancelled_by_pilot` | reviewers if it was approved |
| `pending`/`approved` | `cancelled` | reviewer, admin | reason required, any time | `booking.cancelled_by_authority` | pilot, high priority |
| `approved` | `cancelled` | **system** | closure or revocation overlaps | `booking.cancelled_by_closure` | pilot |
| `approved` | `completed` | **system** | `checkedInAt` set and past `slotEnd` | `booking.completed` | — |
| `approved` | `no_show` | **system** | no check-in, past `slotEnd + 30m` | `booking.no_show` | pilot |

**Re-running `evaluateAirspace` at approval time is not redundant.** Hours may have changed, a closure may have been published, or the registration may have expired since the request. Approving without re-checking authorises a flight against stale facts.

**Check-in is a separate action** that sets `checkedInAt` without changing status — it's what the closeout job reads.

**Three no-shows in 90 days disables auto-approve for that pilot** — derived in `src/lib/data/pilot.ts`, not a stored flag, so it self-heals as the window rolls forward rather than needing a reset job.

### Rejection is never silent

The reason is required at the Zod boundary (min 20 chars for a drone, so "no" isn't a valid rejection of someone's registration), stored on the row, written to `audit_event.reason`, and quoted **verbatim** in the email — in the pilot's own locale, not the reviewer's.

### The audit trail

One `audit_event` table backs both the regulator approval trail **and** the ops activity log. Two overlapping logs drift, and the trail an admin reads must be the trail a regulator audits.

```
actorUserId    on delete SET NULL — the log outlives the account
actorRole      the role AT THE TIME, not now
actorIsSystem  true for Inngest
entityType/entityId · action · before/after jsonb · reason · ipHash · userAgent
```

- `before`/`after` carry **only the changed fields** — never a password hash, a token, or a full national ID.
- **Zone geometry edits are the one exception**: the full polygon is stored in both. That *is* the trail — "who moved this boundary and where was it before" is unanswerable otherwise.
- `actorRole` is captured at write time because a reviewer who is later promoted must not retroactively appear to have acted as an admin.
- Audit events are **append-only**. No update path, no delete path, no UI affordance to remove one.

### Helper

```ts
audit({ actor, entityType, entityId, action, before?, after?, reason?, tx })
```

Always takes the transaction. An audit write outside the transaction that made the change can succeed while the change rolls back — a log recording something that never happened is worse than no log.

## Files

```
src/lib/workflow/{index,drone,booking,transitions,apply}.ts
src/lib/audit.ts
src/lib/data/pilot.ts               noShowCount, autoApproveEligible
src/lib/workflow/__tests__/{drone,booking,audit}.test.ts
```

## Acceptance criteria

**Transitions**
- [ ] Every legal edge in both tables succeeds for an actor with the right role.
- [ ] Every illegal edge returns `invalid_transition` and changes **nothing** — status, audit, and notification tables all unchanged.
- [ ] A reviewer attempting `approved → revoked` is refused; an admin succeeds.
- [ ] A pilot attempting to approve their own drone is refused.
- [ ] Rejecting a drone with a 5-character reason is refused; 20+ succeeds.
- [ ] `pnpm lint` fails on a `.set({ status:` outside `src/lib/workflow/`.

**Drone lifecycle**
- [ ] Approving sets `registrationIssuedAt`, `registrationExpiresAt` **exactly 3 years later**, creates the Remote ID, and enqueues the QR job.
- [ ] Rejecting then resubmitting increments `rejectionCount` and preserves the prior rejection in the audit log.
- [ ] Expiring then renewing retains **the same Remote ID code**.
- [ ] Revoking suspends the Remote ID and cancels every future booking for that drone.
- [ ] Reinstating requires admin and a reason.

**Booking lifecycle**
- [ ] A booking in an `autoApprove` zone lands `approved`; in a normal zone it lands `pending`.
- [ ] A pilot with 3 no-shows in 90 days gets `pending` even in an auto-approve zone; at 91 days it reverts to auto-approve with no manual reset.
- [ ] Approving **re-runs** `evaluateAirspace` — approving a booking whose zone closed after the request is refused.
- [ ] `decisionSnapshot` is populated at approval and includes `geometryVersion`.
- [ ] A pilot cancelling within 2 hours of the slot is refused; earlier succeeds.
- [ ] An authority can cancel at any time, with a reason.
- [ ] Check-in sets `checkedInAt` without changing status.

**Audit**
- [ ] Every transition writes exactly **one** audit event with the correct action string.
- [ ] `actorRole` records the role at the time — promote a reviewer to admin and confirm the old event still says `reviewer`.
- [ ] Deleting a user leaves their audit events with `actorUserId = null` and the rest intact.
- [ ] System transitions have `actorIsSystem: true` and `actorUserId: null`.
- [ ] No audit event contains a password hash, a token, or a full national ID (inspect the table).
- [ ] A zone geometry edit stores the full polygon in both `before` and `after`.
- [ ] Forcing a failure mid-transaction leaves **no** partial write — status, audit, and notification are all rolled back together.
- [ ] There is no code path that updates or deletes an `audit_event`.
- [ ] `pnpm test` passes the workflow suites; `tsc`, `lint`, `build` pass.
