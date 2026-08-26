/**
 * Email configuration, readable from anywhere on the server.
 *
 * Deliberately free of `server-only` and of any database import: the sign-in
 * and verify pages need to know whether mail actually goes anywhere so they
 * can say so, and `src/lib/auth.ts` has to stay loadable by the Better Auth
 * CLI, which refuses a config that reaches `server-only`.
 *
 * The switch is **the presence of the key**, not `NODE_ENV` and not a mode
 * flag — same rule as uploads. Nothing has to be remembered at deploy time.
 */

/** `false` means: render it, print it to the terminal, log it, send nothing. */
export const emailConfigured = Boolean(process.env.RESEND_API_KEY);

/**
 * Resend's shared sandbox sender works with no domain at all, but only
 * delivers to the address the Resend account was created with. That is the
 * middle state F06 describes, and it is what an unconfigured `EMAIL_FROM`
 * degrades to rather than a hard failure.
 */
const SANDBOX_SENDER = "onboarding@resend.dev";

/**
 * `||` rather than `??`: `EMAIL_FROM=` in a `.env` file is the **empty
 * string**, not undefined, and `??` would keep it — sending every message with
 * a blank `from`, which the provider rejects, while the health page reported
 * the sandbox state instead of a broken one.
 */
export const EMAIL_FROM =
  process.env.EMAIL_FROM?.trim() || `Ajniha <${SANDBOX_SENDER}>`;

/**
 * True when mail would go out through Resend's shared sandbox sender.
 *
 * **The state F06 calls "key present, domain verified" is not the same as "key
 * present".** With a key and no `EMAIL_FROM`, every message is accepted by the
 * provider and delivered only to the Resend account owner — so the operator
 * sees a healthy mail row while every address but their own comes back
 * `failed` with the provider's own reason — which is in the email log, not on
 * the health page. Named here rather than inferred at the health check,
 * because this is the file that owns the default.
 */
export const usingSandboxSender =
  emailConfigured && EMAIL_FROM.includes(SANDBOX_SENDER);
