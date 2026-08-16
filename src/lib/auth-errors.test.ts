import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { authErrorKey, safeNextPath } from "@/lib/auth-errors";

const catalogue = (locale: string) =>
  JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")).auth as Record<
    string,
    string
  >;

describe("authErrorKey", () => {
  it("maps the codes Better Auth actually returns", () => {
    expect(authErrorKey("INVALID_EMAIL_OR_PASSWORD")).toBe(
      "errorInvalidCredentials",
    );
    expect(authErrorKey("USER_ALREADY_EXISTS")).toBe("errorEmailTaken");
    expect(authErrorKey("PASSWORD_TOO_SHORT")).toBe("errorPasswordTooShort");
    expect(authErrorKey("INVALID_TOKEN")).toBe("resetTokenMissing");
    expect(authErrorKey("TOKEN_EXPIRED")).toBe("resetTokenMissing");
  });

  /**
   * A distinct "no such account" message turns the sign-in form into an address
   * checker: anyone could enumerate who holds an Ajniha account by watching
   * which errors come back. The two must stay indistinguishable to the reader.
   */
  it("does not distinguish an unknown account from a wrong password", () => {
    expect(authErrorKey("USER_NOT_FOUND")).toBe(
      authErrorKey("INVALID_EMAIL_OR_PASSWORD"),
    );
    expect(authErrorKey("CREDENTIAL_ACCOUNT_NOT_FOUND")).toBe(
      authErrorKey("INVALID_EMAIL_OR_PASSWORD"),
    );
  });

  it("falls back to a generic message for anything unmapped", () => {
    expect(authErrorKey(undefined)).toBe("errorGeneric");
    expect(authErrorKey("")).toBe("errorGeneric");
    expect(authErrorKey("SOME_FUTURE_CODE")).toBe("errorGeneric");
  });

  /**
   * A code mapped to a key that doesn't exist renders as a raw key — or throws
   * — in whichever locale nobody on the team reads. `i18n:check` compares the
   * two catalogues against each other and cannot catch this.
   */
  it("only ever returns keys that exist in both catalogues", () => {
    const ar = catalogue("ar");
    const en = catalogue("en");

    const codes = [
      "INVALID_EMAIL_OR_PASSWORD",
      "INVALID_PASSWORD",
      "CREDENTIAL_ACCOUNT_NOT_FOUND",
      "USER_NOT_FOUND",
      "USER_ALREADY_EXISTS",
      "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
      "PASSWORD_TOO_SHORT",
      "INVALID_TOKEN",
      "TOKEN_EXPIRED",
      "ANYTHING_UNMAPPED",
      undefined,
    ];

    for (const code of codes) {
      const key = authErrorKey(code);
      expect(ar, `ar is missing auth.${key}`).toHaveProperty(key);
      expect(en, `en is missing auth.${key}`).toHaveProperty(key);
    }
  });

  // Keys the forms use directly, without going through authErrorKey.
  it.each(["errorPasswordMismatch", "errorPasswordTooShort"])(
    "has %s in both catalogues",
    (key) => {
      expect(catalogue("ar")).toHaveProperty(key);
      expect(catalogue("en")).toHaveProperty(key);
    },
  );
});

describe("safeNextPath", () => {
  it("passes a local path through", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/drones/abc?tab=photos")).toBe("/drones/abc?tab=photos");
    expect(safeNextPath("/")).toBe("/");
  });

  /**
   * `next=` arrives on the URL, so it is attacker-controlled. A protocol-relative
   * `//host` is the one that catches people out: it starts with a slash and
   * still navigates off-site.
   */
  it.each([
    ["protocol-relative", "//evil.example"],
    ["protocol-relative with path", "//evil.example/pwn"],
    ["absolute https", "https://evil.example"],
    ["absolute http", "http://evil.example"],
    ["a bare word", "dashboard"],
    ["empty", ""],
    ["undefined", undefined],
    ["null", null],
  ])("refuses %s", (_label, value) => {
    expect(safeNextPath(value)).toBeNull();
  });
});
