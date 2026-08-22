import type { Locale } from "@/lib/locale";

/**
 * The handful of facts in the legal pages that **only a human can decide**.
 *
 * They live here rather than in the prose so that changing the contact address
 * or the effective date is one edit to one file, instead of a search through
 * four `.mdx` documents in two languages for the four places it was typed.
 * `mdx-components.tsx` exposes each one as a component (`<ContactEmail />`,
 * `<Org />`), which is what keeps them out of the prose in practice rather than
 * in principle — a value that is awkward to hard-code is a value nobody
 * hard-codes.
 *
 * **Ajniha is a proposal, not a company.** `ORGANISATION_NAME` is the project's
 * own name and nothing more: inventing a legal entity, a commercial register
 * number or a Riyadh street address would be exactly the fabricated
 * credibility the honesty rules ban, and a privacy policy is the last document
 * in the app that should contain a comfortable-sounding lie.
 */

/** Where a data-subject request, or anything else, actually reaches a person. */
export const CONTACT_EMAIL = "alshar044@gmail.com";

/**
 * Paired `ar` / `en`, like every other piece of human-authored content in this
 * app — these are sentences a translator writes, not codes to look up.
 */
export const ORGANISATION_NAME: Record<Locale, string> = {
  ar: "أجنحة",
  en: "Ajniha",
};

export const GOVERNING_LAW: Record<Locale, string> = {
  ar: "أنظمة المملكة العربية السعودية",
  en: "the laws of the Kingdom of Saudi Arabia",
};

export const JURISDICTION: Record<Locale, string> = {
  ar: "الرياض، المملكة العربية السعودية",
  en: "Riyadh, Kingdom of Saudi Arabia",
};

/**
 * The date these documents took effect — **set by hand, and deliberately not
 * derived from git.**
 *
 * F26's documentation pages read their "last updated" line from the committer
 * date of the file, precisely so that nobody has to remember to maintain it.
 * A legal document is the opposite case: its date is a claim about when a
 * *policy* changed, and a commit that fixes a typo in the Arabic must not
 * announce itself to every reader as a new version of the privacy policy.
 *
 * Midnight in Riyadh, so the date renders as the day it says in both locales
 * rather than shifting backwards for a reader whose clock is behind UTC+3.
 */
export const EFFECTIVE_DATE = new Date("2026-08-22T00:00:00+03:00");
