/**
 * F31 gate, checks 9 and part of 10 — **every route answers, against a
 * production serve.**
 *
 * Run it against `pnpm start`, never `pnpm dev`: a dev-mode 404 embeds a stack
 * trace naming the guard in its RSC payload and the production build does not,
 * so the "404, not a stack trace" assertion is only meaningful here
 * (BUILD-LOG thread 16).
 *
 *   BASE=http://localhost:3001 pnpm exec tsx scripts/verify/routes.mts
 *
 * Three passes, none of which needs a password:
 *
 * 1. **Public**, signed out — every page in `PUBLIC_PAGES`, in both locales,
 *    must return 200. The list is the same one the sitemap reads, so a page
 *    that exists is a page that is checked.
 * 2. **Protected**, signed out — must redirect to sign-in, never render.
 * 3. **Protected, with a fabricated session cookie** — the proxy is not the
 *    security boundary (`src/proxy.ts` says so in its own comment), so a junk
 *    cookie gets past it and lands on the layout guard. Admin routes must
 *    answer **404**, and the body must carry no stack trace, no absolute path
 *    and no guard name. This is the half a browser session cannot check,
 *    because a browser session is authorised.
 *
 * The `[id]` routes are filled from the live database rather than hard-coded,
 * so this script keeps working after a reseed.
 */
import { existsSync } from "node:fs";
import postgres from "postgres";
import { PUBLIC_PAGES, localePath } from "@/lib/site/pages";
import { LOCALES } from "@/lib/locale";

if (existsSync(".env")) process.loadEnvFile(".env");

const BASE = process.env.BASE ?? "http://localhost:3001";

type Expect = "ok" | "signin" | "notFound" | "refused";

type Check = { path: string; expect: Expect; cookie?: boolean };

const results: { path: string; expect: Expect; got: string; pass: boolean; note?: string }[] = [];

/** A cookie shaped like Better Auth's but signed with nothing. */
const JUNK_COOKIE = "better-auth.session_token=notatoken.notasignature";

/** Words a 404 must never leak. Guard names, and the repo's own path. */
const LEAKS = [
  "requireAdmin",
  "requireReviewer",
  "requireUser",
  "auth-guards",
  "drone-2-demo",
  "at async",
  "webpack-internal",
];

async function check({ path, expect, cookie }: Check) {
  const res = await fetch(BASE + path, {
    redirect: "manual",
    headers: cookie ? { cookie: JUNK_COOKIE } : {},
  });
  const status = res.status;
  const location = res.headers.get("location") ?? "";
  let pass = false;
  let note: string | undefined;

  if (expect === "ok") {
    pass = status === 200;
  } else if (expect === "refused") {
    // A refusal is a machine-readable body, not an exception (CLAUDE.md rule 10).
    const body = await res.text();
    pass = status === 400 && body.includes("invalid_bbox");
    note = body.slice(0, 80);
  } else if (expect === "signin") {
    pass = (status === 307 || status === 302) && /\/sign-in/.test(location);
    note = location || undefined;
  } else {
    pass = status === 404;
    if (pass) {
      const body = await res.text();
      const leaked = LEAKS.filter((w) => body.includes(w));
      if (leaked.length > 0) {
        pass = false;
        note = `leaked: ${leaked.join(", ")}`;
      }
    }
  }

  results.push({ path, expect, got: `${status}${location ? ` → ${location}` : ""}`, pass, note });
}

// ---------------------------------------------------------------- sample ids

const sql = postgres(process.env.POSTGRES_URL!, { max: 1, onnotice: () => {} });
const one = async (q: Promise<{ id: string }[]>) => (await q)[0]?.id;
const droneId = await one(sql`select id from drone limit 1`);
const bookingId = await one(sql`select id from booking limit 1`);
const zoneId = await one(sql`select id from zone limit 1`);
const pilotId = await one(sql`select user_id as id from pilot_profile limit 1`);
const ridCode = await one(sql`select code as id from remote_id limit 1`);
/** A real stored file, to prove `/api/files` is not an open bucket. */
const photoPath = await one(sql`select pathname as id from drone_photo limit 1`);
await sql.end();

for (const [name, value] of Object.entries({ droneId, bookingId, zoneId, pilotId, ridCode })) {
  if (!value) throw new Error(`no ${name} in the database — reseed before running the sweep`);
}

// -------------------------------------------------------------- the routes

/** Signed out, these render for anybody. Not in PUBLIC_PAGES: they are noindex. */
const OPEN_EXTRAS = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  `/rid/${ridCode}`,
];

/** Behind a sign-in. Everything here redirects when signed out. */
const PILOT_ROUTES = [
  "/dashboard",
  "/drones",
  "/drones/new",
  `/drones/${droneId}`,
  `/drones/${droneId}/edit`,
  `/drones/${droneId}/remote-id`,
  `/drones/${droneId}/remote-id/print`,
  "/bookings",
  "/bookings/new",
  `/bookings/${bookingId}`,
  "/notifications",
  "/profile/complete",
  "/settings",
  "/settings/profile",
  "/settings/account",
  "/settings/language",
  "/settings/notifications",
  "/settings/security",
];

/** Reviewer or admin only. A fabricated cookie must get a 404 from each. */
const ADMIN_ROUTES = [
  "/admin",
  "/admin/analytics",
  "/admin/audit",
  "/admin/bookings",
  `/admin/bookings/${bookingId}`,
  "/admin/cities",
  `/admin/drones/${droneId}`,
  "/admin/lookup",
  "/admin/pilots",
  `/admin/pilots/${pilotId}`,
  "/admin/reveals",
  "/admin/zones",
  "/admin/zones/new",
  `/admin/zones/${zoneId}`,
  `/admin/zones/${zoneId}/closures`,
  "/settings/system",
];

const checks: Check[] = [];

for (const locale of LOCALES) {
  for (const page of PUBLIC_PAGES) {
    checks.push({ path: localePath(page.path, locale), expect: "ok" });
  }
  for (const path of OPEN_EXTRAS) {
    checks.push({ path: `/${locale}${path}`, expect: "ok" });
  }
}

// Non-localised, and each one a route the plan names. The GeoJSON endpoint
// needs a viewport — a bbox over Riyadh, in `[lng, lat]` order.
for (const path of [
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  "/api/zones/geojson?bbox=46.3,24.4,47.1,25.1",
  `/api/rid/${ridCode}`,
]) {
  checks.push({ path, expect: "ok" });
}

// Both locales for the redirect pass — the `next` param is locale-stripped, and
// that is exactly the sort of thing that works in one locale and not the other.
for (const locale of LOCALES) {
  for (const path of [...PILOT_ROUTES, ...ADMIN_ROUTES]) {
    checks.push({ path: `/${locale}${path}`, expect: "signin" });
  }
}

/**
 * The email preview renders every transactional template with sample data. It
 * is not secret and it is not a boundary — it simply must not exist in
 * production, and it prerenders as a 404 there rather than being conditionally
 * hidden. Checked in both locales because it is the SSG pair, not one page.
 */
for (const locale of LOCALES) {
  checks.push({ path: `/${locale}/dev/emails`, expect: "notFound" });
}

/**
 * **`/api/files` is the ownership check both storage drivers share.** Signed
 * out, a real photograph's own pathname must not come back — otherwise the
 * URL is the credential, which is exactly what F07 refused to ship.
 */
if (photoPath) {
  checks.push({ path: `/api/files/${photoPath}`, expect: "notFound" });
}

// The map endpoint's own refusal, for the same reason: a 500 here would be a
// crash, and a 200 would be a lie about what was asked for.
checks.push({ path: "/api/zones/geojson", expect: "refused" });

// The guard, reached past the proxy. Arabic only — the guard is locale-blind
// and 62 more 404 fetches would say nothing new.
// `/settings/system` is **not** in this pass. It sits under the `(app)` group,
// whose layout runs `requireUser` before the admin-only filter, so a junk
// cookie is simply "signed out" there and is sent to sign-in — correct, and a
// different assertion. The criterion that a *reviewer* gets 404 on it needs a
// real reviewer session, which needs a password: BUILD-LOG thread 64.
for (const path of ADMIN_ROUTES.filter((p) => p.startsWith("/admin"))) {
  checks.push({ path: `/ar${path}`, expect: "notFound", cookie: true });
}

for (const c of checks) await check(c);

// ------------------------------------------------------------------ report

const failed = results.filter((r) => !r.pass);
for (const r of failed) {
  console.log(`FAIL  ${r.path}  expected ${r.expect}, got ${r.got}${r.note ? ` (${r.note})` : ""}`);
}

const by = (e: Expect) => results.filter((r) => r.expect === e);
console.log(
  [
    `public 200      ${by("ok").filter((r) => r.pass).length}/${by("ok").length}`,
    `→ sign-in       ${by("signin").filter((r) => r.pass).length}/${by("signin").length}`,
    `404, no trace   ${by("notFound").filter((r) => r.pass).length}/${by("notFound").length}`,
    `refused cleanly ${by("refused").filter((r) => r.pass).length}/${by("refused").length}`,
    `TOTAL           ${results.length - failed.length}/${results.length}`,
  ].join("\n"),
);

process.exit(failed.length === 0 ? 0 : 1);
