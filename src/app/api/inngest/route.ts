import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

/**
 * The endpoint Inngest calls to run a function, and the one `npx inngest-cli
 * dev` discovers to list them.
 *
 * **Outside `[locale]` deliberately.** It is machine-to-machine; there is no
 * page, nothing to translate, and putting it under the locale segment would
 * make the URL Inngest registers depend on which language a human was reading.
 *
 * It is **not** guarded by the app's session — Inngest signs its requests, and
 * the SDK verifies the signature with `INNGEST_SIGNING_KEY`. In development
 * there is no key and no signature, which is why the dev server is local-only.
 */
export const { GET, POST, PUT } = serve({ client: inngest, functions });
