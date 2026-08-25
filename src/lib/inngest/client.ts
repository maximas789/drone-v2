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
   * **Derived, but still overridable.** Left to itself the SDK starts in cloud
   * mode, finds no signing key and answers every request to `/api/inngest` with
   * a 500 — including the introspection the dev CLI uses to discover the app,
   * so the symptom is "the dashboard lists no functions" rather than anything
   * naming a key. Deriving it from `NODE_ENV` means a fresh clone works with no
   * env at all, and a production build still demands a real signing key.
   *
   * **`INNGEST_DEV` wins when it is set**, because passing `isDev` at all
   * silently disables the SDK's own documented switch — and a `next start`,
   * which is the only serve F31 tests against, could therefore never run a job
   * against a local dev server no matter what the environment said. That cost a
   * session's time to find: the flag was set, the log kept printing "set the
   * INNGEST_DEV env var", and the value being ignored was this line.
   *
   * `INNGEST_DEV=0` forces cloud mode; any other value forces dev.
   */
  isDev:
    process.env.INNGEST_DEV === undefined || process.env.INNGEST_DEV === ""
      ? process.env.NODE_ENV !== "production"
      : process.env.INNGEST_DEV !== "0",
});
