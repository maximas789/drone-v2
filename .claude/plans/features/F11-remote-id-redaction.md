# F11 — Remote ID Redaction & Public Resolution

**Wave:** 5 · **Depends on:** [F10](./F10-remote-id-issuance.md)

## Purpose

The scannable digital licence plate. Anyone can resolve a Remote ID and learn that the aircraft is accountable and registered; **only an authority can learn who owns it**, and only with the reveal written to the audit log first. This mirrors the FAA model, and it is the line to defend in the GACA pitch.

## Technical design

### One function, no exceptions

```ts
// src/lib/remote-id/redact.ts
type ViewerLevel = "anonymous" | "pilot" | "owner" | "reviewer" | "admin";
redactRemoteId(record: FullRemoteIdRecord, level: ViewerLevel): RedactedRemoteId
```

**Every surface goes through this** — the HTML page, the JSON API, the admin lookup result. No route assembles its own response shape. A route that hand-picks fields is one refactor away from leaking a national ID, and this function is the single place that has to be right.

`ViewerLevel` is computed server-side from the session and the record: `owner` requires `record.drone.ownerUserId === session.user.id`. It is never taken from a parameter.

### The masking table

| Field | Anonymous | Pilot (not owner) | Owner | Reviewer / Admin |
|---|---|---|---|---|
| Remote ID code | ✓ | ✓ | ✓ | ✓ |
| Registration status badge | ✓ | ✓ | ✓ | ✓ |
| Valid-until date | ✓ | ✓ | ✓ | ✓ |
| Build type, weight class | ✓ | ✓ | ✓ | ✓ |
| City of registration | ✓ | ✓ | ✓ | ✓ |
| "Authorised flight in progress" (yes/no) | ✓ | ✓ | ✓ | ✓ |
| **Which zone** that flight is in | ✗ | ✗ | ✓ | ✓ |
| Manufacturer / model | ✗ | ✗ | ✓ | ✓ |
| Photos | ✗ | ✗ | ✓ | ✓ |
| Owner name (ar/en) | ✗ | ✗ | ✓ | ✓ |
| Owner mobile | ✗ | ✗ | ✓ (own) | ✓ |
| National ID / Iqama | ✗ | ✗ | masked `•••••1234` | masked + **Reveal** |
| Serial number (if any) | ✗ | ✗ | ✓ | ✓ |
| Declared modules + DoC ref | ✗ | ✗ | ✓ | ✓ |
| Booking history | ✗ | ✗ | own only | ✓ |
| Scan log for this code | ✗ | ✗ | ✗ | ✓ |

**Redaction removes fields; it never nulls them in place.** The returned type is a discriminated union per level, so TypeScript makes it impossible to render `ownerName` on the anonymous branch — the compiler is the second line of defence after the function.

### Why "flight in progress" is public but the zone is not

Knowing an aircraft overhead is authorised right now is exactly what a bystander needs to decide whether to report it. Knowing *which* zone reveals where the operator is standing, which is the control-station position the FAA model deliberately restricts to authorities.

### The anonymous view is a licence plate

It proves accountability without identifying a person: the code, a status badge, valid-until, build type, weight class, city, and whether a flight is authorised right now — plus a prominent **"Report this drone"** action that captures a free-text description and location and files it for reviewers, without exposing anything about the owner to the reporter.

An unregistered, expired, suspended, or unknown code returns a **clear bilingual status page**, not a 404. "This code is not registered" is the most useful answer a field inspector can get, and a 404 makes the tool look broken.

### Reveal identity

A server action, `requireReviewer()`:

```
requireReviewer() → rateLimit(20/hr) → reason (min 10 chars, required)
  → write audit_event 'remote_id.identity_revealed'  ← BEFORE returning
  → set remote_id_scan.revealedIdentity = true
  → return the unmasked identity
```

**The audit write happens before the value is returned**, inside the same transaction. If the log write fails, the reveal fails. A reveal that isn't logged didn't happen.

### Scan logging

Every resolution writes a `remote_id_scan` row (`viewerUserId`, `viewerLevel`, `ipHash`, `userAgent`, `revealedIdentity`) and increments `resolveCount` / `lastResolvedAt`. This is what makes "authorities can resolve identity" **auditable** rather than merely possible — an owner cannot see who scanned their drone, but an admin can see every reveal.

IPs are stored as `sha256(pepper + ip)`, never raw.

### Endpoints

| Route | Purpose |
|---|---|
| `/[locale]/rid/[code]` | The human page. QR encodes the **`ar`** URL, with a language toggle. |
| `/api/rid/[code]` | JSON twin, identical masking, for a future field-inspector app. |

Both run `normalizeCode()` first, and both are rate-limited at 30/min per IP hash ([F09](./F09-rate-limiting.md)).

**`robots.txt` disallows `/*/rid/`** ([F30](./F30-seo-discoverability.md)). Indexing these pages would turn the scan endpoint into a browsable national drone registry — precisely what the masking design exists to prevent.

## Files

```
src/lib/remote-id/redact.ts
src/lib/remote-id/resolve.ts             resolveRemoteId + viewerLevelFor + scan logging
src/lib/actions/remote-id.ts             revealIdentityAction, reportDroneAction
src/app/[locale]/(public)/rid/[code]/page.tsx
src/app/api/rid/[code]/route.ts
src/components/remote-id/{status-badge,scan-result,report-dialog,identity-reveal}.tsx
src/lib/remote-id/redact.test.ts
src/app/robots.ts                        the /*/rid/ disallow (F30 owns it afterwards)
```

**As built (Session 10):**

- **`resolveRemoteId` is not an action.** Resolution happens as the page renders and as the route handler runs; both call the same function, which is what makes "the JSON twin returns the same field set" structural rather than a promise. Only the two mutations are actions.
- **`remote_id_scan` carries `scannedCode`, and `remoteIdId` is nullable.** An unknown or malformed code is still a resolution, and a run of them is the enumeration attempt this table exists to make visible.
- **A new `drone_report` table**, owned by this feature: `remoteIdId` (nullable, for F24's unregistered case), `reportedCode`, `description`, optional coordinates and note, `reporterUserId`, `ipHash`, `userAgent`. F22's queues replace the interim list on `/admin`.
- **`rid.report` was added to `LIMITS`** — 3/min and 10/hour, keyed on the account or the IP hash. An anonymous action with no limit is a queue-flooding tool.
- **`report-dialog.tsx` renders an inline panel, not a modal.** No dialog primitive is installed, and a hand-rolled modal without a focus trap is worse for a screen reader than none — on a page whose whole point is a stranger with a phone.
- **A fourth component, `identity-reveal.tsx`**, rather than the reveal form living inside `scan-result.tsx`: it holds action state and the returned identity, and the scan result is otherwise a pure render of the union.
- `isIdentified()` is a **type predicate** in `redact.ts`. TypeScript will not narrow a union away on the negative side of `level === "anonymous" || level === "pilot"`, so without it the compiler only *appears* to enforce the masking table.
- **`/api/rid/[code]` answers 200 with `{ ok: false, reason }` for an unknown code**, mirroring the page. 429 is the one status it uses, because a rate limit is a genuine HTTP condition.

## Acceptance criteria

- [ ] **Signed out**, `/ar/rid/{code}` shows the code, status, valid-until, build type, weight class, and city — and shows **no** owner name, **no** national ID, **no** mobile, **no** photos, **no** manufacturer/model.
- [ ] The rendered HTML source contains none of those values either (checked with view-source, not just the visible page).
- [ ] `/api/rid/{code}` fetched with no session returns exactly the same field set as the anonymous page.
- [ ] Signed in as a **different** pilot: still no owner identity.
- [ ] Signed in as the **owner**: full record, national ID masked to `•••••1234`.
- [ ] Signed in as a **reviewer**: full record plus the Reveal control and the scan log.
- [ ] `redactRemoteId` is the **only** place drone/owner fields are selected for these surfaces (verified by grep).
- [ ] TypeScript rejects rendering `ownerName` on the anonymous branch.
- [ ] Reveal without a reason is rejected; with a reason it returns the identity **and** an audit event exists with that reason.
- [ ] Forcing the audit write to fail makes the reveal fail and returns nothing.
- [ ] Every resolution writes a `remote_id_scan` row and increments `resolveCount`.
- [ ] `remote_id_scan` contains no raw IP addresses.
- [ ] An unknown code returns a bilingual "not registered" page, **not** a 404 and not a stack trace.
- [ ] An expired drone's code resolves and clearly says expired; a revoked drone's says suspended.
- [ ] "Authorised flight in progress" reads yes/no anonymously, and the zone name appears only for owner/reviewer.
- [ ] "Report this drone" files a report visible to reviewers, and reveals nothing to the reporter.
- [ ] The page is correct in Arabic RTL at 375 px — this is a phone-scanned page first.
- [ ] `robots.txt` disallows `/*/rid/`.
- [ ] `pnpm test` passes the redaction suite (one case per viewer level); `tsc`, `lint`, `build` pass.
