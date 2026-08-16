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

Extend `src/lib/auth.ts` with `emailVerification.sendVerificationEmail` and `emailAndPassword.sendResetPassword`, both calling `sendEmail`. Then **re-run the Better Auth CLI → `db:generate` → `db:migrate`**.

> **Built, and two things turned out differently.**
>
> 1. **`emailVerification` changes no schema.** The CLI was re-run and produced `src/lib/db/auth-schema.ts` byte-identical to before — `verification` and `user.emailVerified` already existed from F05. `db:generate` said "No schema changes"; there is no F06 migration. The three steps were still run, because "it probably doesn't change the schema" is not evidence.
> 2. **`sendEmail` is imported dynamically inside the callbacks**, not at the top of `auth.ts`. It reaches `@/lib/db`, which carries `server-only`, and the CLI refuses any config that reaches it — the same trap F05 hit with `src/lib/db/index.ts`. A dynamic `import()` inside a callback body is never evaluated at config-load time, so the CLI loads the file and the request path still gets the guarded module.
>
> 3. **The send must be deferred with Next's `after()`.** Better Auth `await`s
>    these callbacks *inside* the sign-up transaction, so `sendEmail`'s
>    `email_log` insert — whose `user_id` is a foreign key onto `user` — fails
>    against a row that is written but not yet committed, over a different
>    pooled connection. The account is created, the response is 200, and the
>    email vanishes. Found only when a real person signed up; no check we run
>    would have caught it.
>
> `requireEmailVerification` stays **`false`**. With no API key the verification message only reaches the terminal, so requiring it would lock every new account out of the app it just created.

### Preview route

`/[locale]/dev/emails` — development-only, gated on `NODE_ENV !== 'production'`, listing every template rendered in both locales with sample params. This is how the Arabic layout gets checked without sending anything.

## Files

```
src/lib/email/send.ts               the only file that talks to Resend
src/lib/email/config.ts             emailConfigured / EMAIL_FROM — no db, no server-only
src/lib/email/i18n.ts               request-free translator (createTranslator)
src/lib/email/render.ts             template → { subject, html, text }
src/lib/email/types.ts              the EmailTemplate shape
src/lib/email/layout.tsx            shared RTL-aware shell
src/lib/email/templates/*.tsx       11 templates
src/lib/email/templates/index.ts    the typed registry
src/lib/email/templates.test.ts     every template × both locales
src/lib/url.ts                      APP_URL / absoluteUrl / localeUrl
src/lib/format.ts                   (+ intlLocaleTag, for ICU's own numbers)
src/lib/auth.ts                     (extended — serialised edit)
src/app/[locale]/dev/emails/page.tsx
messages/{ar,en}.json               the `email` namespace
.env                                RESEND_API_KEY, EMAIL_FROM
```

**Four files the spec did not name, and why each exists.**

- **`config.ts`** — the auth pages need to know whether mail actually goes anywhere so they can say so, and `auth.ts` must stay free of `server-only`. Splitting the two-line env read out of `send.ts` is what lets both read it.
- **`i18n.ts`** — `getTranslations()` cannot be used. Mail is sent from a Route Handler (where `next/root-params` throws, Open Thread 4), from an Inngest function (F08, no request at all), and from the preview page. `createTranslator` is next-intl's request-free core.
- **`render.ts`** — the preview page and the test suite render without touching the database, so what `/dev/emails` shows is what `sendEmail` sends.
- **`src/lib/url.ts`** — an email has no origin to be relative to. F19's QR codes will want the same function.

**`format.ts` gained `intlLocaleTag`.** ICU does its own number formatting for `{days, plural, … #}`, and a bare `ar` emits `٣`. The translator is given `ar-SA-u-ca-gregory-nu-latn` instead, which still selects the Arabic plural category.

**`email_log.status` takes `queued → skipped | sent | failed`.** The skill's reference file says `logged`; this feature file says `skipped`, and the feature file won.

## Acceptance criteria

- [x] With **no** `RESEND_API_KEY`, triggering an approval prints the rendered email to the terminal and writes an `email_log` row with `status: 'skipped'` — and the approval itself still succeeds. *(There is no approval workflow until F14, so this was run against `sendEmail` directly: both sends printed in full, both rows landed as `skipped`, and the caller reached the line after them. Rows deleted afterwards.)*
- [ ] With a key set, a send to the account owner's address arrives and `email_log` records the Resend `providerId`. **Not run — needs a Resend account.**
- [x] *(added)* **Signing up actually sends the verification email.** Not originally listed, and it was broken — see the `after()` note above. Now proven against a real sign-up: a `verify-email` row, in the recipient's locale, linked to the user.
- [x] A forced provider failure writes `status: 'failed'` with the real error message, and **does not roll back** the approval that triggered it. *(Run with a deliberately invalid key: `status: 'failed'`, `error: 'API key is invalid'` — Resend's own words — and the caller continued.)*
- [x] An Arabic-locale pilot approved by an English-locale reviewer receives an **Arabic** email; `email_log.locale = 'ar'`. *(The same event was sent for an `ar` and an `en` recipient; the two rows differ in `locale` and in `subject`.)*
- [x] Every template renders in both locales at `/dev/emails`; the Arabic versions are right-aligned with `dir="rtl"`. *(22 iframes, all 11 × 2 present over HTTP. **No browser was used** — see Open Thread 11.)*
- [x] Every date in every email is Gregorian with Latin numerals, in Riyadh time. *(Asserted per template per locale in `templates.test.ts`; proven to fail when the forced locale tag is removed.)*
- [x] `drone-approved` contains the Remote ID code and a working card link.
- [x] `drone-rejected` contains the reviewer's reason **verbatim**.
- [x] No template contains a national ID, a full mobile number, or a token — verified by reading each rendered output, and asserted per template.
- [x] The `/dev/emails` route returns 404 when `NODE_ENV=production`.
- [x] Better Auth CLI regenerated, `db:generate` + `db:migrate` run after the `auth.ts` edit. *(No schema change — see above.)*
- [x] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
