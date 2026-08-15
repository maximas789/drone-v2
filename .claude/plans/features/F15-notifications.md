# F15 — Notifications

**Wave:** 5 · **Depends on:** [F06](./F06-transactional-email.md), [F14](./F14-workflow-and-audit.md)

## Purpose

Tell people what happened, inside the app and by email, in their own language — and make it possible to answer "why didn't that reach me?" without leaving the app.

## Technical design

### Never store rendered text

```
type      'notification.drone.approved'      an i18n key
params    { droneNickname, code, zoneNameAr, zoneNameEn, slotStart }
href      '/drones/{id}'                     locale-less; the renderer prefixes /[locale]
```

A pilot who switches from Arabic to English must see **old** notifications in English. Storing rendered strings freezes them in whichever language happened to be active when the event fired.

`params` carries **both** name variants where the parameter is itself a bilingual entity (a zone name), so rendering needs no join.

### Categories

| Type | Trigger | Email? | Respects preferences? |
|---|---|---|---|
| `drone.submitted` | Pilot submits | — | — |
| `drone.approved` | Reviewer approves | ✓ | **No** — transactional |
| `drone.rejected` | Reviewer rejects | ✓ | **No** — transactional |
| `drone.expiring` | Cron 60/30/7 days | ✓ | Yes (`registration_expiry`) |
| `drone.expired` | Cron | ✓ | **No** — it blocks flying |
| `drone.revoked` | Admin revokes | ✓ | **No** |
| `booking.approved` | Approval or auto-approve | ✓ | **No** |
| `booking.rejected` | Reviewer rejects | ✓ | **No** |
| `booking.cancelled_by_authority` | Authority cancels | ✓ | **No** — high priority |
| `booking.cancelled_by_closure` | Closure fan-out | ✓ | **No** |
| `booking.reminder` | 24 h before slot | ✓ | Yes (`booking_reminder`) |
| `booking.no_show` | Closeout job | — | Yes |
| `zone.closure_published` | Closure affecting a booking | ✓ | Yes (`zone_closure`) |
| `review.queue_pending` | To reviewers, hourly | ✓ (digest) | Yes |

**Approval and rejection decisions ignore `notification_preference` entirely, and the settings UI says so in plain words.** Letting someone unsubscribe from "your registration was rejected" would be a compliance failure dressed as a preference.

### Delivery

`notify()` is called **inside the same transaction** as the state change ([F14](./F14-workflow-and-audit.md)) — the in-app row and the status change commit together, or neither does.

The **email** is dispatched separately, via Inngest, after commit. A failing mail provider must never roll back an approval. `notification.emailLogId` links the two, which is what makes the system page able to answer "the notification exists, the email failed, here's the provider error".

### In-app surfaces

- **Bell in the header** with an unread count (Latin numerals), showing the 10 most recent.
- **`/[locale]/notifications`** — the full list, filterable by unread, grouped by day using `formatDate`.
- **Mark one read** on click-through; **mark all read** as a bulk action.
- Every item is a link to the entity, prefixed with the active locale.
- Empty state reads as intentional in both languages — not a blank panel.

Unread counts are fetched server-side on navigation. No polling, no websockets — this app does not need real-time and adding it would be complexity with no user benefit.

### Ownership

Notifications are strictly per-user. `getNotifications(session)` scopes by `userId` with no exception — a reviewer does not see a pilot's notifications, and vice versa. Marking read verifies ownership before the update.

## Files

```
src/lib/notify.ts                      notify(), respecting preferences
src/lib/data/notification.ts
src/lib/actions/notification.ts        markRead, markAllRead
src/app/[locale]/(app)/notifications/page.tsx
src/components/notifications/{bell,list,item}.tsx
messages/{ar,en}.json                  notification.* keys
```

## Acceptance criteria

- [ ] Approving a drone creates exactly **one** notification row for the owner and **zero** for anyone else.
- [ ] `notification.params` contains no rendered sentence — only structured values.
- [ ] A notification created while the user's locale was `ar` renders in **English** after they switch to `en`.
- [ ] A zone-related notification renders the zone name correctly in both locales **without a database join**.
- [ ] Every `notification.type` has a key in both catalogues; `i18n:check` passes.
- [ ] `href` is stored locale-less and rendered with the active locale prefix.
- [ ] Disabling `booking_reminder` in settings stops reminders; **`drone.rejected` still arrives** with the preference off.
- [ ] The settings page states in plain words that decision notifications cannot be disabled.
- [ ] The in-app row and the status change commit **together** — forcing a failure in `notify()` rolls back the approval.
- [ ] Forcing the **email** to fail leaves the approval and the in-app notification intact, with `email_log.status = 'failed'` and the provider error readable on the system page.
- [ ] `notification.emailLogId` links to the right `email_log` row.
- [ ] The bell shows an accurate unread count in Latin numerals and clears on read.
- [ ] Pilot B cannot read or mark-read pilot A's notifications (attempt returns 404).
- [ ] The list renders correctly in Arabic RTL at 375 px, grouped by day with Gregorian Latin-numeral dates.
- [ ] The empty state reads as intentional in both languages.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
