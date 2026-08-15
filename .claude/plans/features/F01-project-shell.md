# F01 — Project Shell & Tooling

**Wave:** 0 · **Depends on:** nothing · **Skill reference:** `references/stack.md`

## Purpose

Create the Next.js project everything else builds on, in its own git repository, with the lint rules that enforce this project's two hardest conventions (RTL logical properties, Latin-numeral Gregorian dates) in place *before* any UI exists.

## Technical design

### Git first

`drone-2-demo` has no repository of its own — it sits inside the `C:\Users\alsha` home repo. Before anything else:

```bash
git init                       # in C:\Users\alsha\Desktop\drone-2-demo
printf 'drone-2-demo/\n' >> C:/Users/alsha/.gitignore
```

Verify with `git rev-parse --show-toplevel` — it must print the project directory, not the home directory.

### Version research (skill Step 2)

> **What actually happened (F01):** versions were established inline from the npm registry rather than by sub-agents — the session's operating rules forbid dispatching agents unasked. The versions are recorded in `BUILD-LOG.md`. **The per-branch API/deprecation sweep below did not happen.** Each later wave must check its own package's current docs before writing against it.

Before installing anything, dispatch parallel research subagents — one per chosen branch (base, database, auth, email, storage, jobs, pages, SEO). Each establishes the **current stable** release, anything deprecated or renamed within the last two majors, current import paths and signatures, and any new capability that would replace hand-written code in the corresponding reference file. **No version number is ever written into a config, an install command, or a Docker tag.**

Reconciliation rule: on API detail (names, signatures, flags) the research wins; on how pieces fit together the skill's reference file wins. Anything the research contradicted is recorded for the hand-off.

### Scaffold

```bash
npx create-next-app@latest scaffold-tmp --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --disable-git
npm pkg set name=ajniha
pnpm dlx shadcn@latest init -d
pnpm dlx shadcn@latest add button card input label badge
```

The project ends up **in the current working directory** — never a subfolder, no `cd` afterwards. `create-next-app` refuses a non-empty directory, so it scaffolds into `scaffold-tmp` and the result is moved up, resolving collisions deliberately. Two corrections from the build (F01):

- The temp directory cannot be `.scaffold-tmp` — npm rejects a package name starting with a period.
- There is no `--turbopack` flag: Turbopack is the default bundler in this Next.js, and `--rspack` is the opt-out.

**Collision:** the scaffold writes its own `CLAUDE.md` (containing only `@AGENTS.md`) and an `AGENTS.md`. Delete the scaffold's `CLAUDE.md` — the project's own must survive — and keep `AGENTS.md`, which `next dev` rewrites on every run anyway. The project `CLAUDE.md` ends with `@AGENTS.md` to pull it in.

### Layout

```
src/
├── app/           # routes
├── components/    # shared React components (shadcn lands in components/ui)
└── lib/           # db, auth, airspace, actions, data, utilities
```

### Scripts

```json
"dev": "next dev",
"build": "next build",
"typecheck": "next typegen && tsc --noEmit",
"test": "vitest run --passWithNoTests"
```

- `dev` needs no `--turbopack`; it is the default.
- `typecheck` must run `next typegen` first. Next generates the global `LayoutProps`/`PageProps` types into `.next/types`, and on a clean tree bare `tsc --noEmit` fails with `TS2304: Cannot find name 'LayoutProps'` in `src/app/layout.tsx`. **Run `pnpm typecheck`, not `pnpm exec tsc --noEmit`.**
- `--passWithNoTests` exists only so Wave 0 can be green with no tests. Remove it when [F10](./F10-remote-id-issuance.md) adds the first one.

`db:*` scripts arrive in [F03](./F03-database-schema.md); `build` gains its `db:migrate` prefix there.

### ESLint rules (the two that matter)

Added now, so they can never be retrofitted across a finished UI.

**Rule 1 — logical properties only.** Ban `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `border-l`, `border-r`, `rounded-l`, `rounded-r` in class strings — in `className` attributes **and inside `cva()` / `cn()` / `clsx()` / `twMerge()` calls**, which is where shadcn keeps its own. Restricting it to the attribute let `button.tsx` and `badge.tsx` ship physical padding unflagged; both were corrected to `pe-`/`ps-` in F01. Message points at the `ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`/`text-start`/`text-end` equivalents. `rounded-lg` and `border-e` must not trip it — the `l`/`r` is matched only at the end of a token.

**Rule 2 — no bare locale formatting.** `no-restricted-syntax` banning `CallExpression[callee.property.name=/^toLocale(Date|Time|)String$/]` and bare `new Intl.DateTimeFormat(` / `new Intl.NumberFormat(` outside `src/lib/format.ts`. Without this, a single `toLocaleDateString('ar')` call emits a Hijri date with Arabic-Indic digits and nobody notices until a GACA reviewer does.

**Rule 3 — airspace purity.** `no-restricted-imports` on `src/lib/airspace/**` (except `query.ts`) banning `@/lib/db`, `server-only`, `next-intl`, and `react`. Placed now; enforced from [F12](./F12-airspace-engine.md).

### Environment

Create `.env` (empty is fine) and `.env.example` (committed). Confirm `.env*` except `.env.example` is gitignored.

### Testing

```bash
pnpm add -D vitest
```

Config with a `node` environment. Only the domain core is unit-tested — geometry, slots, codec, workflow. No component tests.

## Files

```
.gitignore                     (verify .env* ignored, add data/ later)
package.json                   (name, scripts)
eslint.config.mjs              (the three rules above)
vitest.config.ts
.env  .env.example
src/app/layout.tsx             (scaffold default; F02 rewrites it)
```

## Acceptance criteria

- [x] `git rev-parse --show-toplevel` prints the project directory, not `C:/Users/alsha`.
- [x] `drone-2-demo/` appears in the parent repo's `.gitignore` — which had to be **created**; the home repo had none.
- [x] `package.json` sits at the project root — there is **no nested project folder**.
- [x] `pnpm dev` starts clean and the page renders — **`HTTP 200` on port 3001**, not 3000: another app on this machine already holds 3000, so Next fell through.
- [x] A shadcn `Button` imported into a page renders styled (verified in the served HTML, not in a browser).
- [x] `pnpm lint` **fails** on a deliberate test file containing `className="ml-4"`, and passes once changed to `ms-4`.
- [x] `pnpm lint` **fails** on a deliberate `new Date().toLocaleDateString('ar')` outside `src/lib/format.ts`, and passes inside it.
- [x] Typecheck passes — via `pnpm typecheck`. Bare `pnpm exec tsc --noEmit` fails on a clean tree until `next typegen` has run; see Scripts.
- [x] `pnpm test` runs (zero tests, exit 0 via `--passWithNoTests`).
- [x] No version number appears anywhere beyond what pnpm wrote into `package.json`. No `docker-compose.yml` yet (F03).
- [x] `.env` is gitignored; `.env.example` is committed (`.gitignore` needed `!.env.example` — the scaffold's `.env*` covered it).
