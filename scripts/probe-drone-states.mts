/**
 * F18b probe. **Throwaway** — every row it writes, it deletes.
 *
 * One job: put one drone of the owner's own into each of the six statuses, so
 * that all six of F18b's screens can actually be **opened in a browser**. Three
 * of them — `approved`, `expired`, `revoked` — are otherwise unreachable: they
 * need an approval, and approving needs F22's reviewer queue, which does not
 * exist. Open thread 11 says nothing in `lint`, `typecheck`, `build` or the test
 * suite catches a rendering defect, and every UI session in this build has found
 * one by opening the page. Three screens shipped unopened would be three more.
 *
 * **The rows are written with plain inserts and updates, not through
 * `src/lib/workflow/`.** Decided with the user up front. F14 already proved every
 * drone edge 34/34 against the live database, including approval issuing a
 * Remote ID and renewal keeping the code — so what these rows are for is
 * *rendering*, and re-driving the transitions would prove nothing F14 has not.
 * The cost, recorded honestly: these six drones have **no audit events**, and
 * their `registrationExpiresAt` is set here rather than computed by
 * `registrationExpiryFrom`. Neither is read by any screen F18b renders. Nothing
 * in the app writes a status this way — this file is not a template.
 *
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx scripts/probe-drone-states.mts        seed
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx scripts/probe-drone-states.mts clean  delete everything
 */
import { existsSync } from "node:fs";
import { inArray, like } from "drizzle-orm";

if (existsSync(".env")) process.loadEnvFile(".env");

const { db } = await import("@/lib/db");
const schema = await import("@/lib/db/schema");
const { deleteFile } = await import("@/lib/storage");

const { drone, dronePhoto, remoteId } = schema;

/**
 * Every seeded row's nickname starts with this, and the teardown deletes on it.
 * A marker in the data rather than a list of ids in a file: an interrupted run
 * still leaves something the cleanup can find.
 */
const MARKER = "PROBE18B";

const clean = process.argv[2] === "clean";

const owner = await db.query.user.findFirst({ columns: { id: true, email: true } });
if (!owner) {
  console.error("No user account. Sign up first — the first account is admin.");
  process.exit(1);
}

// --- teardown -------------------------------------------------------------

async function removeProbeRows() {
  // `remote_id` cascades from `drone`, so one delete is enough — but the count
  // is reported separately so a leftover row cannot hide.
  const before = await db.query.remoteId.findMany({ columns: { id: true } });

  /**
   * **Read the pathnames before the rows go, and delete the bytes after.**
   * `drone_photo` cascades from `drone`, and the moment it does, every pathname
   * the app knew about is gone — the first teardown of this script left three
   * orphaned blobs on disk with no row pointing at them, which is precisely the
   * privacy leak `deleteDroneAction` is ordered the way it is to avoid. The
   * probe now has to do what the app does.
   */
  const doomed = await db.query.drone.findMany({
    where: like(drone.nickname, `${MARKER}%`),
    columns: { id: true },
  });
  const pathnames = doomed.length
    ? (
        await db.query.dronePhoto.findMany({
          where: inArray(
            dronePhoto.droneId,
            doomed.map((d) => d.id),
          ),
          columns: { pathname: true },
        })
      ).map((p) => p.pathname)
    : [];

  const deleted = await db
    .delete(drone)
    .where(like(drone.nickname, `${MARKER}%`))
    .returning({ id: drone.id });
  const after = await db.query.remoteId.findMany({ columns: { id: true } });

  for (const pathname of pathnames) {
    await deleteFile(pathname);
  }

  console.log(
    `deleted ${deleted.length} drone rows; remote_id ${before.length} → ${after.length}; ${pathnames.length} blobs swept`,
  );
  return deleted.length;
}

if (clean) {
  await removeProbeRows();
  const drones = await db.query.drone.findMany({ columns: { id: true } });
  const rids = await db.query.remoteId.findMany({ columns: { id: true } });
  console.log(`remaining: drone ${drones.length}, remote_id ${rids.length}`);
  process.exit(0);
}

// A re-run replaces rather than duplicates.
await removeProbeRows();

// --- seed -----------------------------------------------------------------

const now = new Date();
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

/**
 * A self-built airframe with **no serial number** in every status, because that
 * is the aircraft this product exists for and the one whose screens matter. The
 * commercial case is the pending one, so the serial row can be seen rendering.
 */
const seeds = [
  {
    status: "draft" as const,
    nickname: `${MARKER} مسودة`,
    buildType: "self_built" as const,
    weightGrams: 1_450,
    weightClass: "light" as const,
    serialNumber: null,
  },
  {
    status: "pending" as const,
    nickname: `${MARKER} قيد المراجعة`,
    buildType: "commercial" as const,
    manufacturer: "DJI",
    model: "Mavic 3",
    weightGrams: 895,
    weightClass: "light" as const,
    serialNumber: "1581F5FMD23AB00X1234",
    submittedAt: days(-3),
  },
  {
    status: "approved" as const,
    nickname: `${MARKER} معتمدة`,
    buildType: "self_built" as const,
    manufacturer: "محمد العتيبي",
    weightGrams: 2_100,
    weightClass: "light" as const,
    serialNumber: null,
    submittedAt: days(-40),
    decidedAt: days(-37),
    registrationIssuedAt: days(-37),
    // Three years out — well clear of the 30-day warning window, so the tinted
    // card and the untinted card can both be seen on one list.
    registrationExpiresAt: days(1_058),
    code: "AJN-7Q4M-31KD",
  },
  {
    /** Inside 30 days, which is the list's expiry tint — never yet seen. */
    status: "approved" as const,
    nickname: `${MARKER} تنتهي قريباً`,
    buildType: "fpv" as const,
    weightGrams: 480,
    weightClass: "light" as const,
    serialNumber: null,
    submittedAt: days(-1_090),
    decidedAt: days(-1_085),
    registrationIssuedAt: days(-1_085),
    registrationExpiresAt: days(11),
    code: "AJN-2B8T-55WX",
  },
  {
    status: "rejected" as const,
    nickname: `${MARKER} مرفوضة`,
    buildType: "self_built" as const,
    weightGrams: 3_400,
    weightClass: "light" as const,
    serialNumber: null,
    submittedAt: days(-6),
    decidedAt: days(-2),
    // A real reviewer's sentence, in Arabic, over **three lines** — the
    // rejection notice must quote it verbatim and keep the line breaks. A
    // reviewer who numbered three points meant three points.
    rejectionReason:
      "الصورة المرفقة لا تُظهر الطائرة كاملة.\n" +
      "الوزن المُعلن (3400 غرام) لا يتطابق مع المقاسات الظاهرة في الصورة.\n" +
      "أرفق صورة جانبية واضحة وأعد إرسال الطلب.",
    rejectionCount: 1,
  },
  {
    status: "expired" as const,
    nickname: `${MARKER} منتهية`,
    buildType: "self_built" as const,
    weightGrams: 220,
    weightClass: "micro" as const,
    serialNumber: null,
    submittedAt: days(-1_150),
    decidedAt: days(-1_145),
    registrationIssuedAt: days(-1_145),
    registrationExpiresAt: days(-49),
    code: "AJN-9K3P-64VZ",
    /** Expiry does not suspend the code — F10 keeps it, and renewal reuses it. */
    remoteIdStatus: "active" as const,
  },
  {
    status: "revoked" as const,
    nickname: `${MARKER} ملغاة`,
    buildType: "self_built" as const,
    weightGrams: 5_600,
    weightClass: "medium" as const,
    serialNumber: null,
    submittedAt: days(-200),
    decidedAt: days(-9),
    registrationIssuedAt: days(-195),
    registrationExpiresAt: days(900),
    revokedAt: days(-9),
    revocationReason:
      "طيران داخل نطاق مطار الملك خالد الدولي دون تصريح، بتاريخ 12 أغسطس.",
    code: "AJN-5H7N-82QR",
    remoteIdStatus: "suspended" as const,
  },
];

for (const seed of seeds) {
  const { code, remoteIdStatus, ...columns } = seed;

  const [row] = await db
    .insert(drone)
    .values({ ...columns, ownerUserId: owner.id })
    .returning({ id: drone.id, nickname: drone.nickname, status: drone.status });
  if (!row) throw new Error(`insert returned no row for ${seed.nickname}`);

  if (code) {
    await db.insert(remoteId).values({
      droneId: row.id,
      code,
      status: remoteIdStatus ?? "active",
      networkCapable: true,
      suspendedAt: remoteIdStatus === "suspended" ? seed.revokedAt : null,
      suspensionReason:
        remoteIdStatus === "suspended" ? seed.revocationReason : null,
    });
  }

  console.log(
    `${row.status.padEnd(9)} ${row.id}  ${code ?? "—".padEnd(13)}  ${row.nickname}`,
  );
}

console.log(`\nseeded for ${owner.email}. Open /ar/drones.`);
console.log("Clean up with:  pnpm exec tsx scripts/probe-drone-states.mts clean");

process.exit(0);
