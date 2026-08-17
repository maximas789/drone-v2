# F15 — Notifications

**Wave:** 5 · **Depends on:** [F06](./F06-transactional-email.md), [F14](./F14-workflow-and-audit.md)

## Purpose

Tell people what happened, inside the app and by email, in their own language — and make it possible to answer "why didn't that reach me?" without leaving the app.

## Technical design

### Never store rendered text

```
type      'droneApproved'                    a key under the `notifications` namespace
params    { drone, zoneAr, zoneEn, days }    structured values, always strings
href      '/drones/{id}'                     locale-less; `Link` prefixes /[locale]
```

**Built:** the type keys are **camelCase**, not dotted — `droneApproved`, not
`notification.drone.approved`. The catalogue and every writer have used that
shape since F08, and renaming them to match this file would have been a
556-key edit to satisfy a spec nobody had implemented.

`params` values are **strings, never numbers**. ICU formats a bare numeric
argument itself and emits Arabic-Indic digits under `ar` — `٣٠` in a sentence
whose whole point is a date the pilot has to act on (build-log thread 22).

A pilot who switches from Arabic to English must see **old** notifications in English. Storing rendered strings freezes them in whichever language happened to be active when the event fired.

`params` carries **both** name variants where the parameter is itself a
bilingual entity (a zone name), so rendering needs no join.

**Collapsing the pair is this feature's job, and `collapseParams` is where it
happens.** F08 left the seam open deliberately: `notify()` demands both
variants, while `i18n:check` forbids a catalogue where `ar` says `{zoneAr}` and
`en` says `{zoneEn}`. The renderer is the first point that knows which language
the reader chose, so it is the only place the collapse *can* happen. A pair is
collapsed only when **both** halves are present, so a param that merely ends in
`En` is left alone.

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

### Where the types come from

`NOTIFICATION_TYPES` in `src/lib/notifications/render.ts` is the list, and
`render.test.ts` checks it in **three** directions:

1. every type has a message in both catalogues;
2. no catalogue key is a type the app cannot write;
3. **every `type:` literal in the source is a known type** — read out of the
   files, because a catalogue check cannot see a writer that invents one, and
   the failure renders the raw key `notifications.whatever` to the single
   person it was written for.

### In-app surfaces

- **Bell in the header** with an unread count (Latin numerals), showing the 10 most recent.
- **`/[locale]/notifications`** — the full list, filterable by unread, grouped by **Riyadh** civil day using `formatDate`. The same day key the slot grid uses: a notification written at 01:00 Riyadh belongs to that day for everyone reading it, or two people looking at one list would see different headings.
- **Mark one read** on click-through; **mark all read** as a bulk action.
- Every item is a link to the entity, prefixed with the active locale.
- Empty state reads as intentional in both languages — not a blank panel.

Unread counts are fetched server-side on navigation. No polling, no websockets — this app does not need real-time and adding it would be complexity with no user benefit.

### Preferences live on the notifications page

Not on a settings page: **F28 owns account settings and does not exist yet**,
and a Settings section holding a single panel would be a claim about a page the
app does not have. F28 may move it.

The three categories are the three that are genuinely optional. A decision
carries **no category at all**, which is what makes it unswitchable by
construction rather than by a rule somebody has to remember — and the panel says
so in plain words rather than leaving a pilot to discover it.

### Ownership

Notifications are strictly per-user. `getNotifications(session)` scopes by `userId` with no exception — a reviewer does not see a pilot's notifications, and vice versa. Marking read verifies ownership before the update.

## Files

```
src/lib/notify.ts                      notify(), respecting preferences  (F08)
src/lib/notifications/render.ts        PURE: types, collapseParams
src/lib/data/notification.ts           reads, mark-read, preferences, email link
src/lib/actions/notification.ts        markRead, markAllRead, setPreference
src/app/[locale]/(app)/notifications/page.tsx
src/app/[locale]/(app)/layout.tsx      the shell header the bell lives in
src/components/notifications/notification-{bell,list,item,preferences}.tsx
messages/{ar,en}.json                  notifications.* keys
scripts/probe-notifications.mts        seeds a spread; `clean` removes it
```

`src/lib/data/notification.ts` is **exempt from ESLint rule 11**, for the
`jobs-table.ts` reason rather than the workflow one: read/unread is not a domain
status — no transitions, no actor, nothing to notify, nothing a regulator would
audit.

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
- [ ] Forcing the **email** to fail leaves the approval and the in-app notification intact, with `email_log.status = 'failed'` and the provider error readable on the system page. *(F06 proved the failure path; the system page is F29's.)*
- [ ] `notification.emailLogId` links to the right `email_log` row. *(Built on the **approval path only** — `linkNotificationEmail` matches on `(userId, entityId)`, both set by the code that wrote them, and `qr-render` calls it after the send. The expiry sweep, reminders and closure fan-out do not link yet: build-log thread 43.)*
- [ ] The bell shows an accurate unread count in Latin numerals and clears on read.
- [ ] Pilot B cannot read or mark-read pilot A's notifications (attempt returns 404).
- [ ] The list renders correctly in Arabic RTL at 375 px, grouped by day with Gregorian Latin-numeral dates. *(Verified — and **the only technique that works** is a same-origin iframe 375 px wide, whose media queries evaluate at its own width. The automation tool's `resize_window` reports success and leaves the viewport at 1440; it has now failed six times. Build-log thread 44.)*
- [ ] The empty state reads as intentional in both languages.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
