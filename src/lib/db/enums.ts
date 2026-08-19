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

/**
 * Who was looking when a Remote ID was resolved (F11).
 *
 * Stored on the scan row rather than derived at read time: the viewer's role
 * may change afterwards, and "a reviewer resolved this" must stay true of the
 * moment it happened — the same reasoning as `audit_event.actorRole`.
 *
 * `owner` is not a role. It is the relationship between the viewer and the
 * record, computed server-side from the session and the drone's owner, and it
 * is the reason the level cannot be a parameter anyone passes in.
 */
export const remoteIdViewerLevel = pgEnum("remote_id_viewer_level", [
  "anonymous",
  "pilot",
  "owner",
  "reviewer",
  "admin",
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
  /**
   * A filed report is a thing somebody **decides about** from F22c onwards, so
   * it needs an entity of its own: auditing a triage decision against the
   * reported `remote_id` would be wrong for the common case where the code
   * resolved to nothing, and would file the reviewer's decision under the
   * aircraft's history when the report may be about a different aircraft
   * altogether.
   */
  "drone_report",
]);

/**
 * What a reviewer did with a filed report (thread 35).
 *
 * Three members, and each one is written by a control that exists. `open` is
 * the state every report is filed in; `actioned` means a reviewer took it
 * somewhere — suspended a Remote ID, called somebody — and `dismissed` means
 * they read it and it needed nothing. There is deliberately no `in_progress`:
 * nothing would set it that "a reviewer has the page open" does not already
 * say, and an enum member nothing writes is a lie about what the app does.
 */
export const droneReportStatus = pgEnum("drone_report_status", [
  "open",
  "actioned",
  "dismissed",
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
