# F29 — System / Ops Page

**Wave:** 8 (fourth) · **Depends on:** [F06](./F06-transactional-email.md), [F08](./F08-background-jobs.md), [F14](./F14-workflow-and-audit.md) · **Skill reference:** `references/ops.md`

## Purpose

Everything the app does out of sight, made visible and controllable **from inside the app**. This is the answer to "why didn't that email arrive?" and "is that job still running?" — questions that otherwise send the operator to a hosting dashboard, or to nobody.

Building something the user cannot watch is not finished.

## Technical design

`/[locale]/settings/system` — **admin only**. Linked from the settings nav, conditionally rendered so no dead link appears for anyone else.

### Health & configuration

Every integration, what it's for, whether it's configured, and **what changes if it isn't** — never a bare red dot.

| Check | Healthy | Degraded shows |
|---|---|---|
| Database | Connection + latency | The error, and that the app cannot serve |
| Migrations | All applied | **Pending migration names** — a deploy that skipped `db:migrate` |
| Resend | Key present, domain verified | "Emails print to the terminal only" + how to fix |
| Blob storage | Token present | "Uploads write to `./uploads`; they will not persist on a serverless host" |
| Inngest | Endpoint reachable, functions registered | Which functions are missing |
| **`APP_URL`** | Matches the request origin | **"QR codes are being generated pointing at `{value}`"** — see below |
| `BETTER_AUTH_URL` | Matches origin | Sessions may not persist |
| `ID_HASH_PEPPER` | Set | Present/absent only — **never the value** |
| Seed data | Zones present | "Run `pnpm db:seed`" |

**The `APP_URL` check earns its place.** Every QR code embeds `APP_URL` at render time. If it still says `localhost` when the first drone is approved in production, every printed sticker is dead — and nothing else in the app would ever surface that. The check is prominent, and it offers the **re-render all QR codes** action from [F19](./F19-digital-id-card.md).

Secrets are shown as present/absent. **No value, no prefix, no last-four.** A "helpful" masked prefix is still a leak.

### Activity log

Reads from `audit_event` — [F25](./F25-compliance-analytics.md)'s browser is the full-power view; this is the operational slice: recent events, filterable by actor, action, and system-vs-human, with the newest 50 by default and a link through to the full browser.

**One log, not two.** The trail an admin reads here is the trail a regulator would audit.

### Background jobs

Every run from the `jobs` table: function, status, started, duration, and the **error message in full** when failed — not "an error occurred".

Per run:
- **Cancel** → labelled **"cancelling"**, never "cancelled". It takes effect at the next step boundary, and saying otherwise is a lie the operator will catch.
- **Re-run** → starts a **new** run and shows the **new id**, rather than pretending the old one restarted.

Scheduled functions are listed with their cron, timezone (`Asia/Riyadh`), last run, and next due — so "did the expiry sweep run last night?" is answerable in one glance.

### Email log

Every send from `email_log`: recipient, template, locale, status, provider id, and the **provider's actual error** on failure.

Filterable by status and template. Each row links to the notification it accompanied ([F15](./F15-notifications.md)'s `emailLogId`) and to the entity it was about — which is what closes the loop: *the decision happened, the notification exists, the email failed, here's why.*

**A skipped email (no API key) is visually distinct from a failed one.** Conflating "not configured" with "broken" sends the operator debugging a problem that doesn't exist.

### Data counts

Row counts for pilots, drones by status, Remote IDs, zones by kind, bookings by status, audit events. A cheap sanity check after a deploy or a seed.

### No agent-activity section

[`references/mcp.md`](../implementation%20plan.md) never ran — no MCP, no agent access. That section is **absent**, not an empty panel.

## Files

```
src/app/[locale]/(app)/settings/system/page.tsx
src/lib/ops/{health,counts}.ts
src/lib/actions/ops.ts             cancelRun, rerunRun, regenerateAllQr, resendEmail
src/components/ops/{health-grid,health-item,activity-log,jobs-table,
                    email-log,data-counts}.tsx
```

## Acceptance criteria

**Access**
- [ ] Admin-only: a **pilot** and a **reviewer** both get 404.
- [ ] The System link appears in the settings nav **only** for admins.

**Health**
- [ ] Every configured integration reports healthy with real detail (latency, domain state, function count).
- [ ] Removing `RESEND_API_KEY` shows degraded **with the consequence stated** — "emails print to the terminal only" — and the app still works.
- [ ] Removing `BLOB_READ_WRITE_TOKEN` explains uploads go to `./uploads` and won't persist on a serverless host.
- [ ] Stopping Postgres shows the database check failed **with the actual error**.
- [ ] An unapplied migration is detected and **names the pending migration**.
- [ ] Setting `APP_URL` to something other than the request origin raises a prominent warning naming the value QR codes are being generated with.
- [ ] The **re-render all QR codes** action works and updates every `qrPathname`.
- [ ] **No secret value, prefix, or last-four appears anywhere** on the page — inspect the rendered HTML source.
- [ ] An empty zones table prompts `pnpm db:seed`.

**Jobs**
- [ ] Every Inngest run appears with status, start time, and duration.
- [ ] A failed run shows the **full** error message.
- [ ] Cancel is labelled **"cancelling"**, not "cancelled".
- [ ] Re-run creates a **new** run and shows its new id.
- [ ] Scheduled functions list cron, `Asia/Riyadh`, last run, and next due.

**Email log**
- [ ] Every send appears with recipient, template, locale, and status.
- [ ] A failed send shows the provider's actual error.
- [ ] A skipped send (no key) is **visually distinct** from a failed one.
- [ ] Each row links to its notification and to the entity it was about.
- [ ] Filtering by status and template works.
- [ ] The full loop is traceable: approve a drone with a broken email config → the audit event, the in-app notification, and the failed email with its reason are all reachable from this page.

**General**
- [ ] Activity log reads from `audit_event` — there is **no second log table**.
- [ ] Data counts match `pnpm db:studio`.
- [ ] **No agent-activity section exists.**
- [ ] The page renders correctly in Arabic RTL; tables are readable at 1024 px.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
