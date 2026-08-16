/**
 * The shape every server action returns.
 *
 * **Refusals are never exceptions.** A refused action is an ordinary answer
 * with machine-readable codes, translated at render — so the same refusal
 * reads correctly in Arabic and in English, and a caller can branch on the
 * code rather than on a string.
 *
 * A thrown error means something broke; it does not mean "no".
 */
export type Reason = {
  code: string;
  /** Optional ICU params for the message the code maps to. */
  params?: Record<string, string | number>;
};

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; reasons: Reason[] };

export function refuse(...codes: string[]): { ok: false; reasons: Reason[] } {
  return { ok: false, reasons: codes.map((code) => ({ code })) };
}
