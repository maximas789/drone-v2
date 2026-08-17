import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-guards";
import { toJsonBody } from "@/lib/remote-id/redact";
import { resolveRemoteId } from "@/lib/remote-id/resolve";

/**
 * `GET /api/rid/[code]` — the JSON twin of the scan page, for a future
 * field-inspector app.
 *
 * **It calls `resolveRemoteId` and nothing else**, so the field set it returns
 * is the page's by construction rather than by promise. A route that built its
 * own query is the one way a national ID reaches an anonymous caller, and this
 * file exists in the shape it does to make that impossible rather than
 * unlikely.
 *
 * Every resolution is rate-limited and written to `remote_id_scan`, exactly as
 * the page's is — the API is not a quieter door to the same data.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/rid/[code]">,
) {
  const { code } = await params;
  const session = await getSession();

  const outcome = await resolveRemoteId({
    rawCode: decodeURIComponent(code),
    session,
    headers: await headers(),
  });

  if (outcome.ok) {
    return NextResponse.json(
      { ok: true, data: toJsonBody(outcome.view) },
      {
        // Never cached, by anything. A response shaped for a reviewer must not
        // be handed to the next anonymous caller by an intermediary.
        headers: { "cache-control": "no-store, private" },
      },
    );
  }

  if (outcome.reason === "rate_limited") {
    return NextResponse.json(
      {
        ok: false,
        reasons: [
          {
            code: "rate_limited",
            params: { retryAfterSeconds: outcome.retryAfterSeconds },
          },
        ],
      },
      {
        status: 429,
        headers: {
          "retry-after": String(outcome.retryAfterSeconds),
          "cache-control": "no-store, private",
        },
      },
    );
  }

  /**
   * **200, not 404** — the same call the page makes. "This code is not
   * registered" is an answer, and the inspector app has to render it as one;
   * a 404 would send it down an error path for a working request. `ok: false`
   * plus a machine-readable reason is how every refusal in this codebase
   * travels.
   */
  return NextResponse.json(
    { ok: false, reasons: [{ code: outcome.reason }], data: { code: outcome.code } },
    { headers: { "cache-control": "no-store, private" } },
  );
}
