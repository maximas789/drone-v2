import { createHash } from "node:crypto";

/**
 * `sha256(ID_HASH_PEPPER + number)`.
 *
 * **Why the number is stored in plaintext *and* hashed.** A reviewer has to
 * read the number off the screen and compare it with the document in front of
 * them, so it cannot be a one-way hash. But `id_document_number` must not carry
 * a UNIQUE index: a unique index over plaintext identity numbers is a
 * membership oracle — anybody who can provoke a duplicate-key error, or time
 * one, learns whether a given Saudi national ID is registered on this platform.
 * The uniqueness lives on this hash instead, and "this identity is already
 * registered" is all a caller is ever told.
 *
 * **The pepper is what makes the hash worth anything.** Saudi national IDs are
 * ten digits with a check digit, so there are on the order of 10⁹ valid ones —
 * an unpeppered sha256 of every single one is a few minutes of work. With a
 * secret pepper, the table is uncomputable without the secret.
 *
 * **It can never be rotated.** `pilot_profile.id_document_hash` is UNIQUE over
 * this output; change the pepper and every stored hash is orphaned, so "one
 * person, one profile" silently stops holding for everybody who registered
 * before the change. Same rule as `RATE_LIMIT_PEPPER` in `src/lib/ip-hash.ts`,
 * and a worse consequence.
 *
 * The input must already be normalised — `normalizeIdNumber` in
 * `src/lib/validation/saudi-id.ts`. Two spellings of one number that reach this
 * function differently are two profiles for one person, which is the exact
 * thing the unique index exists to prevent.
 */
export function hashIdDocument(normalizedNumber: string): string {
  const pepper = process.env.ID_HASH_PEPPER;

  if (!pepper) {
    // Loud, and refusing to write. There is no safe fallback: an unpeppered
    // hash is reversible by brute force, and a constant would collapse every
    // pilot into one hash and let the unique index refuse the second person to
    // register.
    throw new Error(
      "ID_HASH_PEPPER is not set. Generate it once with " +
        `node -e "console.log(crypto.randomBytes(32).toString('base64'))"` +
        " and never regenerate it — rotating it orphans every stored hash.",
    );
  }

  return createHash("sha256").update(`${pepper}${normalizedNumber}`).digest("hex");
}
