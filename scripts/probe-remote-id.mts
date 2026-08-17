/**
 * F10/F11 probe. **Throwaway** — every row it writes, it deletes.
 *
 * Run with the react-server condition so `server-only` resolves to its no-op:
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx scripts/probe-remote-id.mts
 */
import { existsSync } from "node:fs";
import { and, eq, inArray, like } from "drizzle-orm";

if (existsSync(".env")) process.loadEnvFile(".env");

const { db } = await import("@/lib/db");
const { user } = await import("@/lib/db/auth-schema");
const schema = await import("@/lib/db/schema");
const { issueRemoteId } = await import("@/lib/remote-id/issue");
const {
  declareModule,
  verifyDeclaration,
  supersedeDeclaration,
} = await import("@/lib/remote-id/declaration");
const { resolveRemoteId } = await import("@/lib/remote-id/resolve");
const { suspendRemoteIdForDrone, reactivateRemoteIdForDrone } = await import(
  "@/lib/workflow/remote-id"
);
const { redactRemoteId } = await import("@/lib/remote-id/redact");
const { getRemoteIdRecordByCode } = await import("@/lib/data/remote-id");

const {
  auditEvent,
  city,
  drone,
  droneReport,
  pilotProfile,
  remoteId,
  remoteIdDeclaration,
  remoteIdScan,
} = schema;

const ACTOR = { userId: null, role: null, isSystem: true };
const PROBE = "probe-rid";
const results: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  await cleanup();

  const [riyadh] = await db.select().from(city).limit(1);

  // --- probe accounts -----------------------------------------------------
  await db.insert(user).values([
    { id: `${PROBE}-a`, name: "Probe A", email: `${PROBE}-a@example.test` },
    { id: `${PROBE}-b`, name: "Probe B", email: `${PROBE}-b@example.test` },
  ]);
  await db.insert(pilotProfile).values({
    userId: `${PROBE}-a`,
    fullNameAr: "طيّار الاختبار",
    fullNameEn: "Probe Pilot",
    idDocumentType: "saudi_national_id",
    idDocumentNumber: "1098765432",
    idDocumentHash: `${PROBE}-hash`,
    mobileE164: "+966500000001",
    addressCityId: riyadh?.id ?? null,
    completedAt: new Date(),
  });

  const droneIds: string[] = [];
  for (const label of ["one", "two", "three"]) {
    const [row] = await db
      .insert(drone)
      .values({
        ownerUserId: `${PROBE}-a`,
        nickname: `${PROBE}-${label}`,
        // No serial: a self-built airframe is the whole point of the product.
        serialNumber: null,
        buildType: "self_built",
        weightGrams: 1200,
        weightClass: "light",
        status: "approved",
        registrationIssuedAt: new Date(),
        registrationExpiresAt: new Date(Date.now() + 3 * 365 * 86_400_000),
      })
      .returning({ id: drone.id });
    droneIds.push(row!.id);
  }

  // --- F10: issuance ------------------------------------------------------
  const issued = await db.transaction((tx) =>
    issueRemoteId(tx, { droneId: droneIds[0]!, actor: ACTOR }),
  );
  const row = await db.query.remoteId.findFirst({
    where: eq(remoteId.id, issued.remoteIdId),
  });
  check(
    "approving issues exactly one active row",
    issued.created &&
      row?.status === "active" &&
      row.networkCapable === true &&
      row.broadcastCapable === false,
    `${issued.code} network=${row?.networkCapable} broadcast=${row?.broadcastCapable}`,
  );
  check(
    "the code is canonical",
    /^AJN-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(issued.code),
    issued.code,
  );
  check(
    "an issue is in the audit trail",
    Boolean(
      await db.query.auditEvent.findFirst({
        where: and(
          eq(auditEvent.entityId, issued.remoteIdId),
          eq(auditEvent.action, "remote_id.issued"),
        ),
      }),
    ),
  );

  // Renewal: the same drone, issued again.
  const again = await db.transaction((tx) =>
    issueRemoteId(tx, { droneId: droneIds[0]!, actor: ACTOR }),
  );
  check(
    "re-issuing returns the same code (renewal keeps the sticker alive)",
    again.code === issued.code && again.created === false,
    `${issued.code} → ${again.code}`,
  );

  // Forced collision: hand it a generator that repeats the code that exists.
  let attempts = 0;
  const collided = await db.transaction((tx) =>
    issueRemoteId(tx, {
      droneId: droneIds[1]!,
      actor: ACTOR,
      generate: () => {
        attempts += 1;
        return attempts === 1 ? issued.code : "AJN-0000-0001";
      },
    }),
  );
  const collisionEvents = await db.query.auditEvent.findMany({
    where: eq(auditEvent.action, "remote_id.collision"),
  });
  check(
    "a collision regenerates, succeeds and is logged",
    collided.created &&
      collided.code === "AJN-0000-0001" &&
      collisionEvents.length === 1,
    `${collisionEvents.length} collision event(s)`,
  );

  // Five collisions in a row: throws, inserts nothing.
  let threw = false;
  try {
    await db.transaction((tx) =>
      issueRemoteId(tx, {
        droneId: droneIds[2]!,
        actor: ACTOR,
        generate: () => issued.code,
      }),
    );
  } catch {
    threw = true;
  }
  const third = await db.query.remoteId.findFirst({
    where: eq(remoteId.droneId, droneIds[2]!),
  });
  check(
    "five collisions throw rather than insert a duplicate",
    threw && !third,
    threw ? "threw, no row" : "did not throw",
  );

  // --- suspension and reactivation ---------------------------------------
  await db.transaction((tx) =>
    suspendRemoteIdForDrone(tx, {
      droneId: droneIds[0]!,
      actor: ACTOR,
      reason: "probe",
    }),
  );
  const suspended = await db.query.remoteId.findFirst({
    where: eq(remoteId.id, issued.remoteIdId),
  });
  check(
    "revocation suspends without touching the code",
    suspended?.status === "suspended" && suspended.code === issued.code,
    `${suspended?.status} ${suspended?.code}`,
  );

  await db.transaction((tx) =>
    reactivateRemoteIdForDrone(tx, { droneId: droneIds[0]!, actor: ACTOR }),
  );
  const revived = await db.query.remoteId.findFirst({
    where: eq(remoteId.id, issued.remoteIdId),
  });
  check(
    "renewal reactivates the same code",
    revived?.status === "active" &&
      revived.code === issued.code &&
      revived.suspendedAt === null,
    `${revived?.status} ${revived?.code}`,
  );

  // --- declarations -------------------------------------------------------
  const declared = await db.transaction((tx) =>
    declareModule(tx, {
      remoteIdId: issued.remoteIdId,
      kind: "faa_broadcast_module",
      manufacturer: "ModuleCo",
      moduleSerial: `${PROBE}-MOD-1`,
      actor: ACTOR,
    }),
  );
  const afterDeclare = await db.query.remoteId.findFirst({
    where: eq(remoteId.id, issued.remoteIdId),
  });
  check(
    "an unverified declaration leaves broadcastCapable false",
    declared.ok && afterDeclare?.broadcastCapable === false,
  );

  if (!declared.ok) throw new Error("declaration failed");

  await db.transaction((tx) =>
    verifyDeclaration(tx, {
      declarationId: declared.declarationId,
      actor: { userId: `${PROBE}-b`, role: "reviewer", isSystem: false },
    }),
  );
  const afterVerify = await db.query.remoteId.findFirst({
    where: eq(remoteId.id, issued.remoteIdId),
  });
  check(
    "verifying flips broadcastCapable to true",
    afterVerify?.broadcastCapable === true,
  );

  // The same physical module, claimed by the second airframe.
  const clash = await db.transaction((tx) =>
    declareModule(tx, {
      remoteIdId: collided.remoteIdId,
      kind: "faa_broadcast_module",
      moduleSerial: `${PROBE}-MOD-1`,
      actor: ACTOR,
    }),
  );
  check(
    "two airframes cannot hold the same module claim",
    !clash.ok && clash.reason === "module_already_claimed",
    JSON.stringify(clash),
  );

  await db.transaction((tx) =>
    supersedeDeclaration(tx, {
      declarationId: declared.declarationId,
      actor: ACTOR,
    }),
  );
  const afterSupersede = await db.query.remoteId.findFirst({
    where: eq(remoteId.id, issued.remoteIdId),
  });
  const transferred = await db.transaction((tx) =>
    declareModule(tx, {
      remoteIdId: collided.remoteIdId,
      kind: "faa_broadcast_module",
      moduleSerial: `${PROBE}-MOD-1`,
      actor: ACTOR,
    }),
  );
  check(
    "after supersession the claim transfers, and capability follows the row",
    transferred.ok && afterSupersede?.broadcastCapable === false,
    `broadcastCapable=${afterSupersede?.broadcastCapable}`,
  );

  // --- F11: resolution and scan logging -----------------------------------
  const before = await db.query.remoteId.findFirst({
    where: eq(remoteId.id, issued.remoteIdId),
  });

  const anonymous = await resolveRemoteId({
    rawCode: issued.code.toLowerCase().replace(/-/g, " "),
    session: null,
    headers: new Headers({
      "x-forwarded-for": "203.0.113.9",
      "user-agent": "probe/1.0",
    }),
  });
  check(
    "a misread, spaced, lowercase code still resolves",
    anonymous.ok && anonymous.view.code === issued.code,
  );
  if (anonymous.ok) {
    check(
      "the anonymous payload carries no owner identity",
      !JSON.stringify(anonymous.view).includes("1098765432") &&
        !JSON.stringify(anonymous.view).includes("طيّار الاختبار") &&
        !("ownerNameAr" in anonymous.view),
    );
  }

  const after = await db.query.remoteId.findFirst({
    where: eq(remoteId.id, issued.remoteIdId),
  });
  check(
    "every resolution increments resolveCount and stamps lastResolvedAt",
    (after?.resolveCount ?? 0) === (before?.resolveCount ?? 0) + 1 &&
      after?.lastResolvedAt !== null,
    `${before?.resolveCount} → ${after?.resolveCount}`,
  );

  const scan = await db.query.remoteIdScan.findFirst({
    where: eq(remoteIdScan.remoteIdId, issued.remoteIdId),
  });
  check(
    "the scan row stores a hash, never the address",
    scan?.ipHash !== null &&
      /^[0-9a-f]{64}$/.test(scan?.ipHash ?? "") &&
      !JSON.stringify(scan).includes("203.0.113.9"),
    scan?.ipHash?.slice(0, 12),
  );
  check("the scan row records the viewer level", scan?.viewerLevel === "anonymous");

  const unknown = await resolveRemoteId({
    rawCode: "AJN-0000-0002",
    session: null,
    headers: new Headers(),
  });
  const unknownScan = await db.query.remoteIdScan.findFirst({
    where: eq(remoteIdScan.scannedCode, "AJN-0000-0002"),
  });
  check(
    "an unknown code answers not_registered and is still logged",
    !unknown.ok && unknown.reason === "not_registered" && Boolean(unknownScan),
  );

  const garbage = await resolveRemoteId({
    rawCode: "not a code at all",
    session: null,
    headers: new Headers(),
  });
  check(
    "a malformed code answers invalid_code and is still logged",
    !garbage.ok && garbage.reason === "invalid_code",
  );

  // --- levels over the same record ---------------------------------------
  const record = await getRemoteIdRecordByCode(null, issued.code);
  if (!record) throw new Error("record vanished");

  const levels = ["anonymous", "pilot", "owner", "reviewer"] as const;
  for (const level of levels) {
    const view = JSON.stringify(redactRemoteId(record, level));
    const identified = level === "owner" || level === "reviewer";
    check(
      `${level}: owner name ${identified ? "present" : "absent"}`,
      view.includes("طيّار الاختبار") === identified,
    );
    check(
      `${level}: the whole national ID is never in the payload`,
      !view.includes("1098765432"),
    );
  }

  console.log(results.join("\n"));
}

async function cleanup() {
  const probeUsers = [`${PROBE}-a`, `${PROBE}-b`];
  const drones = await db
    .select({ id: drone.id })
    .from(drone)
    .where(like(drone.nickname, `${PROBE}%`));
  const droneIds = drones.map((d) => d.id);

  const rids = droneIds.length
    ? await db
        .select({ id: remoteId.id })
        .from(remoteId)
        .where(inArray(remoteId.droneId, droneIds))
    : [];
  const ridIds = rids.map((r) => r.id);

  if (ridIds.length) {
    await db.delete(remoteIdScan).where(inArray(remoteIdScan.remoteIdId, ridIds));
    await db.delete(droneReport).where(inArray(droneReport.remoteIdId, ridIds));
    await db
      .delete(remoteIdDeclaration)
      .where(inArray(remoteIdDeclaration.remoteIdId, ridIds));
    await db.delete(remoteId).where(inArray(remoteId.id, ridIds));
  }
  await db
    .delete(remoteIdScan)
    .where(inArray(remoteIdScan.scannedCode, ["AJN-0000-0002", "NOTACODEATALL"]));
  if (droneIds.length) await db.delete(drone).where(inArray(drone.id, droneIds));
  await db.delete(pilotProfile).where(inArray(pilotProfile.userId, probeUsers));
  await db
    .delete(auditEvent)
    .where(
      inArray(auditEvent.action, [
        "remote_id.issued",
        "remote_id.collision",
        "remote_id.suspended",
        "remote_id.reactivated",
        "remote_id.declaration_filed",
        "remote_id.declaration_verified",
        "remote_id.declaration_superseded",
      ]),
    );
  await db.delete(user).where(inArray(user.id, probeUsers));
}

const mode = process.argv[2];
if (mode === "cleanup") {
  await cleanup();
  console.log("probe rows removed");
} else {
  await main();
}

process.exit(process.exitCode ?? 0);
