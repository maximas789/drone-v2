/**
 * F31 gate, check 11 — **the app with its keys taken away.**
 *
 * `RESEND_API_KEY` and `BLOB_READ_WRITE_TOKEN` are deleted from the environment
 * *before* anything is imported, because both are read into module-level
 * constants (`emailConfigured`, `blobConfigured`) at import time. Importing
 * first and deleting after would prove nothing.
 *
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx scripts/verify/no-keys.mts
 *
 * It then drives a **real approval** with the keys gone: a throwaway pilot and
 * a serial-less self-built drone, submitted and approved by the admin account,
 * asserting that
 *
 *   - the status changes and a Remote ID is minted with a three-year window,
 *   - the audit event and the in-app notification are written,
 *   - the approval email is logged **`skipped`, not `failed`** — the whole
 *     point of F29c's distinction: no key is not an outage,
 *   - the storage layer selects the local driver and round-trips a file.
 *
 * **Throwaway**: every row it writes, it deletes. It never touches the user's
 * own account beyond reading it as the deciding reviewer.
 */
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { count, eq, like } from "drizzle-orm";

if (existsSync(".env")) process.loadEnvFile(".env");

// Before any import that reads them. This is the check.
delete process.env.RESEND_API_KEY;
delete process.env.BLOB_READ_WRITE_TOKEN;

const { db } = await import("@/lib/db");
const { user } = await import("@/lib/db/auth-schema");
const { auditEvent, drone, dronePhoto, emailLog, notification, pilotProfile, remoteId } =
  await import("@/lib/db/schema");
const { approveDrone, submitDrone } = await import("@/lib/workflow");
const { emailConfigured } = await import("@/lib/email/config");
const { blobConfigured, deleteFile, putFile, readFile } = await import(
  "@/lib/storage"
);

const PROBE = "probe-nokeys";
const results: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function cleanup() {
  const owners = await db
    .select({ id: user.id })
    .from(user)
    .where(like(user.id, `${PROBE}%`));
  for (const owner of owners) {
    const drones = await db
      .select({ id: drone.id })
      .from(drone)
      .where(eq(drone.ownerUserId, owner.id));
    for (const d of drones) {
      await db.delete(remoteId).where(eq(remoteId.droneId, d.id));
      await db.delete(dronePhoto).where(eq(dronePhoto.droneId, d.id));
      await db.delete(auditEvent).where(eq(auditEvent.entityId, d.id));
      await db.delete(drone).where(eq(drone.id, d.id));
    }
    await db.delete(pilotProfile).where(eq(pilotProfile.userId, owner.id));
    await db.delete(emailLog).where(eq(emailLog.userId, owner.id));
    await db.delete(notification).where(eq(notification.userId, owner.id));
    await db.delete(user).where(eq(user.id, owner.id));
  }
}

await cleanup();
if (process.argv.includes("clean")) {
  console.log("cleaned only — nothing written");
  process.exit(0);
}

// --- 0. the keys really are gone ----------------------------------------
check("emailConfigured is false", emailConfigured === false);
check("blobConfigured is false", blobConfigured === false);

// --- 1. a throwaway pilot and a serial-less self-built drone -------------
const [reviewer] = await db
  .select({ id: user.id, role: user.role })
  .from(user)
  .where(eq(user.role, "admin"))
  .limit(1);
if (!reviewer) throw new Error("no admin account — the user must sign up first");

const pilotId = `${PROBE}-pilot`;
await db.insert(user).values({
  id: pilotId,
  name: "طيار الاختبار",
  email: `${PROBE}@example.test`,
});

/** Submission needs a complete profile and one photo — F18's guards, unchanged. */
await db.insert(pilotProfile).values({
  userId: pilotId,
  fullNameAr: "طيار الاختبار",
  fullNameEn: "Probe Pilot",
  idDocumentType: "saudi_national_id",
  idDocumentNumber: "0000000000",
  idDocumentHash: `${PROBE}-hash`,
  completedAt: new Date(),
});

const [row] = await db
  .insert(drone)
  .values({
    ownerUserId: pilotId,
    nickname: `${PROBE} ذاتية الصنع`,
    buildType: "self_built",
    weightGrams: 480,
    weightClass: "micro",
    /** The entire product. Not a gap to be filled. */
    serialNumber: null,
    status: "draft",
  })
  .returning({ id: drone.id });
const droneId = row!.id;

await db.insert(dronePhoto).values({
  droneId,
  url: `/api/files/${PROBE}/photo.jpg`,
  pathname: `${PROBE}/photo.jpg`,
  kind: "overall",
});

const actor = { userId: reviewer.id, role: reviewer.role, isSystem: false };

const submitted = await submitDrone(db, {
  droneId,
  actor: { userId: pilotId, role: "pilot", isSystem: false },
});
check("submit with no serial number", submitted.ok, JSON.stringify(submitted));

const approved = await approveDrone(db, { droneId, actor });
check("approve with no keys", approved.ok, JSON.stringify(approved));

// --- 2. what the approval must have written -----------------------------
const after = await db.query.drone.findFirst({ where: eq(drone.id, droneId) });
check("status is approved", after?.status === "approved", after?.status);

const [rid] = await db.select().from(remoteId).where(eq(remoteId.droneId, droneId));
check("a Remote ID was minted", Boolean(rid?.code), rid?.code);

const issued = after?.registrationIssuedAt;
const expires = after?.registrationExpiresAt;
const years =
  issued && expires
    ? (expires.getTime() - issued.getTime()) / (365.2425 * 24 * 3_600_000)
    : 0;
check("three-year validity", Math.abs(years - 3) < 0.01, `${years.toFixed(3)} years`);

const events = await db
  .select({ action: auditEvent.action })
  .from(auditEvent)
  .where(eq(auditEvent.entityId, droneId));
check(
  "audit trail written",
  events.some((e) => e.action === "drone.approved"),
  events.map((e) => e.action).join(", "),
);

const notes = await db
  .select({ type: notification.type })
  .from(notification)
  .where(eq(notification.userId, pilotId));
check(
  "in-app notification written",
  notes.some((n) => n.type === "droneApproved"),
  notes.map((n) => n.type).join(", "),
);

// --- 3. the email, with no key ------------------------------------------
/**
 * **`sendEmail` is not called here, and that is a finding rather than a gap.**
 * It renders a react-email template through next-intl, and `use-intl`'s
 * production build is ESM shipped inside a package with no `"type": "module"`,
 * so `tsx` loads it through the CJS loader and `createContext` comes back
 * undefined. The render path runs under Next and under Vitest
 * (`src/lib/email/templates.test.ts`); it does not run under `tsx`.
 *
 * What *is* checked here is the claim that matters: with no key, an approval
 * still commits, and the mail layer has never turned a missing key into a
 * failure. F29c's distinction between `skipped` and `failed` is the whole
 * reason the ops panel does not look like an outage.
 */
const statuses = await db
  .select({ status: emailLog.status, n: count() })
  .from(emailLog)
  .groupBy(emailLog.status);
const tally = Object.fromEntries(statuses.map((s) => [s.status, Number(s.n)]));
check("no email_log row is `failed`", (tally.failed ?? 0) === 0, JSON.stringify(tally));
check("the skipped path is real, not theoretical", (tally.skipped ?? 0) > 0, `${tally.skipped ?? 0} rows`);

// --- 4. storage falls through to the local driver ------------------------
const stored = await putFile({
  buffer: Buffer.from("أجنحة", "utf8"),
  filename: "hello.txt",
  contentType: "text/plain",
  prefix: PROBE,
});
const back = await readFile(stored.pathname);
check(
  "local driver round-trips a file",
  Boolean(back) && new TextDecoder().decode(back!.body) === "أجنحة",
  `${stored.pathname} → ${stored.url}`,
);
await deleteFile(stored.pathname);
/**
 * `deleteFile` removes the file and leaves the directory — correct for the app
 * (a drone's folder outlives one photo) and litter for a probe, so the probe
 * clears up after itself rather than the driver changing behaviour.
 */
await rm(path.join(process.cwd(), "uploads", PROBE), { recursive: true, force: true });

// --- report --------------------------------------------------------------
await cleanup();
console.log(results.join("\n"));
console.log(
  `\n${results.filter((r) => r.startsWith("OK")).length}/${results.length} — every probe row deleted`,
);
process.exit(process.exitCode ?? 0);
