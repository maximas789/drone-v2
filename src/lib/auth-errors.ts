/**
 * Better Auth answers with a machine-readable `code`; the reader gets a
 * translated sentence. Same principle as the rest of the app — codes are
 * stored and passed around, never rendered strings.
 *
 * Keys are relative to the `auth` namespace in `messages/{ar,en}.json`.
 */
const MESSAGE_KEY_BY_CODE: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "errorInvalidCredentials",
  INVALID_PASSWORD: "errorInvalidCredentials",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "errorInvalidCredentials",
  // Deliberately the same message as a wrong password: a distinct "no such
  // account" reply turns the sign-in form into an address checker.
  USER_NOT_FOUND: "errorInvalidCredentials",

  USER_ALREADY_EXISTS: "errorEmailTaken",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "errorEmailTaken",

  PASSWORD_TOO_SHORT: "errorPasswordTooShort",

  INVALID_TOKEN: "resetTokenMissing",
  TOKEN_EXPIRED: "resetTokenMissing",
};

export function authErrorKey(code: string | undefined): string {
  if (!code) return "errorGeneric";
  return MESSAGE_KEY_BY_CODE[code] ?? "errorGeneric";
}

/**
 * `next=` comes off the URL, so it is attacker-controlled. Anything that isn't
 * a single-slash local path is an open redirect and gets dropped.
 */
export function safeNextPath(value: string | undefined | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
