/**
 * What the card's privacy explainer claims a stranger can and cannot see,
 * expressed as a map from the **actual fields of the anonymous projection** to
 * the message key that describes each one.
 *
 * **Pure, and separate from the component, so a test can hold it against
 * `redactRemoteId` itself.** The explainer is a promise about other people's
 * data made to a pilot who is about to print a sticker, and it is the one kind
 * of statement that goes silently false: F11 adds a field to `PublicFields`,
 * every check in the repo stays green, and the card keeps saying that field is
 * private. `privacy-fields.test.ts` fails in exactly that case.
 *
 * `level` and `canReveal` are the projection's own discriminants rather than
 * anything about the aircraft, so they are named here as deliberately not
 * described.
 */

/** Discriminants, not data. Nothing on the card describes these. */
export const PRIVACY_NON_FIELDS = ["level", "canReveal"] as const;

/**
 * Every key of the anonymous projection → the `remoteId.card.privacyShown.*`
 * key that tells the pilot about it. Two fields may share one line: build type
 * and weight class are one sentence to a reader, and `networkCapable` and
 * `broadcastCapable` are one fact ("how it broadcasts").
 */
export const PRIVACY_SHOWN: Record<string, string> = {
  code: "code",
  registrationStatus: "status",
  validUntil: "validUntil",
  buildType: "kind",
  weightClass: "kind",
  cityNameAr: "city",
  cityNameEn: "city",
  flightInProgress: "flying",
  networkCapable: "capability",
  broadcastCapable: "capability",
};

/**
 * Fields the identified projection carries that the anonymous one must not —
 * the "not shown" column, keyed the same way. `activeFlight` is the subtle one
 * and the reason the list is written out: a bystander is told *that* a flight
 * is authorised (`flightInProgress`, above) and never *where* it is.
 */
export const PRIVACY_HIDDEN: Record<string, string> = {
  nickname: "nickname",
  manufacturer: "makeModel",
  model: "makeModel",
  serialNumber: "serial",
  weightGrams: "kind",
  hasCamera: "makeModel",
  droneId: "nickname",
  photoUrls: "photos",
  ownerNameAr: "owner",
  ownerNameEn: "owner",
  ownerMobile: "contact",
  ownerIdDocumentType: "id",
  ownerIdDocumentMasked: "id",
  activeFlight: "zone",
  declarations: "history",
  bookings: "history",
};

/** The order the two columns are rendered in. */
export const PRIVACY_SHOWN_ORDER = [
  "code",
  "status",
  "validUntil",
  "kind",
  "city",
  "flying",
  "capability",
] as const;

export const PRIVACY_HIDDEN_ORDER = [
  "nickname",
  "makeModel",
  "serial",
  "photos",
  "owner",
  "contact",
  "id",
  "zone",
  "history",
] as const;
