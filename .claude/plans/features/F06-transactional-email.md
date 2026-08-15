# F06 — Transactional Email

**Wave:** 4 · **Depends on:** [F05](./F05-auth-roles-access.md) · **Skill reference:** `references/email.md`
**⚠ This is the only Wave 4 feature that edits `src/lib/auth.ts` — serialise that edit against the other parallel agents.**

## Purpose

Every email the app sends, in the recipient's own language, recorded so that "why didn't that email arrive?" has an answer inside the app rather than on a hosting dashboard.

## Technical design

### Provider

Resend, via `src/lib/email/send.ts`. Three-state behaviour, decided by env:

| Condition | Behaviour |
|---|---|
| No `RESEND_API_KEY` | Render the email, **print it to the terminal**, write an `email_log` row with `status: 'skipped'`. Nothing breaks. |
| Key present, domain unverified | Sends only to the account owner's address; a send to anyone else logs `status: 'failed'` with Resend's actual error. |
| Key present, domain verified | Normal delivery. |

This is what lets the entire approval workflow be tested end to end before a domain exists.

### `sendEmail()` contract

```ts
sendEmail({ to, template, params, locale, userId?, entityId? })
```

- Writes an `email_log` row **before** the network call, then updates it with `providerId` or `error`.
- Never throws into a server action. A failed email must not roll back an approval — the decision is the transaction, the email is a consequence.
- Called from Inngest ([F08](./F08-background-jobs.md)) wherever a retry is wanted; called inline only for auth flows, where immediacy matters more than durability.

### Locale

Every email renders in the recipient's `preferredLocale`, **not** the locale of the person who triggered it. A reviewer working in English approving an Arabic-speaking pilot's drone sends an Arabic email. `email_log.locale` records which was used.

Arabic emails need `dir="rtl"` on the table wrapper and inline `text-align: start` — email clients ignore most CSS, so direction goes on the elements themselves.

### Templates (React Email)

| Template | Trigger | Contains |
|---|---|---|
| `verify-email` | Sign-up | Verification link |
| `reset-password` | Forgot password | Reset link, expiry |
| `drone-approved` | [F14](./F14-workflow-and-audit.md) | **The Remote ID code**, valid-until date, link to the digital ID card |
| `drone-rejected` | F14 | The reviewer's reason **verbatim**, and what to fix |
| `drone-expiring` | [F08](./F08-background-jobs.md) cron | Days remaining, renew link |
| `drone-expired` | F08 cron | That bookings are now blocked, renew link |
| `booking-approved` | F14 | Zone, slot time (Riyadh, Gregorian, Latin numerals), ceiling, check-in link |
| `booking-rejected` | F14 | Reason verbatim, alternative slots |
| `booking-cancelled-by-authority` | F14 | Reason, marked high-priority |
| `booking-reminder` | F08 cron | 24 h before the slot |
| `review-queue-digest` | F08 cron, hourly | To reviewers: counts pending, **no pilot PII** |

All dates and times go through `src/lib/format.ts` — no email may format a date itself.

**Never in an email:** a national ID, a full mobile number, a password, or a session token. The reviewer digest carries counts and links only.

### Better Auth wiring

Extend `src/lib/auth.ts` with `emailVerification.sendVerificationEmail` and `emailAndPassword.sendResetPassword`, both calling `sendEmail`. Then **re-run the Better Auth CLI → `db:generate` → `db:migrate`**, because `emailVerification` changes the generated schema.

### Preview route

`/[locale]/dev/emails` — development-only, gated on `NODE_ENV !== 'production'`, listing every template rendered in both locales with sample params. This is how the Arabic layout gets checked without sending anything.

## Files

```
src/lib/email/send.ts
src/lib/email/templates/*.tsx
src/lib/email/layout.tsx            shared RTL-aware shell
src/lib/auth.ts                     (extended — serialised edit)
src/app/[locale]/dev/emails/page.tsx
.env                                RESEND_API_KEY, EMAIL_FROM
```

## Acceptance criteria

- [ ] With **no** `RESEND_API_KEY`, triggering an approval prints the rendered email to the terminal and writes an `email_log` row with `status: 'skipped'` — and the approval itself still succeeds.
- [ ] With a key set, a send to the account owner's address arrives and `email_log` records the Resend `providerId`.
- [ ] A forced provider failure writes `status: 'failed'` with the real error message, and **does not roll back** the approval that triggered it.
- [ ] An Arabic-locale pilot approved by an English-locale reviewer receives an **Arabic** email; `email_log.locale = 'ar'`.
- [ ] Every template renders in both locales at `/dev/emails`; the Arabic versions are right-aligned with `dir="rtl"`.
- [ ] Every date in every email is Gregorian with Latin numerals, in Riyadh time.
- [ ] `drone-approved` contains the Remote ID code and a working card link.
- [ ] `drone-rejected` contains the reviewer's reason **verbatim**.
- [ ] No template contains a national ID, a full mobile number, or a token — verified by reading each rendered output.
- [ ] The `/dev/emails` route returns 404 when `NODE_ENV=production`.
- [ ] Better Auth CLI regenerated, `db:generate` + `db:migrate` run after the `auth.ts` edit.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
