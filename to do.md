# To do — yours, not the build's

Things only you can do, plus the work we are carrying on with. Tick as you go.

Last updated: 2026-09-20, after the production checks (QR, email, Inngest, Blob, region).

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

**The first account created becomes admin.** There is exactly one, and it's yours.

- [x] Signed up (2026-09-08) — the owner's account is the admin.
- [x] Role confirmed: the admin account can open `/admin` and read every drone's files.

---

## 3. Still to do before real pilots use it

- [ ] **A verified email domain.** Today approval emails only reach `alshar55@hotmail.com`, because Resend's sandbox sender delivers only to the account owner's address. Emailing any other pilot needs a domain you own: add it in Resend, add the DNS records it shows you on a **subdomain** (`send.yourdomain.com`) so a deliverability problem can never damage your normal email, then set `EMAIL_FROM` on Vercel (for example `Ajniha <no-reply@send.yourdomain.com>`) and redeploy. If you don't have a domain, this stays as it is — for a demo where you are the only pilot, it costs nothing.
- [ ] **F29 Cancel / Re-run job controls** (optional). Job controls on the admin system page, deferred earlier because Cancel and Re-run needed design decisions. The QR retry already exists as its own button, so leave these out unless you want them for the pitch.
- [ ] **Look at an email in Gmail too.** It was seen once, in Outlook (Arabic direction and layout were correct). Gmail handles Arabic direction and inline styles differently.
- [ ] **Port 3000 and port 3100 are taken by other apps on this machine.** Worth knowing why a URL sometimes answers with something that isn't this project.

---

## 4. Carrying on with

- [ ] **A repo gate for the QR check.** `scripts/verify/qr.mts` reads local files only, so it can't check production. Add a Blob mode so the byte-compare of the real stickers against a fresh render at `APP_URL` is repeatable, not a one-off.
- [ ] **The QR code: time "Try again".** The retry action wasn't re-timed after the region fix. It needs your pilot account (`alshar55@hotmail.com`) and a drone with no QR.
- [x] **A pitch pass** (2026-09-20). English copy, docs, legal pages, structured data and every map surface checked against the honesty rules in `CLAUDE.md`; four fixes made. What is left of it is the full Arabic read in section 1, which needs an Arabic reader.
- [ ] **A stray copy of the repo at `.kilo/worktrees/level-porcupine/`** makes `pnpm lint` fail (82 errors, none in our code). It is untracked and not ours. Decide whether to delete it or have ESLint ignore `.kilo/`.

---

## Not on this list, because they're mine

Tests, migrations, the build log. Ask and I'll pick any of them up.
