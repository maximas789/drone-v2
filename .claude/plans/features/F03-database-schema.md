# F03 — Database Schema

**Wave:** 2 · **Depends on:** [F01](./F01-project-shell.md) · **Skill reference:** `references/database.md`

## Purpose

Postgres in Docker, Drizzle wired up, and the entire domain schema landed in one reviewed migration. Everything downstream reads from this.

## Technical design

### Docker Postgres

`docker-compose.yml` at the project root, image `postgres:alpine` — **no version tag**, so a fresh project gets current stable. Volume `pgdata`. Port 5432.

> Worth knowing: a Postgres data directory belongs to the major version that created it. Once there's real data, an image that jumps a major refuses to start against the old volume — the fix is dump-and-restore, not a flag. That's the moment to pin the major, not before.

`.env`: `POSTGRES_URL=postgresql://app:app@localhost:5432/app`

### Scripts

```json
"db:generate": "drizzle-kit generate",
"db:migrate":  "drizzle-kit migrate",
"db:studio":   "drizzle-kit studio",
"db:up":       "docker compose up -d",
"db:down":     "docker compose down",
"build":       "pnpm db:migrate && next build"
```

**`db:push` is deliberately absent** so it isn't within reach. Workflow is always `db:generate` → *read the generated SQL* → `db:migrate`. Drizzle can't always tell a rename from a drop-plus-add, and that shows up only in the SQL file. Commit `drizzle/` — it's source code.

### ID rules

Every table below gets `uuid("id").primaryKey().defaultRandom()`. **Every column referencing a user is `text`**, matching Better Auth's `user.id` — declaring it `uuid` fails the foreign key at migrate time. Tables referencing *our* tables use `uuid`.

`src/lib/db/auth-schema.ts` is CLI-generated in [F05](./F05-auth-roles-access.md) and never edited. `schema.ts` re-exports it.

### Enums (`pgEnum`)

```
id_document_type     saudi_national_id | iqama | gcc_id
drone_build_type     commercial | self_built | fpv
drone_weight_class   micro | light | medium | heavy        -- <250g | <4kg | <25kg | >=25kg
drone_status         draft | pending | approved | rejected | expired | revoked
remote_id_status     active | suspended | retired
remote_id_decl_kind  faa_broadcast_module | gaca_dri | gaca_nri | other
zone_kind            permitted | restricted | no_fly
zone_status          draft | active | suspended | archived
booking_status       pending | approved | rejected | cancelled | completed | no_show
audit_entity_type    user | pilot_profile | drone | remote_id | zone | zone_closure | booking | city
notification_status  unread | read | archived
```

### Tables

**`pilot_profile`** — 1:1 with user. `userId text unique`, `fullNameAr/En`, `idDocumentType`, `idDocumentNumber` (masked everywhere), `idDocumentHash text unique` = `sha256(ID_HASH_PEPPER + number)` so uniqueness is enforced without a plaintext unique index, `dateOfBirth date`, `mobileE164`, `addressCityId`, `addressLine`, `emergencyContact`, `completedAt`, `verifiedAt`, `verifiedByUserId`.

**`city`** — `nameAr/En`, `code text unique` (`RUH`), `centroidLat/Lng`, `isModelled boolean` (true only for Riyadh in v2).

**`drone`** — `ownerUserId`, `nickname`, `manufacturer`, `model`, **`serialNumber text` (NULLABLE — this nullability *is* the product)**, `buildType`, `weightGrams integer`, `weightClass` (derived on write, stored so it's indexable), `propulsion`, `hasCamera`, `status`, `submittedAt`, `decidedAt`, `decidedByUserId`, `rejectionReason`, `rejectionCount`, `registrationIssuedAt`, `registrationExpiresAt`, `revokedAt`, `revocationReason`.

App-enforced rule, carrying a comment that says it is the exact inversion of GACA's: **a serial number is required only when `buildType === 'commercial'`.**

Indexes: `(owner_user_id, status)`, `(status, submitted_at)` for the reviewer queue, `(registration_expires_at)` for the expiry job.

**`drone_photo`** — `droneId`, `url`, `pathname` (the shape `deleteFile()` takes), `kind` (`overall | serial_plate | remote_id_module | payload`), `sortOrder`.

**`remote_id`** — 1:1 with drone. `code text unique`, `status`, `issuedAt`, `networkCapable`, `broadcastCapable`, `qrPathname`, `lastResolvedAt`, `resolveCount`, `suspendedAt`, `suspensionReason`. Detail in [F10](./F10-remote-id-issuance.md).

**`remote_id_declaration`** — external/standard modules with history: `kind`, `manufacturer`, `moduleSerial`, `docReference`, `docPath`, `validFrom/Until`, `verifiedAt`, `verifiedByUserId`, `rejectedAt`, `rejectionReason`, `supersededAt`, `notesAr/En`. A child table rather than columns because the regulator's question is *"what was broadcasting on 3 March"* — that needs rows with validity windows, not overwritten fields. Unique `(kind, module_serial) where superseded_at is null`.

**`zone`** — `cityId`, `code text unique` (`RUH-P-01`), `kind`, `status`, `nameAr/En`, `districtAr/En`, `notesAr/En`, **`geometry jsonb $type<Polygon | MultiPolygon>`**, `geometryVersion`, `vertexCount`, **`minLat/maxLat/minLng/maxLng doublePrecision`**, `ceilingAglM`, `floorAglM`, `capacity`, `slotDurationMinutes`, `minLeadMinutes`, `maxAdvanceDays`, `maxSlotsPerPilotPerDay`, `autoApprove`, `nightAllowed`, `maxWeightClass`, `permittedBuildTypes[]`, `requiresBroadcastRid`, `authorityRef`, `publishedAt`, `createdBy/updatedByUserId`.

bbox is `doublePrecision`, **not `numeric`** — Drizzle maps `numeric` to `string`, which would put a `Number()` parse inside the point-in-polygon hot loop. The `jsonb` geometry is authoritative; bbox is only a pre-filter.

**`zone_hour`** — rows, not a jsonb blob, because a Friday can have two windows around prayer times. `zoneId`, `weekday smallint` (**0 = Sunday**), `opensMinute`, `closesMinute` (a window never crosses midnight). Unique `(zone_id, weekday, opens_minute)`.

**`zone_closure`** — the NOTAM analogue. `zoneId`, `startsAt`, `endsAt`, `reasonAr/En`, `authorityRef`, `publishedAt`, `createdByUserId`.

**`booking`** — `pilotUserId`, `droneId`, **`remoteIdId`** (the flight binds to the Remote ID, not just the airframe), `zoneId`, `slotStart`, `slotEnd`, `seatIndex smallint`, `status`, `purpose`, `purposeNote`, `plannedAltitudeM`, `decidedAt`, `decidedByUserId`, `rejectionReason`, `cancelledAt`, `cancelledByUserId`, `cancellationReason`, `checkedInAt`, `completedAt`, **`decisionSnapshot jsonb`**.

`decisionSnapshot` stores the `AirspaceDecision` at approval time — ceiling, zone `geometryVersion`, the reasons evaluated. It is the answer to *"on what basis was this approved"* after a polygon has since been redrawn.

Three partial unique indexes, all `where status in ('pending','approved')`:
```sql
(zone_id, slot_start, seat_index)   -- booking_seat_uniq       → capacity, see F13
(drone_id, slot_start)              -- one aircraft, one place
(pilot_user_id, slot_start)         -- one pilot, one place
```

**`booking_copilot`** — `bookingId`, `fullNameAr/En`, `mobileE164`, `idDocumentNumber` (masked), `userId` (set if the co-pilot is a registered Ajniha pilot).

**`audit_event`** — `actorUserId` (`on delete set null`: the log outlives the account), `actorRole` (role *at the time*, not now), `actorIsSystem`, `entityType`, `entityId text` (may point at a user's `text` id or one of our `uuid`s), `action` (`'drone.approved'`), `before jsonb`, `after jsonb`, `reason`, `ipHash` (`sha256(pepper + ip)`, never a raw address), `userAgent`, `createdAt`. Detail in [F14](./F14-workflow-and-audit.md).

**`notification`** — `userId`, `type` (an i18n key), `params jsonb`, `entityType`, `entityId`, `href` (locale-less; the renderer prefixes `/[locale]`), `status`, `readAt`, `emailLogId`. **Never stores rendered text** — a pilot who switches to English must see old notifications in English.

**`email_log`** — the skill's columns plus `userId`, `locale`, `entityId`.

**`notification_preference`** — only categories that exist: `booking_reminder`, `registration_expiry`, `zone_closure`.

**`jobs`**, **`remote_id_scan`**, **`rate_limit_bucket`** — per [F08](./F08-background-jobs.md), [F11](./F11-remote-id-redaction.md), [F09](./F09-rate-limiting.md).

### Data access layer

`src/lib/data/*.ts` — one file per aggregate. **Every exported function takes the session as its first argument.** No page and no server action calls `db` directly. This makes "did you scope this query?" answerable by reading one folder.

## Files

```
docker-compose.yml
drizzle.config.ts
drizzle/                        (generated migrations — committed)
src/lib/db/index.ts
src/lib/db/schema.ts
src/lib/db/enums.ts
src/lib/data/{drone,zone,booking,pilot,remote-id,audit,notification}.ts
```

## Acceptance criteria

- [ ] `pnpm db:up` starts Postgres; `docker compose ps` shows it healthy.
- [ ] `pnpm db:generate` produces a migration in `drizzle/`; the SQL was **read** before applying.
- [ ] `pnpm db:migrate` applies cleanly against an empty database.
- [ ] `package.json` has **no** `db:push` script.
- [ ] Every non-auth table has a UUID primary key that fills itself in — inserting without an `id` works.
- [ ] Every user-referencing column is `text`; a deliberate `uuid` attempt fails at migrate time with a type mismatch (verified once, then reverted).
- [ ] `drone.serial_number` is nullable in the generated SQL.
- [ ] The three partial unique indexes on `booking` exist and carry the `where status in ('pending','approved')` clause.
- [ ] `zone.min_lat` etc. are `double precision`, not `numeric`.
- [ ] `pnpm db:studio` opens and lists every table.
- [ ] Inserting and reading one row through `db` works.
- [ ] `pnpm build` completes, running migrations first.
