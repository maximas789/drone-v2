import { getSession } from "@/lib/auth-guards";
import { canReadStoredFile } from "@/lib/data/upload";
import { readFile } from "@/lib/storage";
import { sniffType } from "@/lib/storage/validate";

/**
 * `GET /api/files/{pathname}` — the only way to read a stored file, in **both**
 * drivers.
 *
 * The local driver could have written into `public/`, and the blob driver could
 * have handed out its own URL. Either would mean the ownership rule holds in
 * one environment and not the other; this way it is written once and both
 * behave identically.
 *
 * **Everything answers 404.** Signed out, not yours, no such row, no such
 * file — one status, because the alternative tells a stranger which pathnames
 * are real. It is also what makes a deleted photo's URL stop working: nothing
 * claims that pathname any more, so nobody may read it.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/files/[...path]">,
) {
  const { path } = await ctx.params;
  const pathname = path.join("/");

  const session = await getSession();
  if (!session) return notFound();

  if (!(await canReadStoredFile(session, pathname))) return notFound();

  const stored = await readFile(pathname);
  if (!stored) return notFound();

  /**
   * The type is **re-sniffed from the bytes on the way out**, not read from a
   * column. Whatever was stored, the browser is told what it actually is —
   * so a file that somehow got past the upload check cannot be served as
   * something the browser will execute.
   */
  const type = sniffType(stored.body);
  if (!type) return notFound();

  return new Response(new Uint8Array(stored.body), {
    headers: {
      "Content-Type": type,
      "Content-Length": String(stored.body.byteLength),
      /**
       * Private: this response was authorised for **one** session, and a shared
       * cache holding it would serve another pilot's photograph to whoever
       * asked next.
       */
      "Cache-Control": "private, max-age=0, must-revalidate",
      // Belt and braces against a crafted PDF: never let the browser sniff.
      "X-Content-Type-Options": "nosniff",
      // A PDF renders inline; nothing here is ever a download prompt for a
      // filename we would then have to sanitise.
      "Content-Disposition": "inline",
    },
  });
}

function notFound() {
  return new Response(null, { status: 404 });
}
