    # Ajniha (أجنحة) — Implementation Plan

> **Master document.** The high-level plan, wave order, and the index of feature specs.
> Each feature has its own file in [`features/`](./features) with technical detail and acceptance criteria.
> Source plan: [`ajniha-v2-implementation-plan.md`](./ajniha-v2-implementation-plan.md)

---

## 1. What we're building

A bilingual (Arabic-first, RTL) Saudi drone registration and flight-zone booking platform, pitched at **GACA** (General Authority of Civil Aviation).

**The gap it closes.** GACA's registration requires a manufacturer serial number. Self-built and FPV drones don't have one, so their pilots have no legal way to register and nowhere officially sanctioned to fly. Ajniha replaces the serial-number requirement with **Remote ID** — the direction the regulator is already moving, since GACA mandates Direct or Network Remote ID as of 1 January 2026 with 3-year registration validity.

**The demo that has to work end to end:**

> A pilot registers a self-built FPV drone **with no serial number** → is issued Remote ID `AJN-4F2K-91XZ` and a scannable digital ID card → a GACA reviewer approves it from a real queue with a real audit trail → the pilot books a slot in a carved-out permitted zone inside Riyadh's default-deny restricted airspace → a field inspector scans the QR **signed out** and sees the aircraft is accountable and registered, but *not* who owns it → the inspector, as a reviewer, uses **Reveal identity**, which is logged before the value is returned.

---

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Fixed by the `start-an-app` skill |
| Styling | Tailwind + shadcn/ui | Logical properties only (RTL) |
| Database | Postgres — Docker locally, Neon in production | No PostGIS; GeoJSON in `jsonb` + denormalised bbox |
| ORM | Drizzle | `db:generate` → `db:migrate`. **Never `push`.** |
| Auth | Better Auth | Email + password; roles `pilot | reviewer | admin` |
| i18n | next-intl | `ar` default, `localePrefix: "always"` |
| Map | MapLibre GL JS + OpenFreeMap | No API key. `terra-draw` for admin drawing. |
| Email | Resend | Bilingual React Email templates |
| Uploads | Local folder → Vercel Blob | Same code, env-var switch |
| Jobs | Inngest | Expiry sweeps, reminders, closeout, QR rendering |
| Tests | Vitest | Domain core only — geometry, slots, codec, workflow |

**Not included:** payments · AI assistant · MCP agent access · SMS/OTP · live telemetry.

---

## 3. Non-negotiable rules

These are inherited from the `start-an-app` skill and from the domain. Every feature spec assumes them.

1. **Never `drizzle-kit push`.** Schema changes go `db:generate` → *read the SQL* → `db:migrate`, every time, from the first table.
2. **Every table gets a random UUID primary key** — except Better Auth's generated tables, which are left exactly as the CLI wrote them. Any column referencing a user is therefore `text`, not `uuid`.
3. **The app is the current working directory.** No subfolder, no `cd`.
4. **Never write a version number** into a package install, a config, or a Docker tag. Every install takes current stable; Wave 0 research establishes what that is.
5. **Nothing deprecated.** If the current release supersedes an approach, use the replacement — "still works" is what deprecated means.
6. **A check that wasn't run is named, never claimed.**
7. **Ownership is enforced in one place.** No page or server action calls `db` directly; all reads go through `src/lib/data/*.ts` functions whose first argument is the session.
8. **Middleware is never the security boundary.** It's an optimistic redirect. The boundary is a guard called in the layout *and again inside every server action*.
9. **Logical properties only** — `ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`. An ESLint rule bans `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-`.
10. **No bare `toLocaleDateString`/`toLocaleTimeString`.** Everything goes through `src/lib/format.ts`, which forces `ar-SA-u-ca-gregory-nu-latn` — Gregorian calendar, Latin numerals, both locales.
11. **`src/lib/airspace/evaluate.ts` stays pure.** No `db`, no `server-only`, no `next-intl`, no React. It runs identically on the server (authoritative) and in the map (instant feedback).
12. **Refusals are never exceptions.** Server actions return `{ ok: false, reasons: Reason[] }` with machine-readable codes translated at render.

---

## 4. Cross-cutting conventions

**Bilingual content.** Paired `*_ar` / `*_en` **columns** for human-authored text — they index, sort, and map 1:1 onto admin forms. Anything enumerable is stored as a stable **code** and translated at render, so a rejection reason written once renders in whichever language the reader picks. Notifications store `type` + `params`, never rendered strings.

**Time.** Every instant is `timestamptz`. Civil timezone is `Asia/Riyadh` (fixed +180, Saudi has never observed DST). The week starts **Sunday = 0**.

**Geometry.** GeoJSON `Polygon | MultiPolygon` in `jsonb`, WGS84, `[lng, lat]` order, with the coordinate type named `Position` to stop the classic reversal bug. Denormalised `minLat/maxLat/minLng/maxLng` as `doublePrecision` for SQL bbox pre-filtering. Point-in-polygon is ray-casting in TypeScript.

**Server action shape.** Every action, without exception:

```
requireX()  →  rateLimit()  →  schema.parse()  →  domain call
            →  audit + notify in ONE transaction
            →  revalidatePath()
            →  { ok: true, data } | { ok: false, reasons: Reason[] }
```

**One log, not two.** A single `audit_event` table backs both the regulator approval trail and the ops activity log. *This deliberately diverges from the skill's `activity_log` naming — two overlapping logs drift, and the trail an admin reads must be the trail a regulator audits.*

---

## 5. Build waves

Every wave ends with `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm build` green. `build` is `pnpm db:migrate && next build`, so any wave touching the schema generates, **reads the SQL**, and migrates first.

| Wave | Features | Parallelism |
|---|---|---|
| **0 — Groundwork** | [F01](./features/F01-project-shell.md) | Serial. `git init` first — see §7. |
| **1 — Shell** | [F02](./features/F02-i18n-rtl-foundation.md) | Serial |
| **2 — Database** | [F03](./features/F03-database-schema.md), [F04](./features/F04-riyadh-seed-data.md) | Serial |
| **3 — Auth** | [F05](./features/F05-auth-roles-access.md) | Serial |
| **4 — Platform services** | [F06](./features/F06-transactional-email.md), [F07](./features/F07-file-uploads.md), [F08](./features/F08-background-jobs.md), [F09](./features/F09-rate-limiting.md) | **4 sub-agents in parallel** |
| **5 — Domain core** | [F10](./features/F10-remote-id-issuance.md), [F11](./features/F11-remote-id-redaction.md), [F12](./features/F12-airspace-engine.md), [F13](./features/F13-slots-and-concurrency.md), [F14](./features/F14-workflow-and-audit.md), [F15](./features/F15-notifications.md) | Runs ∥ with Wave 4 |
| **6 — Pilot experience** | [F16](./features/F16-public-landing.md), [F17](./features/F17-pilot-profile.md), [F18](./features/F18-drone-registration.md), [F19](./features/F19-digital-id-card.md), [F20](./features/F20-airspace-map.md), [F21](./features/F21-booking-flow.md) | Splittable 3 ways after Waves 4+5 |
| **7 — Admin experience** | [F22](./features/F22-admin-review-queues.md), [F23](./features/F23-zone-management.md), [F24](./features/F24-remote-id-lookup.md), [F25](./features/F25-compliance-analytics.md) | Queue ∥ editor |
| **8 — Close-out** | [F26](./features/F26-help-documentation.md) → [F27](./features/F27-legal-pages.md) → [F28](./features/F28-account-settings.md) → [F29](./features/F29-system-ops-page.md) → [F30](./features/F30-seo-discoverability.md) | **Strictly serial, in this order** |
| **9 — Prove it** | [F31](./features/F31-verification-gate.md) | Serial |

**Two ordering constraints that matter:**

- **Wave 6 must not start before Wave 5 lands.** If it does, the map grows its own copy of the point-in-polygon code — the single most likely way this design decays.
- **Wave 8 runs in exactly the listed order.** SEO writes the sitemap from one list of public pages, and both docs and legal add pages to it. A sitemap written before them is wrong the moment they run.

**Wave 4/5 parallelism note:** the four Wave 4 features touch disjoint folders with exactly one shared file — F06 edits `src/lib/auth.ts`. That edit is serialised; every other sub-agent stays out of that file.

---

## 6. Feature index

### Foundation
| # | Feature | Wave |
|---|---|---|
| [F01](./features/F01-project-shell.md) | Project shell & tooling | 0 |
| [F02](./features/F02-i18n-rtl-foundation.md) | Bilingual i18n & RTL foundation | 1 |
| [F03](./features/F03-database-schema.md) | Database schema | 2 |
| [F04](./features/F04-riyadh-seed-data.md) | Riyadh airspace seed data | 2 |
| [F05](./features/F05-auth-roles-access.md) | Authentication, roles & access control | 3 |

### Platform services
| # | Feature | Wave |
|---|---|---|
| [F06](./features/F06-transactional-email.md) | Transactional email | 4 |
| [F07](./features/F07-file-uploads.md) | File uploads & document storage | 4 |
| [F08](./features/F08-background-jobs.md) | Background jobs | 4 |
| [F09](./features/F09-rate-limiting.md) | Rate limiting | 4 |

### Domain core
| # | Feature | Wave |
|---|---|---|
| [F10](./features/F10-remote-id-issuance.md) | Remote ID issuance & codec | 5 |
| [F11](./features/F11-remote-id-redaction.md) | Remote ID redaction & public resolution | 5 |
| [F12](./features/F12-airspace-engine.md) | Airspace authorization engine | 5 |
| [F13](./features/F13-slots-and-concurrency.md) | Slot derivation & booking concurrency | 5 |
| [F14](./features/F14-workflow-and-audit.md) | Workflow state machines & audit trail | 5 |
| [F15](./features/F15-notifications.md) | Notifications | 5 |

### Pilot experience
| # | Feature | Wave |
|---|---|---|
| [F16](./features/F16-public-landing.md) | Public landing & concept pages | 6 |
| [F17](./features/F17-pilot-profile.md) | Pilot profile | 6 |
| [F18](./features/F18-drone-registration.md) | Drone registration flow | 6 |
| [F19](./features/F19-digital-id-card.md) | Digital ID card & QR | 6 |
| [F20](./features/F20-airspace-map.md) | Interactive airspace map | 6 |
| [F21](./features/F21-booking-flow.md) | Booking flow & pilot dashboard | 6 |

### Admin / GACA
| # | Feature | Wave |
|---|---|---|
| [F22](./features/F22-admin-review-queues.md) | Admin review queues & decisions | 7 |
| [F23](./features/F23-zone-management.md) | Zone & closure management | 7 |
| [F24](./features/F24-remote-id-lookup.md) | Remote ID lookup & identity reveal | 7 |
| [F25](./features/F25-compliance-analytics.md) | Compliance analytics & audit browser | 7 |

### Close-out
| # | Feature | Wave |
|---|---|---|
| [F26](./features/F26-help-documentation.md) | Help documentation | 8 |
| [F27](./features/F27-legal-pages.md) | Legal pages | 8 |
| [F28](./features/F28-account-settings.md) | Account settings | 8 |
| [F29](./features/F29-system-ops-page.md) | System / ops page | 8 |
| [F30](./features/F30-seo-discoverability.md) | SEO & discoverability | 8 |
| [F31](./features/F31-verification-gate.md) | Verification gate & fresh eyes | 9 |

---

## 7. Repository note — read before Wave 0

`drone-2-demo` currently has **no git repository of its own**. It sits inside the `C:\Users\alsha` home repo (`origin: maximas789/alsha.git`), a personal notes vault. Without `git init` in the project directory, every Ajniha commit lands in that vault alongside unrelated ingest notes.

Wave 0 therefore runs `git init` in `C:\Users\alsha\Desktop\drone-2-demo` **before** `create-next-app`, and adds `drone-2-demo/` to the parent repo's `.gitignore` so the nested repo isn't picked up as an untracked directory.

---

## 8. Environment & prerequisites

| Requirement | Status |
|---|---|
| Node | v25.0.0 installed |
| pnpm | 10.25.0 installed |
| Docker Desktop | 29.7.2, daemon running — **must be running before Wave 2** (`pnpm db:up`) |
| Resend API key | Optional. Without it, emails print to the terminal and are still logged in-app. |
| Domain + DNS | Optional. Needed only to email addresses other than your own. |
| Map API key | **None needed** — OpenFreeMap requires no account. |

`.env` keys the build will create: `POSTGRES_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `BLOB_READ_WRITE_TOKEN`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `ID_HASH_PEPPER`.

---

## 9. Going to production

Each of these is a setting on the host, not a code change:

- Point `POSTGRES_URL` at Neon (needed at **build** time, not just runtime — `build` runs migrations).
- Set `APP_URL` and `BETTER_AUTH_URL` to the real domain, or the sitemap, canonical links, OG card, **and every QR code** will encode `localhost`.
- Connect a Vercel Blob store for uploads.
- Add `RESEND_API_KEY` once the sending domain is verified in DNS.
- Add the Inngest keys, then **sync the app** with Inngest after the first deploy.

The two that need action *outside* the host: verifying the email domain in DNS, and syncing with Inngest.

---

## 10. Definition of done

The build is finished when [F31](./features/F31-verification-gate.md) passes: the full gate (types, schema drift, build, lint, production serve, every route answering, two accounts checked against each other, the app with its keys taken away), the domain test suite, the end-to-end walkthrough in §1 performed by hand **in Arabic**, and two rounds of fresh-eyes critics against this plan's acceptance criteria.

Anything that could not be verified is **named**, with what it would need — never silently assumed to work.
