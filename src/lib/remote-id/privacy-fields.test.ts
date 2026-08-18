import { describe, expect, it } from "vitest";
import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import {
  PRIVACY_HIDDEN,
  PRIVACY_HIDDEN_ORDER,
  PRIVACY_NON_FIELDS,
  PRIVACY_SHOWN,
  PRIVACY_SHOWN_ORDER,
} from "./privacy-fields";
import { redactRemoteId, type FullRemoteIdRecord } from "./redact";

/**
 * The card tells a pilot what a stranger scanning their airframe will see, and
 * they decide whether to print the sticker on the strength of it. That sentence
 * is the only thing in this repo that can go **silently** false: add a field to
 * `PublicFields` and every other check stays green while the card keeps calling
 * it private.
 *
 * So the explainer is not compared to F11's feature file — it is compared to
 * `redactRemoteId`'s **actual output**, field by field, in both directions.
 */

const NOW = new Date("2026-08-17T10:00:00Z");

function record(): FullRemoteIdRecord {
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
    nickname: "Nickname",
    manufacturer: "Maker",
    model: "Model",
    serialNumber: "SN-1",

    cityNameAr: "الرياض",
    cityNameEn: "Riyadh",

    ownerNameAr: "سلطان الحربي",
    ownerNameEn: "Sultan Alharbi",
    ownerMobile: "+966500000001",
    ownerIdDocumentType: "saudi_national_id",
    ownerIdDocumentNumber: "1098765432",

    activeFlight: {
      zoneNameAr: "منطقة",
      zoneNameEn: "Zone",
      slotStart: new Date("2026-08-17T09:00:00Z"),
      slotEnd: new Date("2026-08-17T11:00:00Z"),
    },

    photoUrls: ["/api/files/drone/photo.jpg"],
    declarations: [],
    bookings: [],
    scans: [],
  };
}

describe("the privacy explainer against the real projection", () => {
  it("describes every field an anonymous scanner actually receives", () => {
    const view = redactRemoteId(record(), "anonymous", NOW);

    const undescribed = Object.keys(view).filter(
      (key) =>
        !(PRIVACY_NON_FIELDS as readonly string[]).includes(key) &&
        !(key in PRIVACY_SHOWN),
    );

    /**
     * A failure here means F11 widened what a bystander sees and the card did
     * not say so. Add the field to `PRIVACY_SHOWN` **and** write the line the
     * pilot reads — the map alone is not the promise.
     */
    expect(undescribed).toEqual([]);
  });

  it("claims nothing is shown that the projection does not actually carry", () => {
    const view = redactRemoteId(record(), "anonymous", NOW);
    const actual = new Set(Object.keys(view));

    const overclaimed = Object.keys(PRIVACY_SHOWN).filter((key) => !actual.has(key));

    // The mirror failure: the card reassuring a pilot that a field is public
    // when it has been withdrawn, which reads as the app being vaguer than it
    // is — and, worse, hides that the field moved to the private column.
    expect(overclaimed).toEqual([]);
  });

  it("keeps every field it calls private out of the anonymous projection", () => {
    const view = redactRemoteId(record(), "anonymous", NOW);

    const leaked = Object.keys(PRIVACY_HIDDEN).filter((key) => key in view);

    expect(leaked).toEqual([]);
  });

  it("accounts for every field the owner's own view adds", () => {
    const owner = redactRemoteId(record(), "owner", NOW);
    const anonymous = redactRemoteId(record(), "anonymous", NOW);

    const ownerOnly = Object.keys(owner).filter(
      (key) =>
        !(key in anonymous) && !(PRIVACY_NON_FIELDS as readonly string[]).includes(key),
    );

    const unlisted = ownerOnly.filter((key) => !(key in PRIVACY_HIDDEN));

    /**
     * The third direction, and the one that catches a *new* private field: F11
     * adds something to `IdentifiedFields`, and the "not shown" column silently
     * stops being the whole list of what the pilot is protecting.
     */
    expect(unlisted).toEqual([]);
  });
});

describe("the explainer's message keys", () => {
  it("renders a line for every entry in both columns, in both languages", () => {
    for (const [name, catalogue] of [
      ["ar", ar],
      ["en", en],
    ] as const) {
      const card = catalogue.remoteId.card as unknown as {
        privacyShown: Record<string, string>;
        privacyHidden: Record<string, string>;
      };

      for (const key of PRIVACY_SHOWN_ORDER) {
        expect(card.privacyShown[key], `${name}: privacyShown.${key}`).toBeTruthy();
      }
      for (const key of PRIVACY_HIDDEN_ORDER) {
        expect(card.privacyHidden[key], `${name}: privacyHidden.${key}`).toBeTruthy();
      }
    }
  });

  it("has a rendered line behind every mapped field", () => {
    const shown = new Set(PRIVACY_SHOWN_ORDER as readonly string[]);
    const hidden = new Set(PRIVACY_HIDDEN_ORDER as readonly string[]);

    // A field mapped to a key that is never rendered is a field the pilot is
    // never actually told about — the map would look complete and the page
    // would not be.
    for (const key of Object.values(PRIVACY_SHOWN)) expect(shown.has(key)).toBe(true);
    for (const key of Object.values(PRIVACY_HIDDEN)) {
      expect(hidden.has(key) || shown.has(key)).toBe(true);
    }
  });
});
