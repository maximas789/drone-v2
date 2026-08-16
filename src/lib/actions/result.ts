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

/**
 * A refusal that carries values for the message it maps to — a countdown, a
 * limit, a zone name.
 *
 * Params are **data, not prose**: they are interpolated into whichever
 * catalogue the reader is using, so the refusal still reads correctly in the
 * other language. Anything already turned into a sentence belongs in the
 * catalogue instead.
 *
 * Numbers passed here must be **pre-formatted through `src/lib/format.ts`** if
 * they will be interpolated into a message. ICU formats a bare numeric
 * argument itself, and under `ar` that means Arabic-Indic digits — the exact
 * thing `format.ts` exists to prevent, arriving by a route the ESLint rule
 * cannot see.
 */
export function refuseWith(
  code: string,
  params: Record<string, string | number>,
): { ok: false; reasons: Reason[] } {
  return { ok: false, reasons: [{ code, params }] };
}
