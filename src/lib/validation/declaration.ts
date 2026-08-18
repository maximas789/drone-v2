/**
 * What a pilot may claim about a Remote ID module, and what makes the claim
 * usable.
 *
 * **Pure, and deliberately not in `src/lib/actions/remote-id.ts`.** That file
 * is `"use server"`, and a `"use server"` module may export *only* async
 * functions: Next wraps every export as a server reference, so a plain array
 * exported from it reaches the browser as a callable proxy rather than an
 * array. `DECLARATION_KINDS.map is not a function` — thrown at render, with
 * `typecheck`, `lint` and `test` all green, because the types say `readonly
 * string[]` and the erasure happens at the bundler. Found by opening the form.
 *
 * Same split as `validation/drone.ts` and `rate-limit/rules.ts`: the rule lives
 * where a client component can ask it, and the action enforces it.
 */

/**
 * The module kinds. Stored as **codes** and translated at render, like every
 * other enumerable value — mirroring `remoteIdDeclKind` in `db/enums.ts`, which
 * is the column these are written to.
 */
export const DECLARATION_KINDS = [
  "faa_broadcast_module",
  "gaca_dri",
  "gaca_nri",
  "other",
] as const;

export type DeclarationKind = (typeof DECLARATION_KINDS)[number];

export const DECLARATION_FIELD_MAX_LENGTH = 200;

export function isDeclarationKind(value: unknown): value is DeclarationKind {
  return (
    typeof value === "string" &&
    (DECLARATION_KINDS as readonly string[]).includes(value)
  );
}

export type DeclarationInput = {
  kind: string;
  manufacturer?: string | null;
  moduleSerial?: string | null;
  docReference?: string | null;
};

export type DeclarationFields = {
  kind: DeclarationKind;
  manufacturer: string | null;
  moduleSerial: string | null;
  docReference: string | null;
};

export type DeclarationVerdict =
  | { ok: true; fields: DeclarationFields }
  | { ok: false; codes: string[] };

/**
 * `null` for an empty string, so "the pilot left it blank" and "the pilot typed
 * spaces" are the same row — a column holding `"   "` reads as a value nobody
 * can see.
 */
function trimmed(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

/**
 * A declaration has to **identify a module**, not merely assert that one
 * exists. A row carrying only a kind says "there is a broadcast module on this
 * aircraft" with nothing a reviewer can check and nothing an inspector can
 * match against the hardware — so at least one of manufacturer, serial or
 * certificate reference is required.
 */
export function validateDeclaration(input: DeclarationInput): DeclarationVerdict {
  const codes: string[] = [];

  if (!isDeclarationKind(input.kind)) codes.push("declaration_kind_required");

  const manufacturer = trimmed(input.manufacturer);
  const moduleSerial = trimmed(input.moduleSerial);
  const docReference = trimmed(input.docReference);

  const tooLong = [manufacturer, moduleSerial, docReference].some(
    (value) => value !== null && value.length > DECLARATION_FIELD_MAX_LENGTH,
  );
  if (tooLong) codes.push("declaration_too_long");

  if (!manufacturer && !moduleSerial && !docReference) {
    codes.push("declaration_empty");
  }

  if (codes.length > 0) return { ok: false, codes };

  return {
    ok: true,
    fields: {
      kind: input.kind as DeclarationKind,
      manufacturer,
      moduleSerial,
      docReference,
    },
  };
}
