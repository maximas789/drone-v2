import { describe, expect, it } from "vitest";
import {
  isIdentified,
  maskIdDocument,
  redactRemoteId,
  registrationStatusOf,
  toJsonBody,
  type FullRemoteIdRecord,
  type ViewerLevel,
} from "./redact";

const NOW = new Date("2026-08-17T10:00:00Z");

/**
 * Every secret in one record, each a distinctive string, so a leak through any
 * level is findable by searching the serialised output for it.
 */
const SECRETS = {
  ownerNameAr: "سلطان الحربي",
  ownerNameEn: "Sultan Alharbi",
  ownerMobile: "+966500000001",
  idNumber: "1098765432",
  manufacturer: "SecretWorks",
  model: "Phantom-Z",
  serialNumber: "SN-SECRET-9",
  nickname: "SecretNickname",
  photo: "/api/files/drone/secret-photo.jpg",
  zoneAr: "منطقة سرية",
  zoneEn: "SecretZone",
} as const;

function record(overrides: Partial<FullRemoteIdRecord> = {}): FullRemoteIdRecord {
  return {
    remoteIdId: "11111111-1111-1111-1111-111111111111",
    code: "AJN-4F2K-91XZ",
    remoteIdStatus: "active",
    droneStatus: "approved",
    issuedAt: new Date("2026-01-01T00:00:00Z"),
    validUntil: new Date("2029-01-01T00:00:00Z"),
    networkCapable: true,
    broadcastCapable: false,

    buildType: "self_built",
    weightClass: "light",
    weightGrams: 1200,
    hasCamera: true,

    droneId: "22222222-2222-2222-2222-222222222222",
    ownerUserId: "user_owner",
    nickname: SECRETS.nickname,
    manufacturer: SECRETS.manufacturer,
    model: SECRETS.model,
    serialNumber: SECRETS.serialNumber,

    cityNameAr: "الرياض",
    cityNameEn: "Riyadh",

    ownerNameAr: SECRETS.ownerNameAr,
    ownerNameEn: SECRETS.ownerNameEn,
    ownerMobile: SECRETS.ownerMobile,
    ownerIdDocumentType: "saudi_national_id",
    ownerIdDocumentNumber: SECRETS.idNumber,

    activeFlight: {
      zoneNameAr: SECRETS.zoneAr,
      zoneNameEn: SECRETS.zoneEn,
      slotStart: new Date("2026-08-17T09:00:00Z"),
      slotEnd: new Date("2026-08-17T11:00:00Z"),
    },

    photoUrls: [SECRETS.photo],
    declarations: [
      {
        kind: "faa_broadcast_module",
        manufacturer: "ModuleCo",
        moduleSerial: "MOD-1",
        docReference: "DOC-1",
        verifiedAt: null,
        validUntil: null,
      },
    ],
    bookings: [
      {
        id: "33333333-3333-3333-3333-333333333333",
        zoneNameAr: SECRETS.zoneAr,
        zoneNameEn: SECRETS.zoneEn,
        slotStart: new Date("2026-08-17T09:00:00Z"),
        slotEnd: new Date("2026-08-17T11:00:00Z"),
        status: "approved",
      },
    ],
    scans: [
      {
        id: "44444444-4444-4444-4444-444444444444",
        viewerLevel: "anonymous",
        revealedIdentity: false,
        createdAt: NOW,
      },
    ],
    ...overrides,
  };
}

/** What actually leaves the process, for whichever surface renders it. */
function serialised(level: ViewerLevel): string {
  return JSON.stringify(toJsonBody(redactRemoteId(record(), level, NOW)));
}

describe("redactRemoteId — anonymous", () => {
  const view = redactRemoteId(record(), "anonymous", NOW);

  it("is a licence plate: code, status, valid-until, build, weight, city", () => {
    expect(view.level).toBe("anonymous");
    expect(view.code).toBe("AJN-4F2K-91XZ");
    expect(view.registrationStatus).toBe("active");
    expect(view.validUntil).toEqual(new Date("2029-01-01T00:00:00Z"));
    expect(view.buildType).toBe("self_built");
    expect(view.weightClass).toBe("light");
    expect(view.cityNameAr).toBe("الرياض");
  });

  it("says a flight is in progress without saying where", () => {
    expect(view.flightInProgress).toBe(true);
    expect(serialised("anonymous")).not.toContain(SECRETS.zoneAr);
    expect(serialised("anonymous")).not.toContain(SECRETS.zoneEn);
  });

  it("carries no owner identity, no photos, no manufacturer, in the payload", () => {
    const json = serialised("anonymous");
    for (const secret of Object.values(SECRETS)) {
      expect(json).not.toContain(secret);
    }
    // Not even the masked form of the ID, which would still leak four digits.
    expect(json).not.toContain("5432");
  });

  it("removes the fields rather than nulling them", () => {
    // A `null` is indistinguishable from "has no manufacturer" and would leak
    // the shape of what is withheld.
    expect(Object.keys(view)).not.toContain("manufacturer");
    expect(Object.keys(view)).not.toContain("ownerNameAr");
    expect("ownerNameAr" in view).toBe(false);
  });

  it("offers no reveal control", () => {
    expect(view.canReveal).toBe(false);
    expect(isIdentified(view)).toBe(false);
  });

  it("is rejected by the compiler if anything tries to render an owner field", () => {
    /**
     * **This is a compile-time assertion, and `pnpm typecheck` is what runs
     * it.** `@ts-expect-error` fails the build when the line it guards stops
     * being an error — so if the anonymous branch ever gains `ownerNameAr`,
     * this test does not go green, it stops compiling.
     */
    // @ts-expect-error — the anonymous branch has no owner name.
    const leaked = view.ownerNameAr;
    expect(leaked).toBeUndefined();
  });
});

describe("redactRemoteId — a signed-in pilot who is not the owner", () => {
  it("sees exactly what an anonymous viewer sees", () => {
    const anonymous = redactRemoteId(record(), "anonymous", NOW);
    const pilot = redactRemoteId(record(), "pilot", NOW);

    expect(Object.keys(pilot).sort()).toEqual(Object.keys(anonymous).sort());
    expect(serialised("pilot").replace('"pilot"', '"anonymous"')).toBe(
      serialised("anonymous"),
    );
  });
});

describe("redactRemoteId — owner", () => {
  const view = redactRemoteId(record(), "owner", NOW);

  it("sees the full record", () => {
    if (view.level !== "owner") throw new Error("expected the owner branch");
    expect(view.manufacturer).toBe(SECRETS.manufacturer);
    expect(view.serialNumber).toBe(SECRETS.serialNumber);
    expect(view.ownerNameAr).toBe(SECRETS.ownerNameAr);
    expect(view.ownerMobile).toBe(SECRETS.ownerMobile);
    expect(view.photoUrls).toEqual([SECRETS.photo]);
    expect(view.activeFlight?.zoneNameAr).toBe(SECRETS.zoneAr);
  });

  it("sees the national ID masked, never whole", () => {
    if (view.level !== "owner") throw new Error("expected the owner branch");
    expect(view.ownerIdDocumentMasked).toBe("•••••5432");
    expect(serialised("owner")).not.toContain(SECRETS.idNumber);
  });

  it("gets no reveal control and no scan log", () => {
    expect(view.canReveal).toBe(false);
    expect("scans" in view).toBe(false);
  });
});

describe("redactRemoteId — reviewer and admin", () => {
  const view = redactRemoteId(record(), "reviewer", NOW);

  it("sees the full record plus the reveal control and the scan log", () => {
    if (view.level !== "reviewer" && view.level !== "admin") {
      throw new Error("expected the staff branch");
    }
    expect(view.canReveal).toBe(true);
    expect(view.scans).toHaveLength(1);
    expect(view.ownerNameEn).toBe(SECRETS.ownerNameEn);
  });

  it("still gets the ID masked — the whole number comes only from a reveal", () => {
    if (view.level !== "reviewer" && view.level !== "admin") {
      throw new Error("expected the staff branch");
    }
    expect(view.ownerIdDocumentMasked).toBe("•••••5432");
    expect(serialised("reviewer")).not.toContain(SECRETS.idNumber);
    expect(serialised("admin")).not.toContain(SECRETS.idNumber);
  });
});

describe("registrationStatusOf", () => {
  it("reports suspension above everything the drone row says", () => {
    expect(
      registrationStatusOf(
        { remoteIdStatus: "suspended", droneStatus: "approved", validUntil: null },
        NOW,
      ),
    ).toBe("suspended");
  });

  it("reports a revoked drone as revoked", () => {
    expect(
      registrationStatusOf(
        { remoteIdStatus: "suspended", droneStatus: "revoked", validUntil: null },
        NOW,
      ),
    ).toBe("revoked");
  });

  it("expires on the clock, not on the sweep", () => {
    // Still `approved` in the row — the nightly job has not run yet.
    expect(
      registrationStatusOf(
        {
          remoteIdStatus: "active",
          droneStatus: "approved",
          validUntil: new Date("2026-08-17T09:59:59Z"),
        },
        NOW,
      ),
    ).toBe("expired");

    expect(
      registrationStatusOf(
        {
          remoteIdStatus: "active",
          droneStatus: "approved",
          validUntil: new Date("2026-08-17T10:00:01Z"),
        },
        NOW,
      ),
    ).toBe("active");
  });

  it("reports anything not approved as unregistered", () => {
    for (const droneStatus of ["draft", "pending", "rejected"]) {
      expect(
        registrationStatusOf(
          { remoteIdStatus: "active", droneStatus, validUntil: null },
          NOW,
        ),
      ).toBe("unregistered");
    }
  });
});

describe("maskIdDocument", () => {
  it("shows the last four digits behind a fixed-width mask", () => {
    expect(maskIdDocument("1098765432")).toBe("•••••5432");
    // Fixed width: a shorter document must not be identifiable by its mask.
    expect(maskIdDocument("12345678")).toBe("•••••5678");
    expect(maskIdDocument("1098765432")?.length).toBe(
      maskIdDocument("12345678")?.length,
    );
  });

  it("passes null through", () => {
    expect(maskIdDocument(null)).toBeNull();
  });
});
