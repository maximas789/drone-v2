# F27 — Legal Pages

**Wave:** 8 (second) · **Depends on:** every feature branch, and [F26](./F26-help-documentation.md) · **Skill reference:** `references/legal.md`

## Purpose

What this app owes its users, worked out from what it actually is and does — not asked, and not templated.

## The decision, made

Ajniha is **a public product other people sign up for**, holding national identity documents and location data.

| | Decision |
|---|---|
| **Privacy policy** | **Required.** It holds national IDs, Iqama numbers, mobile numbers, dates of birth, drone photographs, flight locations and times, and a permanent audit trail. |
| **Terms of service** | **Required.** People sign up, submit registrations for review, and book time slots — there is a second party and a set of mutual obligations. |
| **Cookie banner** | **No.** See below. |

### Why no cookie banner

The test is not "does it set a cookie" but "does anything non-essential load".

- The **Better Auth session cookie** is strictly necessary — without it, signing in doesn't work.
- The **locale cookie** is strictly necessary — it's the user's own language choice.
- **OpenFreeMap tiles** are third-party, but they are the feature the person asked for, they set no cookies, and they do no profiling or cross-site tracking. They're disclosed in the privacy policy as a recipient of the user's IP address; they are not something to consent to.
- **No analytics, no advertising, no third-party trackers.**

There is nothing non-essential to consent to, so a banner would be theatre — a click that changes nothing, training users to dismiss consent without reading it. **What would change this:** adding analytics, an embedded video, or any advertising. That trigger is written into the hand-off so the decision is revisitable rather than forgotten.

### Saudi context

The privacy policy addresses **Saudi PDPL** (Personal Data Protection Law) alongside general principles — data-subject rights, lawful basis, retention, and cross-border transfer, since the app may be hosted outside the Kingdom. **This is a first draft assembled from what the app does, not legal advice**, and it says so at the top.

## Technical design

### Privacy policy — what it must disclose

Assembled branch by branch from what was actually built:

| Branch | Disclosure |
|---|---|
| Database (always) | What is stored, **in the app's own nouns** — pilots, drones, Remote IDs, zones, bookings — and that it lives in its own database |
| [F05](./F05-auth-roles-access.md) auth | Email address and a password **hash**; a session cookie is set |
| [F17](./F17-pilot-profile.md) profile | **National ID / Iqama, date of birth, mobile.** Why each is needed, that IDs are stored hashed for uniqueness, that reviewers can reveal them, and **that every reveal is logged** |
| [F07](./F07-file-uploads.md) storage | Photos and documents sit in the project locally and in Vercel Blob once deployed |
| [F06](./F06-transactional-email.md) email | Resend delivers the mail; a decision notice is not marketing |
| [F08](./F08-background-jobs.md) jobs | Inngest runs work on their data outside the request they made |
| [F20](./F20-airspace-map.md) map | OpenFreeMap receives the user's IP when tiles load; it sets no cookies and does no profiling |
| [F11](./F11-remote-id-redaction.md) Remote ID | **The most important section.** Exactly what an anonymous scanner sees, what an owner sees, what an authority sees, that authorities can reveal identity with a logged reason — cross-checked field by field against the masking table |
| [F14](./F14-workflow-and-audit.md) audit | An append-only record of every decision that **outlives account deletion**, and why |

**Retention** must match reality: registrations run 3 years; audit events are retained beyond account deletion with the actor anonymised; scan logs are kept for compliance review. **Claim only what the code keeps** — a policy promising 30-day deletion that the app doesn't implement is a false statement, not a nicety.

### Terms — what it must cover

Eligibility (18+, valid Saudi identity document), that **registration is a proposal-stage service and not a substitute for GACA authorisation** (the single most important clause — nobody must read this app as legal permission to fly), that approval is discretionary and by human review, obligations to fly within zone rules and hold a valid registration, grounds for revocation, no-show consequences, cancellation, warranty disclaimer, limitation of liability, and governing law.

The prominent statement — repeated in the app, not buried in the terms — is that **Ajniha is a proposed initiative and not an official GACA system.**

### Structure

`src/lib/legal.ts` holds the fields only a human can fill, so they are one file to complete rather than scattered through prose:

```ts
CONTACT_EMAIL, ORGANISATION_NAME, GOVERNING_LAW, JURISDICTION, EFFECTIVE_DATE
```

Pages at `/[locale]/privacy` and `/[locale]/terms`, bilingual, with a last-updated date and a table of contents.

Footer links added by this feature — [F16](./F16-public-landing.md) left the footer ready and added nothing on spec. Sign-up carries an acceptance line ("by creating an account you agree to…") with working links; not a pre-ticked checkbox.

## Files

```
src/app/[locale]/(public)/privacy/page.tsx
src/app/[locale]/(public)/terms/page.tsx
src/lib/legal.ts
src/components/layout/site-footer.tsx      (extended)
content/legal/{ar,en}/{privacy,terms}.mdx
```

## Acceptance criteria

**Accuracy — the part that matters**
- [ ] Every data category the app actually stores appears in the privacy policy, in the app's own nouns.
- [ ] Every third-party recipient that actually receives data is named: Resend, Vercel Blob, Inngest, OpenFreeMap. **No others are named**, and none that receives data is omitted.
- [ ] The Remote ID section matches [F11](./F11-remote-id-redaction.md)'s masking table **field by field** — checked line against line, not summarised.
- [ ] It states that authorities can reveal identity and that every reveal is logged.
- [ ] Retention claims match what the code does — no promised deletion the app doesn't perform.
- [ ] The policy states audit events survive account deletion, and why.
- [ ] It states national IDs are stored hashed for uniqueness alongside the plaintext needed for review.
- [ ] Saudi PDPL is addressed.
- [ ] Both pages open with a plain statement that they are a first draft, not legal advice.

**Terms**
- [ ] Terms state prominently that Ajniha is **not** a substitute for GACA authorisation.
- [ ] Terms state Ajniha is a **proposed initiative, not an official GACA system**.
- [ ] Revocation grounds, no-show consequences, and cancellation rules match what [F14](./F14-workflow-and-audit.md) actually implements.
- [ ] Eligibility matches the 18+ check in [F17](./F17-pilot-profile.md).

**Cookie decision**
- [ ] **No cookie banner exists.**
- [ ] Only the session cookie and the locale cookie are set — verified in devtools on a signed-in page load.
- [ ] No analytics, advertising, or tracking script is present anywhere.
- [ ] The privacy policy explains why there's no banner.

**Wiring**
- [ ] `src/lib/legal.ts` contains every human-fillable field, and the pages read from it — no contact address hard-coded in prose.
- [ ] Both pages exist in `ar` and `en`, right-aligned in Arabic with a working table of contents.
- [ ] Footer links to Privacy and Terms resolve in both locales.
- [ ] Sign-up shows an acceptance line with working links, **not** a pre-ticked checkbox.
- [ ] Both pages are reachable signed out and render at 375 px.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
