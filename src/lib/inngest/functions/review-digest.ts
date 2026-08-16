import { cron } from "inngest";
import { sendEmail } from "@/lib/email/send";
import { localeUrl } from "@/lib/url";
import { inngest } from "../client";
import {
  countPendingForReview,
  lastDigestSentAt,
  listReviewers,
} from "../queries";
import {
  CRON_SCHEDULES,
  digestSuppressedSince,
  digestWorthSending,
  riyadhCron,
} from "../rules";

/**
 * Hourly: how much is waiting in the review queue.
 *
 * **An empty queue sends nothing** — not a "nothing to review" note. A message
 * that arrives every hour regardless is one people filter away, and then the
 * one that mattered is filtered away with it.
 *
 * **No pilot PII leaves this function.** The digest carries two counts and a
 * URL. Whoever widens these params is putting a pilot's nickname or Remote ID
 * code into every reviewer's inbox, where it is outside the app's access rules
 * for good.
 */
export const reviewQueueDigest = inngest.createFunction(
  {
    id: "review-queue-digest",
    name: "Review queue digest",
    triggers: [cron(riyadhCron(CRON_SCHEDULES["review-queue-digest"]))],
  },
  async ({ step }) => {
    const counts = await step.run("count-queue", countPendingForReview);

    if (!digestWorthSending(counts)) {
      return { ...counts, sent: 0, reason: "queue-empty" };
    }

    /**
     * A manual trigger or a retried run half an hour later must not put a
     * second identical summary in every inbox. The last *send* is the question,
     * not the last run — a run that found an empty queue sent nothing and must
     * not suppress this one.
     */
    const suppressed = await step.run("check-recent-digest", async () => {
      const last = await lastDigestSentAt();
      return last !== null && last > digestSuppressedSince(new Date());
    });

    if (suppressed) return { ...counts, sent: 0, reason: "sent-recently" };

    const reviewers = await step.run("list-reviewers", listReviewers);

    let sent = 0;
    for (const reviewer of reviewers) {
      await step.run(`digest-${reviewer.userId}`, async () => {
        await sendEmail({
          to: reviewer.email,
          template: "review-queue-digest",
          locale: reviewer.locale,
          userId: reviewer.userId,
          params: {
            pendingDrones: counts.pendingDrones,
            pendingBookings: counts.pendingBookings,
            queueUrl: localeUrl("/review", reviewer.locale),
          },
        });
      });
      sent += 1;
    }

    return { ...counts, sent, reason: null };
  },
);
