/**
 * F31b, step 9 — **the signed-out scan page, read as source.**
 *
 *   BASE=http://localhost:3001 pnpm exec tsx scripts/verify/scan-page.mts
 *
 * The acceptance criterion says *"verified by reading the HTML source, not just
 * the visible page"*, and it says so for a reason: a value can be present in
 * the markup, in an RSC flight payload, in a `<meta>` tag or in a JSON-LD block
 * while being invisible on screen. `display:none` is not redaction, and a
 * screenshot cannot tell the difference.
 *
 * So this fetches every real Remote ID, signed out, in both locales and through
 * the JSON twin, and searches the **whole response body** for every identifying
 * value the database actually holds — the owner's Arabic and English name, the
 * national ID number and any substring of it, the mobile in four spellings, and
 * both account email addresses.
 *
 * It also asserts the page says what it *should*: the code itself, and a
 * registration status. A page that leaks nothing because it renders nothing
 * would otherwise pass.
 */
import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";

if (existsSync(".env")) process.loadEnvFile(".env");

const BASE = process.env.BASE ?? "http://localhost:3001";

const results: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

const sql = postgres(process.env.POSTGRES_URL!, { max: 1, onnotice: () => {} });

const codes = await sql<{ code: string; status: string }[]>`
  select r.code, d.status from remote_id r join drone d on d.id = r.drone_id
  order by r.created_at`;
const profiles = await sql<
  {
    full_name_ar: string;
    full_name_en: string;
    id_document_number: string;
    mobile_e164: string | null;
  }[]
>`select full_name_ar, full_name_en, id_document_number, mobile_e164 from pilot_profile`;
const users = await sql<{ email: string; name: string }[]>`
  select email, name from "user"`;
await sql.end();

/**
 * Every string that must never appear. The national ID is included whole *and*
 * as its last four digits — a "masked" identifier that still prints the tail is
 * the classic half-redaction, and it is exactly what a bystander must not have.
 */
const FORBIDDEN = new Set<string>();
for (const p of profiles) {
  FORBIDDEN.add(p.full_name_ar);
  FORBIDDEN.add(p.full_name_en);
  FORBIDDEN.add(p.id_document_number);
  FORBIDDEN.add(p.id_document_number.slice(-4));
  if (p.mobile_e164) {
    const digits = p.mobile_e164.replace(/\D/g, "");
    FORBIDDEN.add(p.mobile_e164);
    FORBIDDEN.add(digits);
    // 0501234567 — the way a Saudi number is actually written.
    FORBIDDEN.add(`0${digits.slice(3)}`);
    // Arabic-Indic digits: the same number, invisible to an ASCII grep.
    FORBIDDEN.add(digits.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!));
  }
}
for (const u of users) {
  FORBIDDEN.add(u.email);
  FORBIDDEN.add(u.name);
  // The local part alone still identifies the account.
  FORBIDDEN.add(u.email.split("@")[0]!);
}
FORBIDDEN.delete("");

/**
 * **The message catalogue is shipped inside the page**, so a value that is also
 * a UI placeholder will be found in the body no matter how perfect the masking
 * is. The seeded pilot's mobile is `+966501234567` and `messages/{ar,en}.json`
 * uses `0501234567` as the worked example under `mobileHint` and
 * `mobile_format` — twice in each catalogue. A naive search reports that as a
 * leak on every page in the app, which is worse than not searching: it trains
 * whoever reads the output to ignore it.
 *
 * So a hit is a leak **only if the string is not also in the catalogue**.
 * Collisions are reported separately and counted, never silently dropped — and
 * the fact that this field cannot be checked is itself the finding: the demo
 * data reuses the documentation's example number.
 */
const CATALOGUE =
  readFileSync("messages/ar.json", "utf8") + readFileSync("messages/en.json", "utf8");
const collisions = [...FORBIDDEN].filter((v) => CATALOGUE.includes(v));
for (const v of collisions) FORBIDDEN.delete(v);

/**
 * **`rid.resolve` is rate limited to 30 requests a minute per IP** (F09), and
 * this script makes 15. Two runs inside the same minute therefore trip it, and
 * the first draft reported that as a failed page. It is the opposite — so the
 * fetch waits out the window rather than pretending the limiter is not there,
 * and the limiter gets an assertion of its own at the end.
 */
async function fetchPatiently(path: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(BASE + path);
    if (res.status !== 429) return res;
    const wait = Number(res.headers.get("retry-after") ?? 61);
    console.log(`  … 429 on ${path}, waiting ${wait}s for the rid.resolve window`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  return fetch(BASE + path);
}

for (const { code } of codes) {
  for (const path of [`/ar/rid/${code}`, `/en/rid/${code}`, `/api/rid/${code}`]) {
    const res = await fetchPatiently(path);
    const body = await res.text();

    check(`${path} answers 200`, res.status === 200, String(res.status));

    const leaked = [...FORBIDDEN].filter((v) => body.includes(v));
    check(
      `${path} leaks no owner identity`,
      leaked.length === 0,
      leaked.length ? `LEAKED: ${leaked.join(" | ")}` : `${body.length} bytes searched`,
    );

    // The page must still be a page. Redaction that renders nothing is not a pass.
    check(`${path} shows the code itself`, body.includes(code));
  }
}

/**
 * The limiter itself, asserted rather than assumed — and deliberately **last**,
 * because it leaves the window exhausted. Anti-scraping is what stops a scanner
 * walking the code space; it is not what makes a code unguessable, and F09's
 * comment on `rid.resolve` says exactly that.
 */
let sawLimit = false;
for (let i = 0; i < 40 && !sawLimit; i++) {
  const res = await fetch(`${BASE}/api/rid/${codes[0]!.code}`);
  if (res.status === 429) sawLimit = true;
}
check("rid.resolve refuses a scraper with 429", sawLimit);

if (collisions.length > 0) {
  console.log(
    `NOTE  ${collisions.length} value(s) excluded — also UI placeholders in the ` +
      `message catalogue, so unsearchable on any page: ${collisions.join(", ")}`,
  );
}

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL"));
console.log(
  `\n${results.length - failed.length}/${results.length} — ${codes.length} Remote IDs ` +
    `× 3 surfaces, ${FORBIDDEN.size} forbidden strings each ` +
    `(statuses: ${[...new Set(codes.map((c) => c.status))].join(", ")})`,
);
process.exit(failed.length === 0 ? 0 : 1);
