import { bookingApproved } from "./booking-approved";
import { bookingCancelledByAuthority } from "./booking-cancelled-by-authority";
import { bookingReminder } from "./booking-reminder";
import { bookingRejected } from "./booking-rejected";
import { droneApproved } from "./drone-approved";
import { droneExpired } from "./drone-expired";
import { droneExpiring } from "./drone-expiring";
import { droneRejected } from "./drone-rejected";
import { resetPassword } from "./reset-password";
import { reviewQueueDigest } from "./review-queue-digest";
import { verifyEmail } from "./verify-email";

/**
 * Every email the app can send. `sendEmail` takes a key of this object and the
 * matching params, so a template that does not exist — or params that do not
 * match it — is a type error rather than a message nobody receives.
 *
 * The key is also what lands in `email_log.template`, which is how "why didn't
 * that email arrive?" gets an answer inside the app.
 */
export const EMAIL_TEMPLATES = {
  "verify-email": verifyEmail,
  "reset-password": resetPassword,
  "drone-approved": droneApproved,
  "drone-rejected": droneRejected,
  "drone-expiring": droneExpiring,
  "drone-expired": droneExpired,
  "booking-approved": bookingApproved,
  "booking-rejected": bookingRejected,
  "booking-cancelled-by-authority": bookingCancelledByAuthority,
  "booking-reminder": bookingReminder,
  "review-queue-digest": reviewQueueDigest,
} as const;

export type EmailTemplateName = keyof typeof EMAIL_TEMPLATES;

/** The params each template needs, derived from its own `sample`. */
export type EmailTemplateParams = {
  [K in EmailTemplateName]: (typeof EMAIL_TEMPLATES)[K]["sample"];
};

export const EMAIL_TEMPLATE_NAMES = Object.keys(
  EMAIL_TEMPLATES,
) as EmailTemplateName[];
