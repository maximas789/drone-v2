import { describe, expect, it } from "vitest";
import ar from "@/../messages/ar.json";
import en from "@/../messages/en.json";
import { REASON_CODES } from "./types";

/**
 * **Every refusal the engine can emit must be sayable in both languages.**
 *
 * `i18n:check` compares the two catalogues against each other — it cannot know
 * that `broadcast_rid_required` is a code the engine actually produces. This is
 * the other half: it compares the catalogues against the code. A reason with no
 * message renders as a raw key like `airspace.reasons.slot_full` to a pilot who
 * has just been refused, in the one moment they most need a sentence.
 */

const catalogues = { ar: ar.airspace, en: en.airspace };

describe("reason codes and the message catalogues", () => {
  for (const [locale, airspace] of Object.entries(catalogues)) {
    it(`has a reason and a fix for every code in ${locale}`, () => {
      const reasons = airspace.reasons as Record<string, string>;
      const fixes = airspace.fixes as Record<string, string>;

      const missingReasons = REASON_CODES.filter((code) => !reasons[code]);
      const missingFixes = REASON_CODES.filter((code) => !fixes[code]);

      expect(missingReasons).toEqual([]);
      expect(missingFixes).toEqual([]);
    });

    it(`carries no message in ${locale} for a code the engine cannot emit`, () => {
      /**
       * The other direction. A leftover key is a rule somebody removed from the
       * engine and left in the catalogue — which reads to the next person as a
       * refusal the app can still give.
       */
      const known = new Set<string>(REASON_CODES);
      expect(
        Object.keys(airspace.reasons).filter((key) => !known.has(key)),
      ).toEqual([]);
      expect(
        Object.keys(airspace.fixes).filter((key) => !known.has(key)),
      ).toEqual([]);
    });
  }

  it("uses the same ICU placeholders in both languages", () => {
    /**
     * `i18n:check` already does this across the whole catalogue; repeating it
     * here for the reason namespace specifically is what makes the *engine's*
     * params — `{ceiling}`, `{hours}`, `{nextOpen}` — a tested contract rather
     * than a coincidence.
     */
    const placeholders = (message: string) =>
      [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

    for (const code of REASON_CODES) {
      expect(placeholders(ar.airspace.reasons[code])).toEqual(
        placeholders(en.airspace.reasons[code]),
      );
      expect(placeholders(ar.airspace.fixes[code])).toEqual(
        placeholders(en.airspace.fixes[code]),
      );
    }
  });
});
