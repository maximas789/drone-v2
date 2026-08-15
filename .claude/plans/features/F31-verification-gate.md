# F31 — Verification Gate & Fresh Eyes

**Wave:** 9 · **Depends on:** every feature · **Skill reference:** `references/verify.md`

## Purpose

The app is built. Nothing yet establishes that it works. Every "Verify" section in every preceding feature was confirmed by the same agent that wrote the code it checks, and **recall is not evidence** — an app can satisfy every one of them while failing to compile.

## Technical design

### Order matters — two points that do damage if got wrong

1. **Schema before build.** `pnpm build` runs `db:migrate` first, so reaching it with an ungenerated schema edit outstanding applies SQL nobody read — the exact thing [F03](./F03-database-schema.md) forbids, performed by the step meant to catch it.
2. **The user signs up before any probe account exists.** The first account created becomes the admin ([F05](./F05-auth-roles-access.md)). A test fixture that takes that slot and is then deleted locks the user out of their own system page permanently.

### The gate

| # | Check | Command |
|---|---|---|
| 1 | Types | `pnpm exec tsc --noEmit` |
| 2 | Schema drift | `pnpm db:generate` — **must produce no new migration** |
| 3 | Migrations | `pnpm db:migrate` |
| 4 | Build | `pnpm build` — read the route table it prints |
| 5 | Lint | `pnpm lint` |
| 6 | Unit tests | `pnpm test` |
| 7 | i18n parity | `pnpm i18n:check` |
| 8 | Production serve | `pnpm start` |
| 9 | Every route answers | curl each route from `public-pages.ts` + authenticated routes with a session cookie |
| 10 | Two accounts | Cross-check A against B |
| 11 | Keys removed | Unset `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN` — the app still serves |

Read the output of each. Having written the code a command tests is the reason to run it, not a reason to skip it.

### Domain test suite

| Area | Cases |
|---|---|
| Geometry | Point in a permitted zone inside restricted airspace → allowed · point in a no-fly zone overlapping a permitted zone → denied · point in the KKIA interior ring → not contained · point on a shared edge → exactly one zone · reversed coordinates → type error |
| Slots | Window boundary · 90-min slot in a 5-hour window · Friday double windows · Riyadh-midnight day boundary |
| Concurrency | Capacity 1, two simultaneous bookings → one row · capacity 3, five simultaneous → three rows, seats 0/1/2 |
| Codec | 100 000 codes: no `I`/`L`/`O`/`U`, no duplicates · normalisation of every ambiguous character |
| Redaction | One assertion per viewer level against the [F11](./F11-remote-id-redaction.md) masking table |
| Workflow | Every legal transition succeeds · every illegal one returns `invalid_transition` and writes nothing |
| Format | `RIYADH_OFFSET_MINUTES === 180` in January and July · no Hijri output |
| Saudi ID | Valid citizen and resident numbers · wrong checksum rejected |

### The end-to-end walkthrough — performed by hand, in Arabic

This is the demo, and it is the real acceptance test:

1. Sign up (**this account is the admin** — it is the user's own).
2. Sign up a second account as the pilot.
3. Complete the pilot profile with a valid Saudi ID.
4. Register a **self-built FPV drone with no serial number**.
5. Submit → confirm it lands `pending`, not auto-approved.
6. As admin, open the review queue → see the "no serial number" badge → approve.
7. Confirm: Remote ID issued, 3-year validity, QR rendered, in-app notification, email logged.
8. As the pilot, open the digital ID card → **scan the QR with a real phone**.
9. **Signed out**, confirm the scan page shows status but **no owner identity**.
10. As admin, use Reveal → confirm the audit event was written **before** the value returned.
11. As the pilot, open the map → tap a permitted zone → allowed → book a slot.
12. Confirm the booking state matches the zone's `autoApprove`.
13. Race the last seat from two browsers → one booking, one graceful refusal with alternatives.
14. Check the system page: the decision, the notification, and the email are all traceable.

### Fresh eyes

Four critic agents dispatched **in a single message** so they run at once, reading captured evidence rather than the running app — four agents cannot share a port.

| Critic | Brief |
|---|---|
| **Promise-keeping** | Does the app do what the [implementation plan](../implementation%20plan.md) §1 demo says, end to end? |
| **Ownership** | Can pilot B reach anything of pilot A's? Can a pilot reach `/admin`? Does any query miss its `userId` scope? Does any surface bypass `redactRemoteId`? |
| **Looks like theirs** | Any lorem ipsum, "Item", default titles, English-only strings, empty sections, fabricated testimonials, or implied GACA endorsement? |
| **Operability** | Can the operator see what happened, why an email failed, what's running, and stop it — **from inside the app**? |

They check against **this plan and its feature specs, and nothing else** — that is what the user approved. Critics report divergence; they never propose a different plan. Findings come back as `broken`, `missing`, or `worth knowing`; only the first two are fixed now, and **no fix widens the gate or changes scope**.

**Two rounds, then stop and report what's left.** A third round is where an agent starts editing code it doesn't understand to make a report go away.

### Named as un-runnable

Stated plainly, never assumed:

- Sending email to any address other than the account owner's — needs a verified domain in DNS.
- Vercel Blob uploads — needs a deployed store; the local driver is exercised instead.
- The OG preview card as a third party sees it — needs a public domain.
- QR codes encoding a production URL — needs `APP_URL` set to a real domain.
- Printed-QR scanning at 20 mm — needs a printer and a phone.
- Inngest production sync — needs a first deploy.

## Files

```
scripts/verify/{routes.sh,two-accounts.sh,no-keys.sh}
docs/VERIFICATION.md              evidence capture for the critics
```

## Acceptance criteria

**The gate**
- [ ] `pnpm exec tsc --noEmit` — zero errors.
- [ ] `pnpm db:generate` produces **no new migration** (no schema drift).
- [ ] `pnpm db:migrate` applies cleanly against a **fresh** database.
- [ ] `pnpm build` succeeds; the printed route table matches the intended route map.
- [ ] `pnpm lint` — zero errors, including the RTL, locale-format, and airspace-purity rules.
- [ ] `pnpm test` — every domain suite passes.
- [ ] `pnpm i18n:check` — key sets identical.
- [ ] `pnpm start` serves in production mode.
- [ ] Every route in `public-pages.ts` returns 200 signed out.
- [ ] Every authenticated route returns 200 with a session and redirects or 404s without.
- [ ] With `RESEND_API_KEY` and `BLOB_READ_WRITE_TOKEN` **unset**, the app still builds, serves, and completes an approval.

**Two accounts**
- [ ] Pilot B gets 404 on every one of pilot A's drones, bookings, profile, notifications, and files.
- [ ] A pilot gets 404 on every `/admin` route.
- [ ] A reviewer gets 404 on `/admin/zones`, `/admin/audit`, `/admin/reveals`, and `/settings/system`.
- [ ] No admin route returns a 500 or a stack trace to an unauthorised user.

**Walkthrough**
- [ ] All 14 steps completed by hand, in Arabic, on a running app.
- [ ] Step 4 — the serial-less registration — completed with **no validation error**.
- [ ] Step 9 — the signed-out scan page — verified by **reading the HTML source**, not just the visible page.
- [ ] Step 10 — the audit event exists and precedes the reveal.
- [ ] Step 13 — exactly one booking row after the race.

**Integrity**
- [ ] The **first** account created is the user's own and is admin; no probe account ever occupied that slot.
- [ ] No test fixture remains in the database.
- [ ] `git status` is clean apart from intended files; `.env` is not committed.

**Fresh eyes**
- [ ] Four critics run in parallel against captured evidence.
- [ ] Every `broken` and `missing` finding is fixed or explicitly declined with a reason.
- [ ] At most two rounds; whatever remains is reported, not quietly dropped.
- [ ] No fix widened the gate or changed scope.

**Hand-off**
- [ ] Every un-runnable check is **named**, with what it would need.
- [ ] Anything Wave 0's research contradicted in a skill reference file is recorded.
- [ ] The production switch list from the [implementation plan](../implementation%20plan.md) §9 is handed over, with the DNS and Inngest steps called out by name.
- [ ] The user is shown the system page and told what it's for.
