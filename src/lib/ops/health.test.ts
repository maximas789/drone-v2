import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sameOrigin } from "./origin";
import { LOCALES } from "@/lib/locale";

/**
 * **The criterion this file exists for: no secret value, prefix, or last four
 * appears anywhere on the system page.**
 *
 * That cannot be checked by rendering the page — the page only leaks if a
 * secret happens to be set, and on this machine most are not. So it is checked
 * against the *source*: the two checks that read a secret must never let the
 * value reach a variable, a `detail` field, or a message.
 *
 * A "helpful" masked prefix is still a leak, and this is the one page an
 * administrator is most likely to screenshot when asking somebody for help.
 */

const HEALTH = readFileSync("src/lib/ops/health.ts", "utf8");

/** Environment names that hold a secret, as opposed to a URL or a flag. */
const SECRETS = [
  "ID_HASH_PEPPER",
  "RESEND_API_KEY",
  "BLOB_READ_WRITE_TOKEN",
  "RATE_LIMIT_PEPPER",
  "INNGEST_EVENT_KEY",
  "INNGEST_SIGNING_KEY",
  "POSTGRES_URL",
];

describe("secrets never leave the health check", () => {
  /**
   * Every mention of a secret in this module must be inside a `Boolean(...)`,
   * a truthiness test, or absent entirely — never assigned, sliced, or put in
   * a `detail`. The regex looks for the shapes a leak takes: assignment to a
   * name, `.slice(`, and template interpolation.
   */
  it("never reads a secret's value into anything", () => {
    for (const name of SECRETS) {
      const uses = [...HEALTH.matchAll(new RegExp(`process\\.env\\.${name}`, "g"))];
      for (const use of uses) {
        const line = HEALTH.slice(
          HEALTH.lastIndexOf("\n", use.index) + 1,
          HEALTH.indexOf("\n", use.index),
        );
        // Allowed: a bare truthiness test. Anything that keeps the value is not.
        expect(line, `${name} is used as a value in health.ts`).not.toMatch(
          /=\s*process\.env|\.slice\(|\$\{process\.env|value:\s*process\.env/,
        );
      }
    }
  });

  /**
   * The pepper check specifically: it is the one secret the page reports on, so
   * it is the one somebody would "improve" by showing a prefix.
   */
  it("reports the pepper as present or absent and nothing else", () => {
    const block = HEALTH.slice(HEALTH.indexOf("function checkPepper"));
    const body = block.slice(0, block.indexOf("\n}"));
    expect(body).toContain("process.env.ID_HASH_PEPPER");
    expect(body).not.toMatch(/slice|substring|detail/);
  });

  /**
   * `APP_URL` and `BETTER_AUTH_URL` **are** printed in full, and that is
   * deliberate — they are URLs, and the entire failure the page exists to catch
   * is somebody not being able to see what they say. Asserted so that a future
   * tidy-up which "masks all environment values" is a red test rather than a
   * silent removal of the check's whole point.
   */
  it("still prints the two URLs in full", () => {
    expect(HEALTH).toContain("detail: { value }");
  });
});

describe("sameOrigin", () => {
  it("ignores a trailing slash and a path", () => {
    expect(sameOrigin("http://localhost:3001", "http://localhost:3001/")).toBe(
      true,
    );
    expect(
      sameOrigin("https://ajniha.example/app", "https://ajniha.example"),
    ).toBe(true);
  });

  it("separates scheme, host and port", () => {
    expect(sameOrigin("http://localhost:3001", "http://localhost:3000")).toBe(
      false,
    );
    expect(sameOrigin("http://localhost:3001", "https://localhost:3001")).toBe(
      false,
    );
    expect(sameOrigin("http://localhost:3001", "http://example.com")).toBe(
      false,
    );
  });

  /**
   * A malformed value is **not** the same origin as anything. The alternative
   * — throwing — would take the whole page down over a typo in the one
   * environment variable the page is there to report a typo in.
   */
  it("treats an unparseable value as a mismatch, not an error", () => {
    expect(sameOrigin("", "http://localhost:3001")).toBe(false);
    expect(sameOrigin("localhost:3001", "http://localhost:3001")).toBe(false);
  });
});

describe("the ops catalogue", () => {
  /**
   * Every check id and every consequence key named in the source must exist in
   * both catalogues. next-intl renders a missing key as the key itself, so the
   * failure is an operator reading `ops.consequence.appUrlMismatch` on the page
   * that is supposed to be telling them their stickers are dead.
   */
  it("has a title, a description and every consequence, in both languages", () => {
    const ids = [...HEALTH.matchAll(/id:\s*"([a-zA-Z]+)"/g)].map((m) => m[1]);
    const consequences = [
      ...HEALTH.matchAll(/consequence:\s*"([a-zA-Z]+)"/g),
    ].map((m) => m[1]);

    expect(ids.length).toBeGreaterThan(0);
    expect(consequences.length).toBeGreaterThan(0);

    for (const locale of LOCALES) {
      const messages = JSON.parse(
        readFileSync(`messages/${locale}.json`, "utf8"),
      ) as {
        ops: {
          check: Record<string, { title?: string; what?: string }>;
          consequence: Record<string, string>;
        };
      };

      for (const id of new Set(ids)) {
        expect(messages.ops.check[id]?.title, `${locale} check.${id}.title`).toBeTruthy();
        expect(messages.ops.check[id]?.what, `${locale} check.${id}.what`).toBeTruthy();
      }
      for (const key of new Set(consequences)) {
        expect(
          messages.ops.consequence[key],
          `${locale} consequence.${key}`,
        ).toBeTruthy();
      }
    }
  });
});
