# F05 — Authentication, Roles & Access Control

**Wave:** 3 · **Depends on:** [F03](./F03-database-schema.md) · **Skill reference:** `references/auth.md`, `references/settings.md`

## Purpose

Real accounts with three roles, and one place where "is this person allowed to see this?" is answered. This replaces v1's persona-switcher entirely.

## Technical design

### Better Auth config — `src/lib/auth.ts`

```ts
database: drizzleAdapter(db, { provider: "pg" }),
emailAndPassword: { enabled: true },
user: {
  additionalFields: {
    role: { type: ["pilot","reviewer","admin"], defaultValue: "pilot", input: false },
    preferredLocale: { type: ["ar","en"], defaultValue: "ar", input: true },
  },
  changeEmail: { enabled: true },
  deleteUser: { enabled: true },
},
```

**`input: false` on `role` is the security control, not a formality.** Without it, role is an ordinary profile field and any user can PATCH themselves to `admin` through the normal update call.

### Why role lives on `user` but PII does not

- `role` must be readable on **every** request without a join — it gates the middleware redirect, three layout guards, and every server action. `additionalFields` puts it in the session payload.
- National ID / Iqama must **not** be an `additionalField`, because those values are returned by `getSession` and therefore serialised into client components — the ID would reach the browser on every page render. It lives in `pilot_profile` ([F17](./F17-pilot-profile.md)).
- `pilot_profile` is nullable-by-existence, which is exactly the state the registration wizard needs to represent: an account can exist before the profile is complete, and `pilot_profile_incomplete` is a real refusal reason in [F12](./F12-airspace-engine.md).

**Consequence:** `role` and `preferredLocale` become `text` columns inside the generated `auth-schema.ts`, not `pgEnum`s. That file is left exactly as generated.

### Schema generation order (easy to get wrong)

```bash
pnpm dlx @better-auth/cli@latest generate --config src/lib/auth.ts --output src/lib/db/auth-schema.ts -y
pnpm db:generate      # turns those table definitions into SQL
pnpm db:migrate
```

Two different "generate" steps. Re-run **all three** any time `src/lib/auth.ts` changes — which [F06](./F06-transactional-email.md) and [F09](./F09-rate-limiting.md) both do.

### First account becomes admin

A `databaseHooks.user.create.before` hook counts existing users; row count `0` → `admin`, everyone after → `pilot`.

> Two accounts created in the same instant could both come out admin. Not worth solving for a single-owner app; the fix if ever needed is a unique partial index.

**Critical for [F31](./F31-verification-gate.md):** the *user* signs up first. A probe account created and then deleted during verification would take the admin slot and lock them out of their own system page.

### The three roles

| Role | Can |
|---|---|
| `pilot` | Own profile, own drones, own bookings. Nothing else. |
| `reviewer` | All of the above, plus the review queues, approve/reject drones and bookings, Remote ID lookup, and identity reveal. |
| `admin` | All of the above, plus zone and closure management, city creation, role assignment, revoke/reinstate drones, and the audit browser. |

Role changes are made by an admin via `setUserRole`, which writes an audit event. There is no self-service escalation path.

### Guards — `src/lib/auth-guards.ts`

```ts
requireUser()          → Session          | redirect to sign-in
requirePilotProfile()  → Session+Profile  | redirect to /profile/complete
requireReviewer()      → Session          | notFound()
requireAdmin()         → Session          | notFound()
```

**`notFound()` rather than throw** on the admin boundary: a non-admin who guesses `/admin` gets a 404, not a 500 with a stack trace revealing the route exists.

Guards are called in each route group's `layout.tsx` **and again inside every server action**. A layout guard does not protect an action — server actions are ordinary POSTs reachable directly.

### Middleware — `src/middleware.ts`

Composes next-intl's middleware with an **optimistic** cookie check (`getSessionCookie` from `better-auth/cookies`) redirecting unauthenticated requests for `(app)` and `(admin)` paths to `/[locale]/sign-in`.

**This is a UX optimisation, never the boundary.** It never reads the role, never hits the database, and is explicitly documented as bypassable. Matcher excludes `/api`, `/_next`, and static files.

### Ownership — `src/lib/data/*.ts`

```ts
getDroneForViewer(session, droneId)
  → row if ownerUserId === session.user.id
  → row if role is reviewer | admin
  → null  (caller calls notFound())
```

A page never writes its own `where` clause. Same pattern for bookings, profiles, and notifications.

### Pages

`/[locale]/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email` — bilingual, RTL, shadcn form components, Arabic copy authored first. Sign-up collects name, email, password and sets `preferredLocale` from the active locale.

Email verification and password reset are **wired but inert** until [F06](./F06-transactional-email.md) provides somewhere to send from. That's deliberate, not an omission.

## Files

```
src/lib/auth.ts
src/lib/auth-client.ts
src/lib/auth-guards.ts
src/lib/db/auth-schema.ts            (CLI-generated, never edited)
src/middleware.ts                    (composes next-intl + optimistic redirect)
src/app/api/auth/[...all]/route.ts
src/app/[locale]/(public)/(auth)/{sign-in,sign-up,forgot-password,reset-password,verify-email}/page.tsx
src/app/[locale]/(app)/layout.tsx    requireUser()
src/app/[locale]/(admin)/layout.tsx  requireReviewer()
src/lib/data/*.ts
```

## Acceptance criteria

- [ ] Sign up with email + password succeeds and lands signed in; the row is visible in `pnpm db:studio`.
- [ ] Sign out, then sign back in with the same credentials.
- [ ] **The first account created has `role = 'admin'`; the second has `role = 'pilot'`.**
- [ ] A pilot calling the user-update endpoint with `{ role: "admin" }` does **not** change their role (this is the `input: false` test — run it explicitly).
- [ ] Signed out, `/ar/dashboard` redirects to `/ar/sign-in`.
- [ ] A signed-in pilot visiting `/ar/admin` gets **404**, not 403 and not a stack trace.
- [ ] A pilot calling a `requireReviewer` server action directly (bypassing the UI) is rejected — the layout guard is not the only check.
- [ ] Pilot B opening pilot A's drone by URL gets 404.
- [ ] `auth-schema.ts` is byte-identical to CLI output; `role` and `preferredLocale` are `text` columns.
- [ ] Every non-auth table's user-referencing column is `text` and its foreign key exists.
- [ ] Auth pages render correctly in Arabic RTL at 375 px, in light and dark mode.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
