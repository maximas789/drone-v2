import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **"No screen anywhere displays a full national ID without a logged reveal."**
 *
 * F17 states that as an acceptance criterion to be checked by grep. A grep
 * somebody runs once is a claim about the day they ran it, so it is a test
 * instead — the same move F15 made when it scanned the source for notification
 * types a catalogue check could not see.
 *
 * Two properties are pinned, and between them they make the criterion structural
 * rather than a promise:
 *
 * 1. **The mask exists in exactly one place.** If `•••••` appears in a second
 *    file, a second masking rule has been born and the two are free to drift —
 *    which is precisely what F11's "exactly one projection" criterion forbids.
 * 2. **A stored document number never crosses into the browser.** Every page
 *    under `src/app` is a server component; the only ways `idDocumentNumber` may
 *    appear in one are the empty string (a form field that starts blank) and an
 *    argument to `MaskedId`, which masks before it renders. Anything else is a
 *    row's real value being handed to a client component or printed into HTML.
 *
 * The client components under `src/components/profile/` are then safe by
 * construction: the only document numbers they ever hold are the empty string
 * and what the person in front of the screen just typed.
 */

const SOURCE_ROOT = join(process.cwd(), "src");

function filesUnder(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      found.push(...filesUnder(path));
    } else if (/\.tsx?$/.test(path) && !path.endsWith(".test.ts")) {
      found.push(path);
    }
  }
  return found;
}

describe("the identity mask", () => {
  it("is produced in exactly one file", () => {
    const carriers = filesUnder(SOURCE_ROOT).filter((path) =>
      readFileSync(path, "utf8").includes("•••••"),
    );

    // `src/lib/remote-id/redact.ts` — `maskIdDocument`. Nothing else.
    expect(carriers.map((path) => path.replace(SOURCE_ROOT, "").replace(/\\/g, "/"))).toEqual([
      "/lib/remote-id/redact.ts",
    ]);
  });
});

describe("a stored document number never reaches a page's output", () => {
  it("appears in src/app only as an empty field or a MaskedId argument", () => {
    const offenders: string[] = [];

    for (const path of filesUnder(join(SOURCE_ROOT, "app"))) {
      const source = readFileSync(path, "utf8");
      const lines = source.split(/\r?\n/);

      lines.forEach((line, index) => {
        if (!line.includes("idDocumentNumber")) return;

        // A form field that starts blank. The whole point of the page is that it
        // does *not* send the stored value back.
        if (/idDocumentNumber:\s*""/.test(line)) return;
        // Handed to the one component that masks before rendering.
        if (/number=\{[\w.?]*\.idDocumentNumber\}/.test(line)) return;
        // A comment explaining the rule is not a breach of it.
        if (/^\s*(\*|\/\/)/.test(line)) return;

        offenders.push(
          `${path.replace(SOURCE_ROOT, "").replace(/\\/g, "/")}:${index + 1}: ${line.trim()}`,
        );
      });
    }

    expect(offenders).toEqual([]);
  });

  it("finds the two occurrences it expects, so the scan cannot pass vacuously", () => {
    // A scan that matched nothing would pass for ever, including after somebody
    // renamed the column. This asserts the scan is actually looking at the
    // profile pages.
    const seen = filesUnder(join(SOURCE_ROOT, "app")).filter((path) =>
      readFileSync(path, "utf8").includes("idDocumentNumber"),
    );
    expect(seen.length).toBeGreaterThanOrEqual(2);
  });
});
