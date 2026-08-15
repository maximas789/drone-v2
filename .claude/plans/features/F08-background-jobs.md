# F08 — Background Jobs

**Wave:** 4 · **Depends on:** [F03](./F03-database-schema.md) · **Skill reference:** `references/jobs.md`

## Purpose

The work that must happen whether or not anyone has the app open: registration expiry, reminders, booking closeout, and fan-out when a zone closes. This is the feature that makes "registration expires in 30 days" a real notification rather than something a pilot discovers by chance.

## Technical design

### Inngest

Client in `src/lib/inngest/client.ts`, endpoint at `/api/inngest`. Free and account-free in development: `npx inngest-cli dev` gives a local dashboard where every step of every run is visible.

A `jobs` table mirrors run state into the app's own database so the system page ([F29](./F29-system-ops-page.md)) can show what ran, what failed, and why **without** the user opening Inngest's dashboard.

### Scheduled functions

All crons are expressed in `Asia/Riyadh`.

| Function | Schedule | Does |
|---|---|---|
| `registration-expiry-sweep` | daily 03:00 | `approved` drones past `registrationExpiresAt` → `expired` via the [F14](./F14-workflow-and-audit.md) state machine, notify, email |
| `registration-expiry-reminders` | daily 03:15 | 60 / 30 / 7 days out → notification + email + audit event `drone.expiry_reminded` |
| `booking-closeout` | every 15 min | `approved` past `slotEnd`: `checkedInAt` set → `completed`; otherwise past `slotEnd + 30 min` → `no_show` |
| `booking-reminders` | hourly | 24 h before an approved slot → notification + email |
| `review-queue-digest` | hourly | Pending counts to reviewers; **skipped entirely when the queue is empty** |
| `rate-limit-sweep` | daily 04:00 | Delete `rate_limit_bucket` rows older than the longest window |

### Event-driven functions

| Event | Does |
|---|---|
| `drone/approved` | Render the QR PNG, store it, set `remote_id.qrPathname`, then send the approval email |
| `zone/closure.published` | Find every `pending`/`approved` booking overlapping the window, cancel each with `cancelled_by_closure`, notify each pilot individually |
| `drone/revoked` | Suspend the Remote ID, cancel every future booking for that drone |

**Fan-out uses one `step.run` per booking**, so a single failing notification retries alone rather than replaying cancellations that already succeeded. Every cancellation is idempotent — re-running the step on an already-cancelled booking is a no-op.

### Idempotency

Every job is safe to run twice. Sweeps re-query current state rather than trusting a passed-in list; each writes an audit event only when it actually changed something. A reminder writes a marker audit event, and the next run skips anyone who already has one for that threshold — a pilot must never get the same 30-day warning twice.

### Timezone correctness

`registrationExpiresAt` is `timestamptz`; "expires today" is evaluated against Riyadh local midnight, not UTC. A drone expiring at 00:30 Riyadh must not be swept the previous evening because UTC already rolled over. One unit test pins this.

### Controlling jobs from inside the app

The system page ([F29](./F29-system-ops-page.md)) lists runs with status, duration, and error, and offers:

- **Cancel** → labelled **"cancelling"**, never "cancelled" — it takes effect at the next step boundary.
- **Re-run** → starts a *new* run and shows the new id, rather than pretending the old one restarted.

### QR rendering

A server-side PNG (~512 px, high error correction) encoding `${APP_URL}/ar/rid/${code}`, stored via [F07](./F07-file-uploads.md) as `kind: 'qr'`. Rendered as a job rather than inline because it must survive a transient storage failure and retry. Regenerating is idempotent — same code, same URL, overwrite the same pathname.

> **Deploy trap:** the QR encodes `APP_URL` at render time. If `APP_URL` is still `localhost` when the first drone is approved in production, every printed sticker is dead. [F29](./F29-system-ops-page.md)'s health check flags a non-production `APP_URL` for exactly this reason.

## Files

```
src/lib/inngest/client.ts
src/lib/inngest/functions/{expiry-sweep,expiry-reminders,booking-closeout,
                           booking-reminders,review-digest,rate-limit-sweep,
                           qr-render,closure-fanout,drone-revoked}.ts
src/lib/inngest/jobs-table.ts       run mirroring
src/app/api/inngest/route.ts
src/lib/qr/render.ts
```

## Acceptance criteria

- [ ] `npx inngest-cli dev` connects to `/api/inngest` and lists every registered function.
- [ ] Each function can be triggered manually from the Inngest dev dashboard and completes.
- [ ] A drone with `registrationExpiresAt` in the past moves to `expired` **through the state machine**, not by direct update — the audit event has `actorIsSystem: true`.
- [ ] Running `registration-expiry-sweep` twice produces exactly **one** audit event and one email.
- [ ] A drone at 29 days out gets the 30-day reminder once; re-running the same day sends nothing.
- [ ] A drone expiring at 00:30 Riyadh is **not** swept on the previous Riyadh day.
- [ ] An approved booking with `checkedInAt` set and a past `slotEnd` becomes `completed`; without check-in and past `slotEnd + 30m` it becomes `no_show`.
- [ ] Publishing a closure that overlaps 3 approved bookings cancels all 3, sends 3 distinct notifications, and writes 3 audit events.
- [ ] Forcing a failure in one booking of that fan-out leaves the other two cancelled and retries only the failed step.
- [ ] `review-queue-digest` sends **nothing** when the queue is empty.
- [ ] Approving a drone renders a QR PNG, stores it, sets `qrPathname`, and the PNG scans to `${APP_URL}/ar/rid/{code}`.
- [ ] Every run appears in the `jobs` table and on the system page with status and duration.
- [ ] Cancel is labelled "cancelling"; re-run shows a new run id.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
