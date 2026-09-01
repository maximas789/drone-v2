# Deploying Ajniha

**Written from a pre-flight on 2026-09-01.** Nothing here has been executed —
this app has never run anywhere but one Windows machine, and every line below
is a plan until it isn't. When it runs, the results belong in
[`VERIFICATION.md`](./VERIFICATION.md) and the log entry, not here.

The order matters more than usual. Two steps are irreversible in ways that cost
real money or a working account.

---

## The two traps, first

**1. The first user row created becomes the admin, and it does not care where
the row came from.** `src/lib/auth.ts:243` counts existing rows on user
creation. On a fresh production database that count is zero for exactly one
insert. `verify:two-accounts` and `verify:no-keys` both create probe pilots.

> **You sign up on the deployed site before anything else touches the database.**
> If a probe row wins that race, a deleted account owns `/settings/system` and
> deleting it does not hand the role back.

**2. `APP_URL` is baked in at render time, and you cannot know it before the
first deploy.** So the first deploy is necessarily wrong, and that is fine as
long as nothing is *printed* from it:

```
deploy → read the assigned URL → set APP_URL and BETTER_AUTH_URL → redeploy
       → re-render stickers from /settings/system
```

Every QR rendered between those two passes encodes the old origin and is dead
paper. `BETTER_AUTH_URL` not matching the served origin refuses every auth POST
with `INVALID_ORIGIN` — sign-in included, silently.

---

## Environment

`B` = must be present at **build** time, not only at runtime. The build runs
`db:migrate` and prerenders pages that read these values.

| Variable | | Who sets it | Notes |
|---|---|---|---|
| `POSTGRES_URL` | **B** | you | Neon. Use the **pooled** endpoint — see below. Keep `sslmode=require`. |
| `BETTER_AUTH_SECRET` | | you | `openssl rand -base64 32`. Rotating it invalidates every session. |
| `BETTER_AUTH_URL` | | you | The exact served origin. Trap 2. |
| `APP_URL` | **B** | you | Trap 2. Warns, never throws — an unset value builds cleanly and publishes a sitemap of `localhost`. |
| `ID_HASH_PEPPER` | | you | **Generate once. Never regenerate** — rotating orphans every stored hash. A *different* value from local is correct here: the production database is empty. |
| `RATE_LIMIT_PEPPER` | | you | Same. |
| `RESEND_API_KEY` | **B** | you | Optional, but `emailConfigured` is baked at build (thread 17) — set it *before* the build you intend to keep, or the auth pages advertise the wrong thing. |
| `EMAIL_FROM` | | you | **Set it or leave it unset — never set it empty.** An empty string sent every message with a blank `from` while the health row read "sandbox"; fixed in F31c, but the value is still yours to get right. |
| `BLOB_READ_WRITE_TOKEN` | | you | Unset uses the local-folder driver, which **cannot work on Vercel** — the filesystem is ephemeral and read-only. Uploads need this. |
| `INNGEST_EVENT_KEY` | | you | |
| `INNGEST_SIGNING_KEY` | | you | Without it the SDK **500s every request** to `/api/inngest`. |

I do not set any of these. They are credentials, and I do not type credentials
into anything — including `vercel env add`, including reading them out of your
own `.env`.

---

## Order of operations

### Yours — 1 to 4

1. `! vercel login`
2. Create the Neon database. **Take the pooled connection string** (the host
   contains `-pooler`). The runtime pool is `postgres(url, { max: 10 })` per
   instance, and serverless multiplies instances — the direct endpoint will run
   out of connections before the pooled one does.
3. Create the Blob store and the Inngest app.
4. `vercel env add` for every row above, or paste them into the project's
   settings. `POSTGRES_URL`, `APP_URL` and `RESEND_API_KEY` must exist **before
   the first build you intend to keep.**

### Mine — 5 to 8

5. Link the project and run the first deploy. Read back the assigned URL.
6. Hand you the URL so you can set `APP_URL` and `BETTER_AUTH_URL` to it, then
   redeploy.
7. **Stop.** You sign up. Trap 1.
8. Then, and only then, the verification pass below.

---

## Verifying a deployment

The `verify:*` suite takes a `BASE`, so it points at a real origin unchanged:

```bash
BASE=https://<the-domain> pnpm verify:routes
BASE=https://<the-domain> pnpm verify:scan-page
```

What each proves against a deployed origin that it could not prove locally:

| Script | New information |
|---|---|
| `verify:routes` | The guards hold on the platform's router, not just Next's. |
| `verify:scan-page` | The anonymous surfaces leak nothing when served publicly. |
| `verify:qr` | **The one that changes meaning.** Locally it passes and warns that every sticker encodes `localhost`. With a real `APP_URL` it stops warning, and that is the first usable sticker this project has produced. |
| `verify:two-accounts`, `verify:no-keys` | Run **after** you sign up. Both create probe pilots; both delete them. |
| `verify:fresh-db` | Nothing new — it drops a scratch database and must **not** be pointed at Neon. |

Then the things only a deployment can prove at all, none of which have ever
executed: a Blob upload, an email arriving in a mail client, Inngest syncing and
calling `/api/inngest` with a real signature.

---

## Decisions taken in the pre-flight

**No `vercel.json`.** Nothing needs it. There are no cron routes — Inngest holds
the schedule and calls in — no rewrites, no custom headers, and no route sets a
`maxDuration`. A config file that only restates defaults is a file someone later
has to check.

**No `engines.node` pin.** CLAUDE.md rule 2: no version numbers. Vercel takes
its current default, which is the same rule the rest of this project runs on.
Local is newer than what the platform will use; nothing in the build depends on
that difference.

**`max: 10` is left as it is** (`src/lib/db/client.ts:21`). It is right for one
long-lived server and generous for serverless, where each instance opens its own
pool. The pooled Neon endpoint absorbs this; if connection errors show up under
load, that constant is the first thing to lower — not the endpoint to change.

---

## What a deploy still will not prove

Carried from `VERIFICATION.md`'s "named as un-runnable" list, because a URL does
not close them:

- **Email to anybody but the account owner** — needs a verified sending domain
  in DNS, on a subdomain, so a deliverability problem cannot reach your normal
  mail.
- **A printed QR scanned at 20 mm** — needs a printer and a phone.
- **The booking race in two real browsers** — needs a second signed-in *pilot*;
  one pilot in two windows is refused by `duplicate_booking` first, which is a
  different refusal than the one being tested.
