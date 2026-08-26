import { bookingCloseout } from "./booking-closeout";
import { bookingApproved } from "./booking-approved";
import { bookingRejected } from "./booking-rejected";
import { bookingReminders } from "./booking-reminders";
import { closureFanout } from "./closure-fanout";
import { droneRejected } from "./drone-rejected";
import { droneRevoked } from "./drone-revoked";
import { qrRender } from "./qr-render";
import { rateLimitSweep } from "./rate-limit-sweep";
import { registrationExpiryReminders } from "./expiry-reminders";
import { registrationExpirySweep } from "./expiry-sweep";
import { reviewQueueDigest } from "./review-digest";
import { runCancelled } from "./run-cancelled";
import { zoneSuspended } from "./zone-suspended";

/**
 * Everything `/api/inngest` serves. A function missing from this array is a
 * function Inngest has never heard of — it will not appear in the dev
 * dashboard, and its cron will never fire.
 */
export const functions = [
  registrationExpirySweep,
  registrationExpiryReminders,
  bookingCloseout,
  bookingReminders,
  bookingRejected,
  bookingApproved,
  reviewQueueDigest,
  rateLimitSweep,
  qrRender,
  closureFanout,
  droneRejected,
  droneRevoked,
  runCancelled,
  zoneSuspended,
];
