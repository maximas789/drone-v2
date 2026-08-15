# F17 — Pilot Profile

**Wave:** 6 · **Depends on:** [F05](./F05-auth-roles-access.md)

## Purpose

Collect the identity a regulator needs before a drone can be submitted for registration — and no more than that. An account exists from sign-up; a *pilot* exists once this is complete.

## Technical design

### Why a separate table

`pilot_profile` is 1:1 with `user` but deliberately not part of it. Better Auth's `additionalFields` are returned by `getSession` and therefore serialised into client components — a national ID would reach the browser on every page render. It also lets the app represent "signed up but not yet a pilot", which is a real state the wizard needs and which `pilot_profile_incomplete` refers to in [F12](./F12-airspace-engine.md).

### Fields

| Field | Validation |
|---|---|
| `fullNameAr` | Arabic script, 2–100 chars |
| `fullNameEn` | Latin script, 2–100 chars |
| `idDocumentType` | `saudi_national_id \| iqama \| gcc_id` |
| `idDocumentNumber` | 10 digits. **Saudi National ID / Iqama checksum validated** (Luhn-style, `1` prefix = citizen, `2` = resident) |
| `idDocumentHash` | `sha256(ID_HASH_PEPPER + number)`, unique |
| `dateOfBirth` | Gregorian; must be ≥ 18 years ago |
| `mobileE164` | `/^\+9665\d{8}$/` |
| `addressCityId` | FK to `city` |
| `addressLine` | Optional |
| `emergencyContact` | Optional, same mobile format |

### The ID hash

`idDocumentNumber` is stored in plaintext (a reviewer must be able to verify it against a document) **but** uniqueness is enforced through `idDocumentHash`, so there is no plaintext unique index to leak the set of registered IDs through timing or error messages. The pepper lives in `ID_HASH_PEPPER` and is never committed.

Duplicate registration returns a deliberately vague bilingual message — *"This identity document is already registered"* — without revealing which account holds it.

### Masking

`idDocumentNumber` renders as `•••••1234` **everywhere by default**, including for the owner. A reviewer sees the same mask with a **Reveal** control that requires a reason and writes an audit event ([F11](./F11-remote-id-redaction.md) uses the same mechanism). There is no screen in the app that shows a full national ID without a logged reveal.

### Mobile number

Recorded and validated in format, displayed to reviewers, **not verified by OTP**. No SMS provider is in scope, and a fake "verified" badge would be worse than an honest unverified one.

The verification that matters is **reviewer verification at approval time**: a reviewer confirms identity against the uploaded documents and sets `verifiedAt` / `verifiedByUserId`. That's a human check, which is what a regulator would want anyway. The UI says exactly this rather than implying automated verification.

`pilot_profile.mobileVerifiedAt` is deliberately **not** in the schema — an unused column implying a capability the app doesn't have.

### The wizard — `/[locale]/profile/complete`

Three steps, saving progress at each so a half-finished profile survives a closed tab:

1. **Name** — Arabic and English.
2. **Identity** — document type, number, date of birth.
3. **Contact** — mobile, city, address, emergency contact.

`completedAt` is set when every required field is present. `requirePilotProfile()` redirects here from any route needing a complete profile, with a `?next=` so the pilot returns to where they were going.

### Editing

`/[locale]/settings/profile` allows edits, with two rules:

- Changing `idDocumentNumber` or `dateOfBirth` **clears `verifiedAt`** and writes an audit event — identity re-verification is required. The UI warns before saving.
- Names and contact details can be changed freely; each writes an audit event with before/after.

### Arabic name input

The Arabic name field sets `dir="rtl"` and `lang="ar"` on the input itself, and the English field `dir="ltr"` — otherwise a Latin name typed into an RTL form renders with its punctuation in the wrong place.

## Files

```
src/lib/actions/profile.ts             savePilotProfile, updateProfile
src/lib/validation/saudi-id.ts         checksum + type detection
src/lib/validation/mobile.ts
src/lib/data/pilot.ts
src/app/[locale]/(app)/profile/complete/page.tsx
src/app/[locale]/(app)/settings/profile/page.tsx
src/components/profile/{wizard,step-name,step-identity,step-contact,masked-id}.tsx
src/lib/validation/__tests__/saudi-id.test.ts
```

## Acceptance criteria

- [ ] A valid Saudi National ID (`1` prefix, correct checksum) is accepted; a wrong checksum is rejected with a bilingual message.
- [ ] A valid Iqama (`2` prefix) is accepted; a 9- or 11-digit number is rejected.
- [ ] `+966501234567` is accepted; `0501234567` and `+14155551234` are rejected.
- [ ] A date of birth under 18 years ago is rejected.
- [ ] `idDocumentHash` is unique — a second account registering the same ID is refused with a message that **does not reveal** which account holds it.
- [ ] `ID_HASH_PEPPER` is in `.env`, gitignored, and present in `.env.example` as a placeholder.
- [ ] The national ID renders as `•••••1234` for the **owner**, not just for others.
- [ ] A reviewer revealing a national ID must give a reason, and an audit event is written.
- [ ] **No screen anywhere displays a full national ID without a logged reveal** — verified by grep for the field across components.
- [ ] `pilot_profile` has no `mobileVerifiedAt` column.
- [ ] The UI states that identity is verified by a GACA reviewer, and never implies automated or SMS verification.
- [ ] Abandoning the wizard at step 2 and returning restores the saved data.
- [ ] `completedAt` is set only when every required field is present.
- [ ] A pilot with an incomplete profile visiting `/drones/new` is redirected to the wizard and returned afterwards via `?next=`.
- [ ] Submitting a drone with an incomplete profile is refused with `pilot_profile_incomplete`.
- [ ] Changing the ID number clears `verifiedAt`, warns first, and writes an audit event.
- [ ] Changing a name writes an audit event with before/after.
- [ ] The Arabic name input is `dir="rtl"`, the English one `dir="ltr"`.
- [ ] The wizard renders correctly in Arabic RTL at 375 px; the date picker shows Gregorian dates with Latin numerals.
- [ ] Pilot B cannot read or edit pilot A's profile (404).
- [ ] `pnpm test` passes the Saudi ID checksum suite; `tsc`, `lint`, `build` pass.
