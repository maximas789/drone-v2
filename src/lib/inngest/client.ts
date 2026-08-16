import { Inngest } from "inngest";
import { JobsTableMiddleware } from "./jobs-table";

/**
 * The Inngest client.
 *
 * **No keys are required in development.** `npx inngest-cli dev` discovers
 * `/api/inngest`, and every function is runnable from its dashboard — which is
 * the whole reason jobs are on Inngest rather than on a cron somewhere nobody
 * can see. `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` are read from the
 * environment by the SDK itself when they exist, so nothing here names them.
 *
 * The app id is what groups these functions in Inngest Cloud. Changing it would
 * orphan every registered function, so it does not change.
 */
export const inngest = new Inngest({
  id: "ajniha",
  middleware: [JobsTableMiddleware],
  /**
   * **Not inferred from `NODE_ENV`.** Without this the SDK starts in cloud mode,
   * finds no signing key and answers every request to `/api/inngest` with a 500
   * — including the introspection the dev CLI uses to discover the app, so the
   * symptom is "the dashboard lists no functions" rather than anything naming a
   * key. The documented switch is the `INNGEST_DEV` env var; deriving it here
   * means a fresh clone works with no env at all, and a production build still
   * demands a real signing key.
   */
  isDev: process.env.NODE_ENV !== "production",
});
