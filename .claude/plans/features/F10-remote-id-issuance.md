# F10 — Remote ID Issuance & Codec

**Wave:** 5 · **Depends on:** [F03](./F03-database-schema.md)

## Purpose

The product's core differentiator. Every registered drone — above all one with no manufacturer serial number — is issued a unique, human-readable Ajniha Remote ID that becomes its primary identifier throughout the app. Pilots who already own a standard broadcast module can declare it alongside.

## Technical design

### Code format

`AJN-XXXX-XXXX` — canonical form is uppercase, dashes included, stored exactly as displayed.

**Alphabet: Crockford Base32** — `0123456789ABCDEFGHJKMNPQRSTVWXYZ`. 32 symbols; `I`, `L`, `O` excluded as visually ambiguous, and `U` excluded so a randomly generated code can't spell something unfortunate on a sticker attached to a government-facing registration.

**8 symbols × 5 bits = 40 bits** (≈ 1.1 × 10¹²), generated from `crypto.randomBytes(5)`.

**Never derived from the row UUID.** A derived code would let anyone holding two codes correlate them, or walk the id space.

### Normalisation — ambiguity is solved on input, not by shrinking the alphabet

```ts
normalizeCode(input: string): string | null
```

Uppercase → strip everything non-alphanumeric → map `I→1`, `L→1`, `O→0`, `U→V` → validate length 8 and alphabet → re-insert dashes.

So a pilot reading `O` for `0` off a sticker, or typing `ajn 4f2k 91xz`, still resolves. Every entry point (public scan, admin lookup, the JSON API) runs this first.

### Collisions

Per-insert collision probability at 100 000 issued codes is ~9 × 10⁻⁸. Being birthday-honest: at 1 000 000 codes the *cumulative* chance any collision ever occurred is ~36% — which is precisely why the unique index exists, not a reason to widen the format.

```
generate → insert → on Postgres 23505 → regenerate → retry (max 5) → then throw
```

Every retry writes `audit_event` with `action: 'remote_id.collision'`. **If that action ever appears more than a handful of times, the format needs a 9th symbol** — that is the documented upgrade trigger, recorded here so it isn't rediscovered by accident.

**No check character.** A Crockford check symbol would cost 5 of the 40 bits, and the QR carries the whole URL, so typing is the exception path, not the norm. Recorded as a considered fork, not an oversight.

### Issuance lifecycle

A `remote_id` row is created when a drone is **approved** ([F14](./F14-workflow-and-audit.md)), not when it's drafted — an unapproved aircraft must not carry a valid-looking identity.

**The code survives renewal.** When a registration expires and is resubmitted, the `drone` row moves back through the state machine but the `remote_id` row and its code are untouched. A QR sticker already applied to the airframe must keep resolving — reissuing would strand every printed label.

| Event | Effect on `remote_id` |
|---|---|
| Drone approved (first time) | Row + code created, `status: 'active'`, QR render enqueued |
| Drone expired | Code retained; **the scan page shows "expired"** rather than 404 |
| Drone renewed | Same code, `status` back to `active` |
| Drone revoked | `status: 'suspended'`, `suspensionReason` set; the scan page says so |
| Drone deleted (draft only) | No `remote_id` existed — nothing to clean up |

### Two Remote ID paths

Ajniha implements **Network Remote ID** itself: `networkCapable: true` by default, since the platform holds registration, owner, and active-booking data resolvable through the scan endpoint. That is the mechanism replacing the serial number.

`broadcastCapable` becomes true only once a **verified** declaration exists.

### Declared external modules — `remote_id_declaration`

A pilot whose aircraft already carries a standard broadcast module declares it, per the FAA model (a module transmitting ID, location, altitude, and control-station position) or GACA's DRI/NRI:

```
kind           faa_broadcast_module | gaca_dri | gaca_nri | other
manufacturer   moduleSerial   docReference   docPath (PDF via F07)
validFrom      validUntil
verifiedAt     verifiedByUserId
rejectedAt     rejectionReason
supersededAt
```

A **child table with validity windows**, not columns on `remote_id`, because modules get swapped between airframes and replaced after failure — and the regulator's question is *"what was broadcasting on 3 March"*, which overwritten columns cannot answer.

Unique index `(kind, module_serial) where superseded_at is null` — one active claim per physical module, so two pilots can't both claim the same hardware while allowing a legitimate transfer after supersession.

A declaration is **unverified until a reviewer verifies it** ([F22](./F22-admin-review-queues.md)). An unverified declaration never sets `broadcastCapable`, so a zone with `requiresBroadcastRid` still refuses — self-declaration alone doesn't unlock anything.

### Remote ID as the primary identifier

Throughout the app, drones are addressed by Remote ID rather than serial number:

- `booking.remoteIdId` is a **required** foreign key — a flight binds to the Remote ID, not merely to the airframe.
- Review queues, audit events, notifications, and emails display the code.
- Admin lookup ([F24](./F24-remote-id-lookup.md)) takes the code as its primary input.
- The serial number, where one exists at all, is a secondary attribute shown only to owners and reviewers.

## Files

```
src/lib/remote-id/codec.ts        generateCode, normalizeCode, isValidCode
src/lib/remote-id/issue.ts        issueRemoteId (transactional, retry on 23505)
src/lib/remote-id/declaration.ts  declare, supersede, verify
src/lib/remote-id/index.ts
src/lib/remote-id/__tests__/codec.test.ts
```

## Acceptance criteria

- [ ] `generateCode()` returns `AJN-XXXX-XXXX` using only the Crockford alphabet; `I`, `L`, `O`, `U` **never** appear across 100 000 generated codes.
- [ ] 100 000 generated codes contain no duplicates.
- [ ] `normalizeCode('ajn 4f2k 91xz')`, `'AJN4F2K91XZ'`, and `'ajn-4f2k-91xz'` all yield the same canonical code.
- [ ] `normalizeCode` maps `O→0`, `I→1`, `L→1`, `U→V`, so a misread sticker still resolves.
- [ ] `normalizeCode` returns `null` for wrong length, or for characters outside the alphabet after mapping.
- [ ] A code is never derivable from the row's UUID (assert no correlation in the implementation).
- [ ] A forced unique-constraint violation triggers regeneration, succeeds, and writes a `remote_id.collision` audit event.
- [ ] Exceeding 5 attempts throws rather than inserting a duplicate.
- [ ] No `remote_id` row exists for a drone in `draft`, `pending`, or `rejected`.
- [ ] Approving a drone creates exactly one `remote_id` row with `status: 'active'`.
- [ ] **Expiring then renewing a drone leaves `remote_id.code` unchanged** — assert the exact same string before and after.
- [ ] Revoking a drone sets `status: 'suspended'` with a reason; the code is not deleted.
- [ ] A declared module with no verification leaves `broadcastCapable: false`; verifying it flips to `true`.
- [ ] Two pilots cannot declare the same `(kind, moduleSerial)` while the first is unsuperseded; after supersession the second succeeds.
- [ ] `booking.remoteIdId` is `NOT NULL` in the generated SQL.
- [ ] The reviewer queue, the approval email, and the booking detail page all display the Remote ID code.
- [ ] `pnpm test` passes the codec suite; `tsc`, `lint`, `build` pass.
