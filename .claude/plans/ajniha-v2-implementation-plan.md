# Ajniha (أجنحة) v2 — Implementation Plan

## Context

**The problem.** GACA's drone registration requires a manufacturer serial number. Self-built and FPV drones don't have one, so their pilots have no legal way to register and nowhere officially sanctioned to fly. Ajniha closes that gap by replacing the serial-number requirement with **Remote ID** — which is not a workaround but the direction the regulator is already moving: GACA mandates Direct or Network Remote ID for drones as of 1 January 2026, and registration runs on 3-year validity. Ajniha implements what that rule implies but the current portal doesn't offer — a way in for aircraft that have no factory identity.

**What changes from v1.** v1 (at `Desktop\drone`, untouched by this plan) was a clickable prototype: mock data in localStorage, a persona-switcher instead of auth, instant simulated approvals. v2 is the real product — Postgres, Better Auth with pilot/reviewer/admin roles, real file uploads, a real admin approval workflow with an audit trail, real scheduled expiry notifications. **Built clean in `drone-2-demo`; no v1 code is copied**, including its Arabic copy and zone geometry, which are authored fresh here.

**Intended outcome.** A working, deployable bilingual platform a GACA reviewer could be walked through end to end: a pilot registers a serial-less FPV drone, is issued an Ajniha Remote ID and a scannable digital ID card, waits for a human reviewer's decision, then books a slot in a GACA-carved permitted zone — while an inspector in the field scans the QR and resolves the aircraft's status *without the owner's identity being public*.

---

## Decisions taken

| | |
|---|---|
| **Stack** | Next.js App Router · TypeScript · Tailwind · shadcn/ui · Drizzle · Better Auth — fixed by the `start-an-app` skill |
| **Database** | Postgres in Docker locally (`pnpm db:up`), Neon in production. Docker confirmed running (29.7.2). |
| **Sign-in** | Email + password. Saudi mobile (`+9665…`) and national ID / Iqama are profile fields, not credentials. |
| **Map** | MapLibre GL JS + OpenFreeMap tiles — **no API key, no billing account**. Arabic labels from `name:ar`; MapLibre RTL text plugin for correct Arabic shaping. Admin zone drawing via `terra-draw` (actively maintained, has a MapLibre adapter). |
| **Airspace** | Riyadh modelled deeply; other Saudi cities are rows an admin can draw into (`city.isModelled = false`). |
| **Email** | Resend. Works to your own address immediately; sending to others needs a domain + DNS (~10 min, free). Until then emails print to the terminal and are recorded in-app. |
| **Uploads** | Local folder in dev → Vercel Blob in production, same code, switched by env var. |
| **Jobs** | Inngest — expiry sweeps, reminders, no-show closeout, closure fan-out, QR rendering. Free, no account in dev. |
| **Not included** | Payments. AI assistant. MCP agent access. SMS/OTP. |
| **Also included** | Bilingual public help pages · sitemap / `robots.txt` / `llms.txt` / Arabic-first OG preview card · account settings · system/ops page |

**Legal (decided, not asked):** a public product strangers sign up for, holding national IDs → **privacy policy and terms both required**, with a retention section matching the 3-year registration validity and the audit trail's lifetime, and a note on Saudi PDPL. **No cookie banner** — the session and locale cookies are essential, and OpenFreeMap tiles set no cookies and do no profiling; the tile provider is disclosed in the privacy policy instead.

**Discoverability:** public — sitemap over public routes with `alternates.languages` for ar/en, plus `robots.txt` that **disallows `/*/rid/`**. Indexing the scan endpoint would turn it into a browsable drone registry, defeating the masking design.

---

## Architecture

### Cross-cutting rules

- **Bilingual content:** paired `*_ar` / `*_en` **columns** for human-authored text (indexes, sorts, maps 1:1 to admin forms). Enumerable things are stored as stable **codes** and translated at render — so a rejection reason written once renders in whichever language the reader picks.
- **Time:** every instant `timestamptz`; civil timezone `Asia/Riyadh` (fixed +180, no DST). Saudi week starts Sunday (weekday 0).
- **Numerals/calendar:** one `src/lib/format.ts` forcing `ar-SA-u-ca-gregory-nu-latn`, with an ESLint rule banning bare `toLocaleDateString`/`toLocaleTimeString` so Hijri dates and Arabic-Indic digits can't leak in.
- **RTL:** logical properties only (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`), enforced by an ESLint ban on `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-`.
- **Ownership:** no page or action calls `db` directly. All reads go through `src/lib/data/*.ts` whose first argument is the session — so "is this query scoped?" is answerable by reading one folder.
- **IDs:** every table gets a UUID primary key; every column referencing a user stays `text` (Better Auth's type). `auth-schema.ts` is CLI-generated and never edited.
- **One log, not two:** a single `audit_event` table backs both the regulator approval trail and the ops activity log. *(This deliberately diverges from the skill's `activity_log` name — two overlapping logs drift, and the trail an admin reads must be the trail a regulator audits.)*

### Data model — `src/lib/db/schema.ts`

**Auth.** `role` (`pilot | reviewer | admin`) and `preferredLocale` as Better Auth `additionalFields` with `input: false` on role — that flag is the security control, without it a user sets their own role. First account created becomes `admin`. Regulated PII stays *out* of `additionalFields`, because those values are serialised into the session and would reach the browser on every page.

**Core tables:**

- `pilot_profile` — 1:1 with user; `fullNameAr/En`, `idDocumentType`, `idDocumentNumber` + `idDocumentHash` (unique, `sha256(pepper+number)` so uniqueness doesn't need a plaintext index), `dateOfBirth`, `mobileE164`, `addressCityId`, `completedAt`, `verifiedAt`/`verifiedByUserId`.
- `city` — `nameAr/En`, `code` (`RUH`), centroid, `isModelled`.
- `drone` — `ownerUserId`, `manufacturer`, `model`, **`serialNumber` nullable — that nullability *is* the product**, `buildType` (`commercial | self_built | fpv`), `weightGrams` + derived `weightClass`, `status` (`draft|pending|approved|rejected|expired|revoked`), `registrationIssuedAt`/`registrationExpiresAt` (+3 years), `rejectionReason`, `revokedAt`. App rule (the exact inversion of GACA's): a serial is required *only* when `buildType === 'commercial'`.
- `drone_photo` — `url` + `pathname` matching the storage module's `StoredFile` shape.
- `remote_id` — 1:1 with drone. `code` unique (`AJN-4F2K-91XZ`), `status`, `networkCapable`, `broadcastCapable`, `qrPathname`, `resolveCount`. **The code survives renewal** — a QR sticker already on the airframe must keep resolving.
- `remote_id_declaration` — optional external/standard modules with history: `kind` (`faa_broadcast_module | gaca_dri | gaca_nri | other`), `moduleSerial`, `docReference` (FAA Declaration of Compliance / GACA approval), uploaded PDF, `validFrom`/`validUntil`, `verifiedAt`, `supersededAt`. A child table rather than columns, because the regulator's question is "what was broadcasting on 3 March" — that needs rows with validity windows, not overwritten fields.
- `zone` — `kind` (`permitted | restricted | no_fly`), bilingual name/district/notes, **GeoJSON `Polygon|MultiPolygon` in `jsonb`** plus denormalised `minLat/maxLat/minLng/maxLng` (`doublePrecision`) for bbox pre-filtering, `ceilingAglM`, `capacity`, `slotDurationMinutes`, `minLeadMinutes`, `maxAdvanceDays`, `autoApprove`, `nightAllowed`, `maxWeightClass`, `permittedBuildTypes[]`, `requiresBroadcastRid`, `authorityRef`, `geometryVersion`. No PostGIS.
- `zone_hour` — rows, not jsonb (a Friday can have two windows around prayer): `weekday 0..6`, `opensMinute`, `closesMinute`.
- `zone_closure` — the NOTAM analogue: window + bilingual reason + `authorityRef`.
- `booking` — `pilotUserId`, `droneId`, **`remoteIdId`** (the flight binds to the Remote ID, not just the airframe), `zoneId`, `slotStart`/`slotEnd`, `seatIndex`, `status`, `purpose`, `plannedAltitudeM`, `checkedInAt`, and **`decisionSnapshot` jsonb** — the answer to "on what basis was this approved" after a zone polygon has since been redrawn.
- `booking_copilot`, `audit_event`, `notification` (stores `type` key + `params`, never rendered strings), `email_log`, `notification_preference`, `jobs`, `remote_id_scan`, `rate_limit_bucket`.

**Riyadh seed:** one `RUH-R-CITY` restricted boundary, ~7 permitted carve-outs with hours/ceilings/capacity, and no-fly overlays `RUH-NF-KKIA` (King Khalid International CTR), `-MOD`, `-DQ`, `-ROYAL-*`. Permitted zones are separate rows, not holes punched in the restricted polygon — precedence handles the carve-out; holes stay reserved for genuinely annular geometry.

### Remote ID — `src/lib/remote-id/`

- **Format** `AJN-XXXX-XXXX` over **Crockford Base32** (`0123456789ABCDEFGHJKMNPQRSTVWXYZ` — no `I`, `L`, `O`, `U`). 40 bits from `crypto.randomBytes(5)`, **never derived from the row UUID**. Collision handled by the unique index + bounded regenerate-on-`23505`, each retry logged as `remote_id.collision` (that action appearing repeatedly is the documented trigger to widen the format).
- **Ambiguity is fixed on input, not by shrinking the alphabet:** `normalizeCode()` uppercases, strips separators, maps `I/L→1`, `O→0`, `U→V`, re-inserts dashes. A pilot who reads `O` for `0` still resolves.
- **Scan endpoint** `/[locale]/rid/[code]` (QR encodes the `ar` URL), with a JSON twin at `/api/rid/[code]`. Every resolution writes a `remote_id_scan` row.
- **One masking function**, `redactRemoteId(record, viewerLevel)`, so no route can over-share. Anonymous sees a licence plate: code, status badge, valid-until, build type, weight class, city, and whether an authorised flight is in progress — plus a **Report this drone** button. It never identifies a person. Owner sees their own full record. Reviewer/admin see everything, and **Reveal identity** is a separate action requiring a written reason, logged *before* the value is returned.
- **Admin lookup** `/[locale]/admin/lookup` — one input taking a full or partial code, module serial, national ID, or mobile. Every search, including one that finds nothing, writes an audit event (recording the query *type*, never a raw national ID).

### Airspace engine — `src/lib/airspace/`

`evaluate.ts` is **pure** — it must not import `db`, `server-only`, `next-intl`, or React, enforced by an ESLint `no-restricted-imports` rule on the folder. That is what lets the map's live status panel and the booking server action call *the same function*: the map fetches visible zones from `/api/zones/geojson?bbox=` and evaluates client-side on every pan for instant feedback, while the server re-evaluates authoritatively inside the booking transaction.

**Precedence: `no_fly` > `permitted` > `restricted` > default-deny.** Evaluation runs eligibility checks (profile complete, drone approved, registration unexpired, Remote ID active) *without short-circuiting* — geometry still runs, so the map can still show **where** a pilot could fly once eligible. Then bbox pre-filter in SQL, then ray-casting point-in-polygon with interior-ring (hole) support, using the half-open rule `(yi > y) !== (yj > y)` so a shared edge between adjacent zones resolves to exactly one. Coordinates are `[lng, lat]` GeoJSON order throughout, with the type named `Position` to stop the classic reversal bug.

~26 machine-readable refusal codes (`outside_permitted_zone`, `above_ceiling`, `zone_closed_now`, `slot_full`, `broadcast_rid_required`, …), bilingual only at render via `t('airspace.reasons.' + code)`, so a missing translation is a build-visible failure. **Every refusal carries a fix hint plus `nextOpenAt` and `alternativeSlots`** — one call answers *no, because, and here's what would work*. That's the Aloft one-tap feel.

### Slots and the last-seat race — `src/lib/booking/`

**Slots are derived, not stored.** `deriveSlots(zone, hours, closures, ymd)` is pure; slot starts are anchored at `opensMinute + n × slotDuration` in Riyadh local time, so `slotStart` values are deterministic. Pre-generating rows would go stale silently when hours change, and would be a second source of truth for a capacity the `booking` table already knows.

Concurrency is solved with a **seat index + unique partial index** — no `FOR UPDATE`, no `SERIALIZABLE`:

```sql
create unique index booking_seat_uniq on booking (zone_id, slot_start, seat_index)
  where status in ('pending','approved');
```

Pick the lowest free seat, insert, and on `23505` recompute and retry (bounded at `capacity + 1`) before returning `slot_full`. Locking the zone row would serialise every booking for that zone across all slots and deadlock against an admin editing its hours. **The loser never sees a 500** — they get a bilingual toast, that slot greys out in place, and three nearest free slots render as one-click buttons.

### Approval workflow — `src/lib/workflow/`

A `TRANSITIONS` table plus one `applyTransition()` that writes the row, the `audit_event` and the `notification` in a single transaction. **No server action changes a status by hand.**

- **Drone:** `draft → pending → approved | rejected`; `rejected → pending` (resubmit, `rejectionCount++`, prior rejection preserved in audit); `approved → expired` (system) `→ pending` (renewal, **same Remote ID code retained**); `approved ↔ revoked` (**admin only**, reason required). Rejection requires a written reason of ≥20 chars at the Zod boundary, stored on the row, in the audit event, and quoted verbatim in the email in the pilot's own locale. On approval: issue dates set, Remote ID row created, QR rendering enqueued. On revocation: Remote ID suspended and every future booking cancelled with a reason.
- **Booking:** `pending → approved | rejected | cancelled`; auto-approve where `zone.autoApprove` and the pilot has no recent no-shows; authority cancellation any time with a reason; system transitions to `completed` / `no_show` after the slot ends. Check-in is a separate action that sets `checkedInAt` without changing status.
- **Expiry reminders:** Inngest cron daily at 03:00 Riyadh, at 60 / 30 / 7 days, each writing a notification, an email, and an audit event — so "did we warn them?" is answerable.

### Routes and boundaries

```
[locale]/(public)   landing · how-it-works · remote-id · zones (read-only map)
                    rid/[code] · sign-in/up · reset · docs · privacy · terms
[locale]/(app)      requireUser()     dashboard · profile/complete · drones/* · map
                                      bookings/* · notifications · settings/*
[locale]/(admin)    requireReviewer() review queue · drones · bookings · pilots · lookup
                                      zones/* + cities + audit → requireAdmin()
api/                NOT under [locale] auth · upload · inngest · rid/[code] · zones/geojson
```

`src/middleware.ts` composes next-intl's middleware with an **optimistic** cookie check — a UX nicety that never reads the role and **is never the security boundary**. The boundary is `src/lib/auth-guards.ts` (`requireUser` / `requirePilotProfile` / `requireReviewer` / `requireAdmin`), called in each route group's layout **and again inside every server action**, because a layout guard does not protect an action. Guards `notFound()` rather than throw, so a non-admin gets a 404 rather than a stack trace.

Every server action follows: `requireX()` → `rateLimit()` → `schema.parse()` → domain call → audit + notify in one transaction → `revalidatePath` → typed `{ ok: true, data } | { ok: false, reasons: Reason[] }`. Actions never throw for expected refusals. A shared `GeoJSONGeometrySchema` caps rings and total vertices (~5 000) — an unbounded polygon in `jsonb` is both a DoS and a slow point-in-polygon. Zone bbox and vertex count are computed server-side, never trusted from the client.

**Rate limiting is two layers, because Better Auth's covers `/api/auth/*` only** and server actions are ordinary POSTs to the page route, invisible to it. Layer 1: Better Auth `customRules` on sign-up/sign-in/reset. Layer 2: `src/lib/rate-limit.ts` backed by `rate_limit_bucket` with one atomic `insert … on conflict … do update … returning count` — no Redis, works on serverless Neon, swept nightly. Applied to `createBooking` (3/min, 20/day), `submitDroneForReview` (5/hr), photo upload (20/hr), `resolveRemoteId` (30/min per IP hash), `checkAirspace` (60/min, debounced client-side), admin lookup (60/min). Exceeding returns a bilingual `rate_limited` reason with `retryAfterSeconds`, never a 429 page.

---

## Build waves

Every wave ends with `pnpm exec tsc --noEmit`, `pnpm lint` and `pnpm build` green. `build` is `pnpm db:migrate && next build`, so any wave touching the schema runs `db:generate`, **reads the generated SQL**, then `db:migrate` first. **Never `drizzle-kit push`.**

| Wave | Contents | Parallel |
|---|---|---|
| **0 — Groundwork** | `git init` in `drone-2-demo` (it currently sits inside the `C:\Users\alsha` home repo and would otherwise be swallowed by it); Step 2 of the skill — one research subagent per chosen branch establishing current stable versions and any deprecations before a single package is installed | serial |
| **1 — Shell** | `create-next-app` into `.`, shadcn init, next-intl (`ar` default, `localePrefix: "always"`), `<html lang dir>`, IBM Plex Sans Arabic, `messages/{ar,en}.json`, `format.ts`, the RTL + numerals ESLint rules, `pnpm i18n:check` comparing key sets across catalogues | serial |
| **2 — Database** | Docker Postgres, Drizzle config, `db:*` scripts, the whole schema in one migration, Riyadh seed | serial |
| **3 — Auth** | Better Auth + `role`/`preferredLocale`, CLI regenerate → generate → migrate, first-account-is-admin, `auth-guards.ts`, `data/` scoping layer, middleware, bilingual auth pages | serial |
| **4a Email · 4b Uploads · 4c Jobs · 5 Domain core** | Resend + bilingual templates · local→Blob storage · Inngest functions · the pure `airspace`/`slots`/`remote-id`/`workflow` libraries with Vitest fixtures (point inside DQ, permitted-zone-inside-restricted, CTR hole, window-boundary slot, Friday double windows, seat-collision retry) | **4 sub-agents in parallel** — disjoint folders; only 4a touches `src/lib/auth.ts`, so that edit is serialised |
| **6 — Pilot experience** | Landing, dashboard, profile wizard, drone registration, `/rid/[code]` + QR card, MapLibre map with the live status panel calling the *same* `evaluate.ts`, booking flow, notifications | after 4+5; splittable 3 ways |
| **7 — Admin experience** | Review queues, decision screens with required reasons, terra-draw zone editor (admin bundle only, `ssr: false`), closures, cities, Remote ID lookup + reveal, audit browser | after 6; queue ∥ editor |
| **8 — Close-out** | Docs → legal → settings → ops/system page → SEO, **in that exact order** (SEO writes the sitemap and must see every public page docs and legal added) | strictly serial |

Wave 6 must not start before wave 5 lands, or the map grows its own copy of the point-in-polygon code — the single most likely way this design decays.

---

## Verification

**The gate** (`references/verify.md`, run in this order — schema before build, so no unread SQL is ever applied):

1. `pnpm exec tsc --noEmit` · 2. `pnpm db:generate` (no drift) + `pnpm db:migrate` · 3. `pnpm build` · 4. `pnpm lint` · 5. `pnpm start` and every route answers · 6. two accounts checked against each other · 7. the app with its keys taken away.

**Domain checks beyond the gate:**

- **Unit (Vitest):** a point inside the Diplomatic Quarter denies even though it sits inside a permitted zone's bbox; a point in a permitted carve-out inside the city restricted boundary *allows*; a point in a CTR hole; slots at a window boundary; a Friday with two windows; the seat-collision retry under simulated concurrency.
- **End-to-end, by hand, in Arabic:** sign up → complete profile → register an FPV drone **with no serial number** → submit → sign in as admin → approve with the review queue → confirm the pilot got an in-app notification and an email → open the drone's Remote ID card → scan/visit the QR URL **signed out** and confirm the owner's name and national ID are *not* shown → sign back in as admin, use Reveal, and confirm the audit event was written first → book a slot → confirm a second pilot cannot take the last seat.
- **Ownership:** pilot B cannot open pilot A's drone or booking by URL (expects 404, not 403 or a stack trace); a pilot hitting `/admin` gets 404.
- **RTL/i18n:** both locales at a narrow viewport, in light and dark; no Hijri dates and no Arabic-Indic digits anywhere; `pnpm i18n:check` passes.
- **Fresh eyes (Step 7):** four critic agents in parallel — promise-keeping, ownership, looks-like-theirs, operability — reading captured evidence against the build sheet. Two rounds maximum, then report what's left.

**Named as un-runnable without your input:** sending email to any address other than yours (needs a domain + DNS in Resend); Vercel Blob uploads (needs a deployed store — local folder is exercised instead); anything requiring a real deployed domain (agent-issued URLs, the OG card as a third party sees it).

---

## What I'll need from you

- Docker Desktop running before wave 2 (`pnpm db:up`).
- Nothing else to start. A Resend API key and a domain can arrive any time — until they do, emails print to the terminal and are still logged in-app, so the workflow is fully testable.

## Explicitly not in v2

Live telemetry / real-time drone tracking · a native field-inspector app (the JSON scan endpoint is built for it, though) · payments · an AI assistant · SMS/OTP · real GACA airspace data (zones are realistic but authored, and the app says so on the map).
