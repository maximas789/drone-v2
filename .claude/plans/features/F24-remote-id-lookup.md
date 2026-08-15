# F24 — Remote ID Lookup & Identity Reveal

**Wave:** 7 · **Depends on:** [F11](./F11-remote-id-redaction.md) · **Reviewer + admin**

## Purpose

The compliance spot-check tool. A GACA officer sees a drone, gets its Remote ID — scanned, read aloud, or partially remembered — and resolves it to a registration, an owner, and an active authorisation. This is the enforcement half of the Remote ID proposition, and it's what makes the pitch complete rather than pilot-only.

## Technical design

### One input, many kinds of thing

`/[locale]/admin/lookup` — a single search field that works out what it's been given, because an officer in the field should not have to pick a category first.

| Input | Handling |
|---|---|
| Full code `AJN-4F2K-91XZ` | `normalizeCode()` → direct hit |
| Sloppy code `ajn 4f2k 91xz`, `AJN4F2K91XZ` | Normalised, then direct hit |
| Misread code with `O`/`I`/`L`/`U` | Mapped by `normalizeCode`, then direct hit |
| Partial — last 4 symbols | Prefix/suffix search on the code's second group |
| Module serial | Search `remote_id_declaration.moduleSerial` |
| 10-digit number | Hashed with the pepper, matched against `idDocumentHash` |
| `+9665…` | Search `pilot_profile.mobileE164` |
| Free text | Name search across `fullNameAr` / `fullNameEn` |

Detection order runs code-first, since that's the common case and the format is unambiguous.

### Results

Rendered at **reviewer level** through `redactRemoteId` ([F11](./F11-remote-id-redaction.md)) — the same function the public page uses, never a bespoke query. The national ID stays masked until an explicit reveal.

A result shows: the code and status, the drone, the owner (ID masked), registration validity, **any active or upcoming booking with its zone and slot**, declared modules and their verification state, recent scan history, and the drone's audit trail.

**"Is this drone authorised to be flying right now?"** is answered as a single prominent yes/no with the zone and slot when yes — because that is the actual question being asked in the field, and making an officer infer it from a booking table is a design failure.

A partial-code search returning several candidates shows a disambiguation list with enough to tell them apart (make, model, city, status) and **no owner identity** until one is opened.

### No results

An explicit, useful answer: *"No registration found for this identifier."* — with a **Report unregistered drone** action that files a compliance record. A silent empty state leaves an officer unsure whether the tool failed or the drone is genuinely unregistered, which is the one ambiguity that matters here.

### Reveal identity

The same server action as [F11](./F11-remote-id-redaction.md), `requireReviewer()`:

```
rateLimit(20/hr) → reason (min 10 chars, required)
  → write audit_event 'remote_id.identity_revealed'   ← BEFORE returning
  → set remote_id_scan.revealedIdentity = true
  → return the unmasked identity
```

The reveal dialog states plainly that the action is logged and reviewable by an administrator. A reveal that isn't logged didn't happen — if the audit write fails, the reveal fails.

### Every search is logged

Including one that finds nothing. `audit_event` records the **query type** (`code`, `partial`, `national_id`, `mobile`, `name`) — **never the raw national ID or mobile number**. Logging the query text would put unhashed PII in the audit table for searches that matched nobody, which is exactly backwards.

An admin can see who searched for what, and this is what makes the tool accountable rather than a private window into the registry.

### Reveal oversight — `/[locale]/admin/reveals`

Admin-only. Every identity reveal with reviewer, target, reason, and timestamp; filterable by reviewer, with a per-reviewer count over a rolling 30 days so an unusual pattern is visible rather than buried.

### Field ergonomics

This is used on a phone, outdoors, one-handed:

- The search input autofocuses, is `inputmode="text"` with autocapitalise on (codes are uppercase).
- **A camera QR-scan button** using `BarcodeDetector` where available, falling back cleanly to typing where it isn't — never a broken button.
- Large tap targets, high contrast, a layout that works at 375 px in bright sunlight.
- Recent lookups persist for the session so re-checking a drone doesn't mean retyping.

## Files

```
src/app/[locale]/(admin)/admin/lookup/page.tsx
src/app/[locale]/(admin)/admin/reveals/page.tsx
src/lib/lookup/detect.ts               input kind detection
src/lib/lookup/search.ts               the queries
src/lib/actions/lookup.ts              lookupRemoteId, revealIdentity, reportUnregistered
src/components/admin/lookup/{search-bar,qr-scan-button,result-card,
                             disambiguation-list,reveal-dialog,recent-lookups}.tsx
src/lib/lookup/__tests__/detect.test.ts
```

## Acceptance criteria

**Input handling**
- [ ] `AJN-4F2K-91XZ`, `ajn 4f2k 91xz`, and `AJN4F2K91XZ` all resolve to the same drone.
- [ ] A code misread with `O` for `0` or `I` for `1` still resolves.
- [ ] The last 4 symbols return matching candidates.
- [ ] A module serial finds the drone through its declaration.
- [ ] A 10-digit national ID finds the pilot **via the hash**, not a plaintext match.
- [ ] `+9665…` finds the pilot by mobile.
- [ ] A partial name finds pilots in Arabic **and** English.
- [ ] Detection order is code-first and does not misclassify a valid code as free text.

**Results**
- [ ] Results render through `redactRemoteId` at reviewer level — verified by grep that no bespoke select exists here.
- [ ] The national ID is masked until revealed.
- [ ] "Authorised to fly right now?" is a single prominent yes/no, with zone and slot when yes.
- [ ] A drone with an active booking reads yes; the same drone outside its slot reads no.
- [ ] Multiple candidates show a disambiguation list with **no owner identity** until one is opened.
- [ ] No result shows an explicit "no registration found" message plus a **Report unregistered drone** action.
- [ ] An expired registration is clearly shown as expired, not merely absent.

**Reveal & audit**
- [ ] Reveal without a reason is refused; with one it returns the identity.
- [ ] An audit event is written **before** the identity is returned; forcing that write to fail makes the reveal fail.
- [ ] The reveal dialog states the action is logged.
- [ ] `remote_id_scan.revealedIdentity` is set.
- [ ] Every search writes an audit event, **including searches with no results**.
- [ ] Audit events record the query **type**, and contain **no raw national ID or mobile number** — inspect the table.
- [ ] `/admin/reveals` lists every reveal with reviewer, reason, and timestamp, and shows a 30-day count per reviewer.
- [ ] Reveals are rate-limited at 20/hour per reviewer.

**Access & field use**
- [ ] A **pilot** visiting `/admin/lookup` gets 404, and calling the action directly is refused.
- [ ] A reviewer can look up and reveal; `/admin/reveals` is **admin-only**.
- [ ] The QR-scan button works where `BarcodeDetector` exists and degrades to typing where it doesn't — never a broken control.
- [ ] The page is usable one-handed at 375 px in Arabic RTL, with large tap targets.
- [ ] Recent lookups persist within a session.
- [ ] `pnpm test` passes the input-detection suite; `tsc`, `lint`, `build` pass.
