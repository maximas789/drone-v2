import { cron } from "inngest";
import { sweepRateLimitBuckets } from "@/lib/rate-limit";
import { inngest } from "../client";
import { CRON_SCHEDULES, riyadhCron } from "../rules";

/**
 * Nightly: drop `rate_limit_bucket` rows whose window has long since closed.
 *
 * F09 wrote the sweep and had nowhere to call it from; this is that caller. The
 * counter itself is correct without it — a stale bucket is never read, because
 * every key carries its window start — so this is housekeeping, not enforcement.
 *
 * Better Auth's own `rate_limit` table is **not** swept here. It is the
 * framework's table, with the framework's key format, and reaching into it is
 * how a future upgrade breaks silently.
 */
export const rateLimitSweep = inngest.createFunction(
  {
    id: "rate-limit-sweep",
    name: "Rate limit sweep",
    triggers: [cron(riyadhCron(CRON_SCHEDULES["rate-limit-sweep"]))],
  },
  async ({ step }) => {
    const deleted = await step.run("sweep", () => sweepRateLimitBuckets());
    return { deleted };
  },
);
