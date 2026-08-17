/**
 * Saudi mobile numbers. **Pure** — same reasoning as `./saudi-id.ts`.
 *
 * **Format only.** Nothing here verifies that a number reaches a handset, and
 * nothing in this app ever will: SMS and OTP are explicitly out of scope, and
 * `pilot_profile` deliberately has no `mobileVerifiedAt` column. A number that
 * passed this check is a *well-formed* number a pilot typed, and the UI must
 * never dress that up as a verified one.
 *
 * The contact detail matters anyway: it is how a reviewer or an authority
 * reaches the operator of an aircraft that is in the air right now.
 */

/**
 * `+9665XXXXXXXX`. Every Saudi mobile prefix is `05` nationally, which is `+9665`
 * in E.164, followed by eight more digits.
 */
const E164_SAUDI_MOBILE = /^\+9665\d{8}$/;

/**
 * Arabic-Indic and Persian digits become ASCII, and the separators people type
 * into a phone field go. See `normalizeIdNumber` — the same three problems, and
 * a pilot typing on an Arabic keyboard hits them here first.
 */
const DISCARDED_IN_MOBILE = new Set([
  " ",
  "\t",
  "-",
  "(",
  ")",
  "‎", // left-to-right mark
  "‏", // right-to-left mark
]);

function digitsOf(raw: string): string {
  return [...raw]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;
      if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
      if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
      return DISCARDED_IN_MOBILE.has(character) ? "" : character;
    })
    .join("");
}

/**
 * The three spellings a Saudi pilot actually types, reduced to one stored form.
 *
 * `0501234567`, `00966501234567` and `+966501234567` are the same number, and
 * refusing the first two would refuse the way almost everybody writes it
 * locally. **A non-Saudi number is not rewritten into one** — `+14155551234`
 * comes back unchanged and then fails the format check, which is the honest
 * outcome: this app registers pilots flying in Saudi airspace and a reviewer
 * needs a number they can actually reach.
 *
 * Returns `null` when there is nothing number-shaped at all.
 */
export function normalizeSaudiMobile(raw: string): string | null {
  const cleaned = digitsOf(raw.trim());
  if (cleaned.length === 0) return null;

  // `00` is the international prefix outside North America; `+` is the same
  // thing written the way E.164 wants it.
  const withPlus = cleaned.startsWith("00")
    ? `+${cleaned.slice(2)}`
    : cleaned.startsWith("+")
      ? cleaned
      : // A bare national number: `05…` → `+9665…`. Only the leading zero is
        // dropped, and only when what follows looks Saudi.
        /^05\d{8}$/.test(cleaned)
        ? `+966${cleaned.slice(1)}`
        : /^9665\d{8}$/.test(cleaned)
          ? `+${cleaned}`
          : cleaned;

  return withPlus;
}

/** Whether a **normalised** number is a Saudi mobile in E.164. */
export function isSaudiMobile(value: string): boolean {
  return E164_SAUDI_MOBILE.test(value);
}

export type MobileVerdict =
  | { ok: true; e164: string }
  | { ok: false; problem: "mobile_format" };

export function validateSaudiMobile(raw: string): MobileVerdict {
  const normalized = normalizeSaudiMobile(raw);
  if (!normalized || !isSaudiMobile(normalized)) {
    return { ok: false, problem: "mobile_format" };
  }
  return { ok: true, e164: normalized };
}
