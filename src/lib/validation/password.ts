/**
 * How short a password may be.
 *
 * **8, because that is what the server enforces.** `src/lib/auth.ts` does not
 * set `minPasswordLength`, so Better Auth's default applies — and this constant
 * exists to stop three forms each declaring their own idea of the number. It
 * was literally `const MIN_PASSWORD_LENGTH = 8` in `sign-up-form.tsx` and again
 * in `reset-password-form.tsx`; F28b's change-password form would have been the
 * third copy, and three copies is where one of them starts drifting.
 *
 * **A client-side `minLength` is a courtesy, not a rule.** The check that
 * matters is Better Auth's, which answers `PASSWORD_TOO_SHORT`; every form here
 * maps that code through `authErrorKey` so a password that slips past the
 * attribute still reads as a sentence rather than as a generic failure.
 *
 * If `minPasswordLength` is ever set in `src/lib/auth.ts`, change it here in
 * the same commit — a form that permits less than the server accepts rejects
 * people after they have typed everything twice.
 */
export const MIN_PASSWORD_LENGTH = 8;
