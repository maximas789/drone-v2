import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Enumerable domain values are stored as **stable codes** and translated at
 * render — never as bilingual text. A rejection reason written once must read
 * correctly to whichever language the reader picks, including a regulator
 * auditing it years later in the other one.
 */

export const idDocumentType = pgEnum("id_document_type", [
  "saudi_national_id",
  "iqama",
  "gcc_id",
]);

/**
 * `self_built` and `fpv` are the whole reason this product exists: they are the
 * classes GACA's serial-number requirement locks out.
 */
export const droneBuildType = pgEnum("drone_build_type", [
  "commercial",
  "self_built",
  "fpv",
]);

/** micro <250 g · light <4 kg · medium <25 kg · heavy >=25 kg */
export const droneWeightClass = pgEnum("drone_weight_class", [
  "micro",
  "light",
  "medium",
  "heavy",
]);

export const droneStatus = pgEnum("drone_status", [
  "draft",
  "pending",
  "approved",
  "rejected",
  "expired",
  "revoked",
]);

export const remoteIdStatus = pgEnum("remote_id_status", [
  "active",
  "suspended",
  "retired",
]);

export const remoteIdDeclKind = pgEnum("remote_id_decl_kind", [
  "faa_broadcast_module",
  "gaca_dri",
  "gaca_nri",
  "other",
]);

export const zoneKind = pgEnum("zone_kind", [
  "permitted",
  "restricted",
  "no_fly",
]);

export const zoneStatus = pgEnum("zone_status", [
  "draft",
  "active",
  "suspended",
  "archived",
]);

export const bookingStatus = pgEnum("booking_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "completed",
  "no_show",
]);

export const auditEntityType = pgEnum("audit_entity_type", [
  "user",
  "pilot_profile",
  "drone",
  "remote_id",
  "zone",
  "zone_closure",
  "booking",
  "city",
]);

export const notificationStatus = pgEnum("notification_status", [
  "unread",
  "read",
  "archived",
]);

/** The only notification categories that exist. No aspirational rows. */
export const notificationCategory = pgEnum("notification_category", [
  "booking_reminder",
  "registration_expiry",
  "zone_closure",
]);

/**
 * The lifecycle of one background job run, mirrored from Inngest (F08).
 *
 * **`cancelling` is a real state, not a label.** Inngest cancels at the next
 * step boundary, so between the request and the boundary the run is still
 * executing. Showing "cancelled" there would be a lie the operator catches when
 * the next step's effects appear anyway.
 */
export const jobStatus = pgEnum("job_status", [
  "running",
  "completed",
  "failed",
  "cancelling",
  "cancelled",
]);

export const dronePhotoKind = pgEnum("drone_photo_kind", [
  "overall",
  "serial_plate",
  "remote_id_module",
  "payload",
]);
