# To do — yours, not the build's

Things only you can do. Everything here is **optional for the build to continue** unless marked otherwise — the app works without any of it. Tick as you go.

Last updated: 2026-08-16, after F06 (transactional email).

---

## 1. Read the Arabic copy ⭐ the important one

Nobody who reads Arabic has read a word of this app yet. It's written to be correct and idiomatic, but that's my claim, not a check.

- [ ] **Email copy — 11 subject lines and ~100 strings.** Open http://localhost:3001/ar/dev/emails and read down the Arabic column. The strings live in `messages/ar.json` under `email`.
  - The **subjects** matter most — they're what someone sees in a list of 40 unread messages.
  - `booking-cancelled-by-authority` matters second most: it's the only email whose failure has a consequence outside the app (someone flies a slot that's no longer authorised).
  - **Ignore** the full stop appearing on the *left* of `AJNIHA-PROPOSAL/NOTAM-0142` — that's correct Unicode bidi, and it's deliberately not "fixed".
- [ ] **UI copy — the other 347 keys**, in `messages/ar.json`. Auth pages are at `/ar/sign-in`, `/ar/sign-up`, `/ar/forgot-password`.
- [ ] **Zone names and notes** from the Riyadh seed, in `src/lib/seed/zones-riyadh.ts`. These are the names a pilot sees on the map.

Tell me what's wrong and I'll fix it — or edit `messages/ar.json` directly, then run `pnpm lint` (it checks the two catalogues against each other).

---

## 2. Create your own account 🔒 do this before anyone else touches the app

**The first account created becomes admin.** There is exactly one, and it's yours. The `user` table is empty right now, and I've deliberately never created a probe account.

- [ ] Start the app (`pnpm dev`), go to `/ar/sign-up`, sign up.
- [ ] Confirm the role: `pnpm db:studio`, or ask me to check the row.

If someone else signs up first, they're the admin and you aren't — and undoing that means deleting their account.

---

## 3. A Resend key — optional, ~10 minutes

Without it, emails render, print to the terminal in full, and log as `skipped`. Everything works. **No remaining feature needs this.**

What it buys: proof that a message actually arrives, and the only two `email_log` states nothing has ever reached (`sent`, and a real `providerMessageId`).

- [ ] Sign up at https://resend.com
- [ ] **API Keys → Create API Key**, sending access. Copy it — shown once.
- [ ] Put it in `.env` as `RESEND_API_KEY=re_…`
- [ ] Restart the dev server, then **rebuild** if you want the auth pages' notice to update — `emailConfigured` is baked in at build time (Open Thread 17).

Note: without a verified domain it will **only** deliver to the address you signed up with. That's fine for proving it works.

- [ ] *Later, only if you want to email anyone else:* a domain + three DNS records on a **subdomain** (`send.yourdomain.com`), so a deliverability problem can never damage your normal email.

---

## 4. Before this ever goes live

Not now — but they're silent failures, so they're written down.

- [ ] `APP_URL` on the real domain. **Every QR sticker printed with `localhost` in it is dead paper.**
- [ ] `BETTER_AUTH_URL` on the same origin the app is served from, or every auth POST — sign-in included — is refused with `INVALID_ORIGIN`.
- [ ] `POSTGRES_URL` pointing at Neon, needed at **build** time (the build runs migrations).
- [ ] Vercel Blob store connected (F07 will explain).
- [ ] Inngest keys, then **sync the app** with Inngest after the first deploy (F08).
- [ ] Verify the email sending domain in DNS.

---

## 5. Known gaps I can't close myself

- [x] ~~**The 375 px mobile view has never been checked, on any page**~~ — **done for the signed-in pages (2026-08-31), and it found a real bug**: the header overflowed a phone screen in both languages and pushed the **sign-out button off the edge**. Fixed. Measured through an iframe, since the browser tool still refuses to resize. **Still worth your eyes**: `/ar/dev/emails` and the scan page, which I can now measure too — say the word.
- [ ] **Nobody has seen one of these emails in a real mail client.** Gmail's and Outlook's handling of Arabic direction and inline styles is exactly the kind of thing that only shows up on arrival. Needs §3 first.
- [ ] **Port 3000 and port 3100 are taken by other apps on this machine.** Worth knowing why a URL sometimes answers with something that isn't this project.

---

## Not on this list, because they're mine

Building F07–F31, tests, migrations, the build log. Ask and I'll pick any of them up.
