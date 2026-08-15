# F28 — Account Settings

**Wave:** 8 (third) · **Depends on:** [F05](./F05-auth-roles-access.md), [F17](./F17-pilot-profile.md), [F27](./F27-legal-pages.md) · **Skill reference:** `references/settings.md`

## Purpose

Where a pilot manages their own account: identity, language, password, devices, notifications, and leaving. Scaled to what this app actually has — **an empty section is worse than a missing one.**

## Technical design

### Sections — only the ones this app earns

| Section | Included? | Why |
|---|---|---|
| Profile | ✓ | Name, ID, mobile, city — from [F17](./F17-pilot-profile.md) |
| Language | ✓ | The app is bilingual; `preferredLocale` drives emails too |
| Security | ✓ | Password, active sessions |
| Notifications | ✓ | [F15](./F15-notifications.md) sends real categories |
| Danger zone | ✓ | Account deletion |
| System | ✓ | Admin only — [F29](./F29-system-ops-page.md) |
| **Billing** | ✗ | **No payments.** An empty Billing tab would be a lie. |
| **Connected apps** | ✗ | **No agent access.** Same reason. |

### Profile — `/[locale]/settings/profile`

Reuses [F17](./F17-pilot-profile.md)'s form and rules:

- National ID rendered `•••••1234` **even to its owner**, with a Reveal that requires confirmation and writes an audit event.
- Changing the ID or date of birth **clears `verifiedAt`**, warns first, and writes an audit event.
- Every change writes an audit event with before/after.
- Identity verification state shown plainly: *verified by a GACA reviewer on {date}*, or *pending review*. Never implies automated verification.

### Language — `/[locale]/settings/language`

Sets `user.preferredLocale`. Explains that this controls **emails and notifications**, not just the interface — a pilot who switches to English should know their approval emails will follow.

Switching navigates to the equivalent path in the new locale, preserving where they were.

### Security — `/[locale]/settings/security`

- **Change password** — current password required, new password confirmed. Rate-limited ([F09](./F09-rate-limiting.md)).
- **Email address** — change with re-verification, if [F06](./F06-transactional-email.md) is configured; otherwise the control explains why it's unavailable rather than failing silently.
- **Active sessions** — device, browser, approximate location from `ipHash` region if resolvable, last active. Revoke one, or **revoke all others**. The current session is labelled and cannot be revoked from here.

### Notifications — `/[locale]/settings/notifications`

Only the categories [F15](./F15-notifications.md) actually sends: booking reminders, registration expiry, zone closures.

**States in plain words that decisions cannot be turned off:** *"Approval and rejection notices are always sent."* Letting someone unsubscribe from "your registration was rejected" would be a compliance failure dressed as a preference, and the UI should say so rather than hide the toggle.

**No cookie-preferences section** — [F27](./F27-legal-pages.md) built no banner, so there is nothing to reopen.

### Danger zone — `/[locale]/settings/account`

Deletion requires typing the account's email to confirm, and states clearly what happens:

| Data | On deletion |
|---|---|
| Account, profile, sessions | Deleted |
| Drones, photos, documents | Deleted, including stored blobs |
| Bookings | Deleted |
| **Remote ID records** | **Retained, anonymised** — the code stays resolvable as "registration withdrawn" |
| **Audit events** | **Retained** with `actorUserId = null` |

**Deletion is refused while an approved future booking exists** — an authorised flight with no accountable operator is exactly what the platform exists to prevent. The message names the bookings and offers to cancel them.

Deletion is blocked entirely for the **last admin**, with an explanation.

Every point above must match [F27](./F27-legal-pages.md)'s privacy policy word for word in substance.

### Navigation

Settings hangs off the nav built in [F16](./F16-public-landing.md). Admins additionally see **System** ([F29](./F29-system-ops-page.md)) — conditional on `role === 'admin'`, so no dead link appears for anyone else.

## Files

```
src/app/[locale]/(app)/settings/layout.tsx          section nav
src/app/[locale]/(app)/settings/{page,profile,language,security,notifications,
                                 account}/page.tsx
src/lib/actions/settings.ts        changePassword, revokeSession, setLocale,
                                   setNotificationPrefs, deleteAccount
src/components/settings/{section-nav,session-list,delete-account-dialog,
                         notification-toggles,verification-status}.tsx
```

## Acceptance criteria

**Only real sections**
- [ ] **No Billing section exists anywhere.**
- [ ] **No Connected apps / agent access section exists.**
- [ ] **No cookie-preferences control exists** (no banner was built).
- [ ] Notification categories are exactly the three the app sends — no category for anything it doesn't.
- [ ] Every section listed in the nav resolves to a page with real content.

**Profile**
- [ ] The national ID renders masked **to its owner**; revealing requires confirmation and writes an audit event.
- [ ] Changing the ID clears `verifiedAt`, warns first, and writes an audit event.
- [ ] Verification state reads as reviewer-performed, never automated.
- [ ] Every profile change writes an audit event with before/after.

**Language & security**
- [ ] Changing language updates `preferredLocale`, and the **next email arrives in the new language**.
- [ ] The page explains that language affects emails, not only the interface.
- [ ] Switching preserves the current path.
- [ ] Changing the password requires the current one; a wrong one is rejected.
- [ ] After a password change the other sessions are invalidated.
- [ ] Password changes are rate-limited.
- [ ] Active sessions list real sessions; revoking one signs that device out.
- [ ] The current session is labelled and not revocable from the list.
- [ ] With no `RESEND_API_KEY`, the email-change control **explains why it's unavailable** rather than failing silently.

**Notifications**
- [ ] Toggling a category persists and takes effect.
- [ ] The page states in plain words that decision notices cannot be disabled.
- [ ] Disabling everything still delivers `drone.rejected`.

**Deletion**
- [ ] Requires typing the account email; a mismatch blocks it.
- [ ] The dialog lists exactly what is deleted and what is retained.
- [ ] That list matches the privacy policy in substance.
- [ ] Deletion removes the account, profile, drones, bookings, **and stored blobs**.
- [ ] Remote ID records survive, anonymised; the code still resolves as "registration withdrawn".
- [ ] Audit events survive with `actorUserId = null`.
- [ ] Deletion is **refused** while an approved future booking exists, naming those bookings.
- [ ] Deletion is blocked for the last admin, with an explanation.

**Access & UI**
- [ ] Pilot B cannot reach or modify pilot A's settings.
- [ ] The **System** link appears only for admins — no dead link for pilots or reviewers.
- [ ] Every settings page renders correctly in Arabic RTL at 375 px.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
