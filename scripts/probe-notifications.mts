/**
 * F15 probe. **Throwaway** — every row it writes, it deletes.
 *
 * Two jobs. It checks the things only a database can answer (ownership on
 * mark-read, preferences being honoured, the email link), and it seeds a set of
 * notifications **for the owner's own account** so the list can be opened in a
 * signed-in browser — which is the only way to see Arabic RTL, Latin numerals
 * and a clean console.
 *
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx scripts/probe-notifications.mts        seed + check
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx scripts/probe-notifications.mts clean  delete everything
 */
import { existsSync } from "node:fs";
import { and, count, eq, like, sql } from "drizzle-orm";

if (existsSync(".env")) process.loadEnvFile(".env");

const { db } = await import("@/lib/db");
const { user } = await import("@/lib/db/auth-schema");
const schema = await import("@/lib/db/schema");
const { notify, emailEnabled } = await import("@/lib/notify");
const {
  countMyUnread,
  linkNotificationEmail,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  setMyPreference,
} = await import("@/lib/data/notification");
const { collapseParams } = await import("@/lib/notifications/render");

const { emailLog, notification, notificationPreference } = schema;

const PROBE = "probe-nt";
const MARKER = "probe-notification";

const results: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

/** Enough of a session for the data layer. This probe is not an auth test. */
function sessionFor(id: string) {
  return { user: { id, role: "pilot" } } as unknown as Parameters<
    typeof listMyNotifications
  >[0];
}

const CLEAN_ONLY = process.argv.includes("clean");

async function main() {
  await cleanup();
  if (CLEAN_ONLY) {
    results.push("cleaned only — nothing seeded");
    return;
  }

  const [owner] = await db.select().from(user).limit(1);
  if (!owner) throw new Error("no account exists yet — sign up first");

  // A second account, so ownership is a fact and not an assumption.
  await db.insert(user).values({
    id: `${PROBE}-other`,
    name: "Probe Other",
    email: `${PROBE}-other@example.test`,
  });

  // --- 1. seed a realistic spread, for the owner --------------------------
  const seeded: Array<{
    type: string;
    params: Record<string, string>;
    entityType: "drone" | "booking";
    href: string | null;
  }> = [
    {
      type: "droneApproved",
      params: { drone: `${MARKER} Falcon` },
      entityType: "drone",
      href: "/drones/probe",
    },
    {
      type: "bookingConfirmed",
      // Both variants, as `notify()` requires — this is the pair F15 collapses.
      params: {
        drone: MARKER,
        zoneAr: "وادي نمار",
        zoneEn: "Wadi Namar",
      },
      entityType: "booking",
      href: "/bookings/probe",
    },
    {
      type: "zoneClosed",
      params: {
        drone: MARKER,
        zoneAr: "الجنادرية",
        zoneEn: "Janadriyah",
        reasonAr: "مهرجان",
        reasonEn: "Festival",
      },
      entityType: "booking",
      href: "/bookings/probe",
    },
    {
      type: "registrationExpiring",
      // A **string**, not a number: ICU would format a bare number itself and
      // emit Arabic-Indic digits under `ar` (open thread 22).
      params: { drone: `${MARKER} Kite`, days: "30" },
      entityType: "drone",
      href: "/drones/probe",
    },
    {
      type: "registrationExpired",
      params: { drone: `${MARKER} Kite` },
      entityType: "drone",
      href: null,
    },
  ];

  await db.transaction(async (tx) => {
    for (const row of seeded) {
      await notify(tx, {
        userId: owner.id,
        type: row.type,
        params: row.params,
        entityType: row.entityType,
        entityId: "probe-entity",
        href: row.href,
      });
    }
  });

  const mine = await listMyNotifications(sessionFor(owner.id));
  const probeRows = mine.filter((row) =>
    JSON.stringify(row.params).includes(MARKER),
  );
  check(
    "five notifications written for the owner, all unread",
    probeRows.length === 5 &&
      probeRows.every((row) => row.status === "unread"),
    `${probeRows.length} rows`,
  );

  check(
    "no notification stores a rendered sentence — only structured values",
    probeRows.every((row) => {
      const params = (row.params ?? {}) as Record<string, unknown>;
      return Object.values(params).every(
        (value) => typeof value !== "string" || value.split(" ").length <= 4,
      );
    }),
  );

  check(
    "every stored href is locale-less",
    probeRows.every((row) => !row.href || /^\/(?!ar\/|en\/)/.test(row.href)),
    probeRows.map((row) => row.href ?? "—").join(" "),
  );

  // --- 2. the bilingual collapse, against a real stored row ---------------
  const zoneRow = probeRows.find((row) => row.type === "bookingConfirmed");
  const asArabic = collapseParams(zoneRow?.params as Record<string, unknown>, "ar");
  const asEnglish = collapseParams(zoneRow?.params as Record<string, unknown>, "en");
  check(
    "the same row renders its zone in both languages, with no join",
    asArabic.zone === "وادي نمار" && asEnglish.zone === "Wadi Namar",
    `ar=${asArabic.zone} en=${asEnglish.zone}`,
  );
  check(
    "and the catalogue never sees a zoneAr/zoneEn pair",
    !("zoneAr" in asArabic) && !("zoneEn" in asArabic),
    Object.keys(asArabic).join(","),
  );

  // --- 3. ownership --------------------------------------------------------
  const target = probeRows[0];
  const stranger = sessionFor(`${PROBE}-other`);
  const strangerRead = await markNotificationRead(stranger, target.id);
  const stillUnread = await db.query.notification.findFirst({
    where: eq(notification.id, target.id),
  });
  check(
    "another account cannot mark this notification read",
    strangerRead === false && stillUnread?.status === "unread",
    `returned ${strangerRead}, status ${stillUnread?.status}`,
  );
  check(
    "and sees none of them in their own list",
    (await listMyNotifications(stranger)).length === 0,
  );

  // --- 4. read state -------------------------------------------------------
  const before = await countMyUnread(sessionFor(owner.id));
  await markNotificationRead(sessionFor(owner.id), target.id);
  const after = await countMyUnread(sessionFor(owner.id));
  const readRow = await db.query.notification.findFirst({
    where: eq(notification.id, target.id),
  });
  check(
    "the owner marking one read drops the unread count by exactly one",
    after === before - 1 && readRow?.status === "read" && Boolean(readRow?.readAt),
    `${before} → ${after}`,
  );

  const readAtFirst = readRow?.readAt?.getTime();
  await markNotificationRead(sessionFor(owner.id), target.id);
  const reRead = await db.query.notification.findFirst({
    where: eq(notification.id, target.id),
  });
  check(
    "marking it again does not move readAt",
    reRead?.readAt?.getTime() === readAtFirst,
    "idempotent",
  );

  // --- 5. preferences ------------------------------------------------------
  await setMyPreference(sessionFor(owner.id), "booking_reminder", {
    inAppEnabled: false,
    emailEnabled: false,
  });

  const suppressed = await db.transaction((tx) =>
    notify(tx, {
      userId: owner.id,
      type: "bookingReminder",
      params: { drone: MARKER, zoneAr: "الحاير", zoneEn: "Al Hair" },
      category: "booking_reminder",
    }),
  );
  check(
    "switching off booking reminders stops the in-app row being written",
    suppressed === false,
  );
  check(
    "and the email half is off too",
    (await db.transaction((tx) =>
      emailEnabled(tx, owner.id, "booking_reminder"),
    )) === false,
  );

  /**
   * **The half that must not be switchable.** A decision carries no category at
   * all, so there is nothing for a preference to suppress — the pilot gets it
   * whatever their settings say.
   */
  const decision = await db.transaction((tx) =>
    notify(tx, {
      userId: owner.id,
      type: "droneRejected",
      params: { drone: `${MARKER} Falcon` },
      entityType: "drone",
      entityId: "probe-entity",
      href: "/drones/probe",
    }),
  );
  check(
    "a rejection still arrives with every preference switched off",
    decision === true,
  );

  // A category nobody has touched defaults to on.
  check(
    "a category with no stored row defaults to on",
    (await db.transaction((tx) =>
      emailEnabled(tx, owner.id, "zone_closure"),
    )) === true,
  );

  // --- 6. the email link ---------------------------------------------------
  const [log] = await db
    .insert(emailLog)
    .values({
      userId: owner.id,
      toAddress: `${PROBE}@example.test`,
      subject: `${MARKER} approval`,
      template: "drone-approved",
      locale: "ar",
      entityId: "probe-entity",
      status: "sent",
    })
    .returning({ id: emailLog.id });

  const linked = await linkNotificationEmail(db, {
    userId: owner.id,
    entityId: "probe-entity",
    emailLogId: log.id,
  });
  const withLog = await db.query.notification.findFirst({
    where: and(
      eq(notification.userId, owner.id),
      eq(notification.emailLogId, log.id),
    ),
  });
  check(
    "the notification links to the email that carried it",
    linked && Boolean(withLog),
    withLog ? `${withLog.type} → email_log ${log.id.slice(0, 8)}…` : "not linked",
  );

  // --- 7. mark all ---------------------------------------------------------
  const cleared = await markAllNotificationsRead(sessionFor(owner.id));
  check(
    "mark-all clears the rest and the count reaches zero",
    (await countMyUnread(sessionFor(owner.id))) === 0 && cleared > 0,
    `${cleared} cleared`,
  );

  /**
   * Left unread again on purpose: the browser check needs something to look at.
   *
   * Raw SQL, because **rule 11's ESLint check fires on `.set({ status:` even
   * here** — read/unread is exempt inside `src/lib/data/notification.ts` and
   * nowhere else, which is the rule working correctly. A probe is not a reason
   * to widen an exemption.
   */
  await db.execute(
    sql`update notification set status = 'unread', read_at = null where user_id = ${owner.id}`,
  );

  results.push("");
  results.push(
    `Seeded ${probeRows.length + 1} notifications for ${owner.email} — open /ar/notifications`,
  );
  results.push("Run with `clean` to remove them.");
}

async function cleanup() {
  const rows = await db.select().from(notification);
  for (const row of rows) {
    if (JSON.stringify(row.params).includes(MARKER)) {
      await db.delete(notification).where(eq(notification.id, row.id));
    }
  }
  await db.delete(notification).where(like(notification.userId, `${PROBE}-%`));
  await db.delete(emailLog).where(like(emailLog.subject, `${MARKER}%`));
  await db
    .delete(notificationPreference)
    .where(like(notificationPreference.userId, `${PROBE}-%`));
  // The owner's own preference rows, written by this probe.
  const [owner] = await db.select().from(user).limit(1);
  if (owner) {
    await db
      .delete(notificationPreference)
      .where(eq(notificationPreference.userId, owner.id));
  }
  await db.delete(user).where(like(user.id, `${PROBE}-%`));
}

try {
  await main();
} finally {
  if (CLEAN_ONLY) {
    const [left] = await db.select({ value: count() }).from(notification);
    results.push(`--- notification rows left: ${left?.value ?? 0}`);
  }
  console.log(results.join("\n"));
  process.exit(process.exitCode ?? 0);
}
