import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectLookup,
  partialSymbols,
  toSaudiE164,
  LOGGED_LOOKUP_KINDS,
  MAX_LOOKUP_LENGTH,
} from "@/lib/lookup/detect";
import { CROCKFORD_ALPHABET, normalizeCode } from "@/lib/remote-id/codec";
import { flightAuthorisationOf } from "@/lib/lookup/authorisation";
import type { RedactedRemoteId } from "@/lib/remote-id/redact";

/**
 * The classifier is the half of the lookup that can be silently wrong: it
 * decides which register gets queried, and a misclassification answers "no
 * registration found" about an aircraft that is registered — the one wrong
 * answer this tool must never give.
 */

describe("detectLookup — a whole code, however it was spelled", () => {
  const CANONICAL = "AJN-4F2K-91XZ";

  it.each([
    ["AJN-4F2K-91XZ", "canonical"],
    ["ajn 4f2k 91xz", "lower case, spaces for dashes"],
    ["AJN4F2K91XZ", "no separators at all"],
    ["  ajn-4f2k-91xz  ", "surrounding whitespace"],
    ["4F2K91XZ", "no prefix"],
    ["AJN_4F2K_91XZ", "underscores off a filename"],
  ])("%s resolves to the same code (%s)", (input) => {
    expect(detectLookup(input)).toEqual({ kind: "code", code: CANONICAL });
  });

  it("maps a misread O for 0 and I for 1", () => {
    // `AJN-DEM0-CARD` is the reserved demo code; `O` for the zero and `I`
    // nowhere in it, so use a code that exercises both substitutions.
    expect(detectLookup("AJN-4F2K-9IXZ")).toEqual({
      kind: "code",
      code: CANONICAL,
    });
    expect(detectLookup("ajn 4f2k 9oxz")).toEqual({
      kind: "code",
      code: "AJN-4F2K-90XZ",
    });
    expect(detectLookup("AJN-4F2K-9LXZ")).toEqual({
      kind: "code",
      code: CANONICAL,
    });
    expect(detectLookup("AJN-4F2K-9UXZ")).toEqual({
      kind: "code",
      code: "AJN-4F2K-9VXZ",
    });
  });

  it("is code-first — a valid code is never read as free text", () => {
    // Every symbol here is also a plain letter or digit, so nothing but the
    // ordering of the checks stops this being classified as a name.
    for (const input of ["AJN-DEM0-CARD", "ajndem0card", "DEM0CARD"]) {
      expect(detectLookup(input).kind).toBe("code");
    }
  });
});

describe("detectLookup — a fragment of a code", () => {
  it("reads the last four symbols as a partial", () => {
    expect(detectLookup("91XZ")).toEqual({ kind: "partial", symbols: "91XZ" });
  });

  it("normalises a fragment exactly as a whole code is normalised", () => {
    expect(detectLookup("9IXZ")).toEqual({ kind: "partial", symbols: "91XZ" });
    expect(detectLookup("9oxz")).toEqual({ kind: "partial", symbols: "90XZ" });
  });

  it("strips an AJN prefix from a fragment", () => {
    expect(detectLookup("AJN-4F2K")).toEqual({
      kind: "partial",
      symbols: "4F2K",
    });
  });

  it("accepts three to seven symbols and nothing outside that", () => {
    expect(detectLookup("4F2").kind).toBe("partial");
    expect(detectLookup("4F2K91X").kind).toBe("partial");
    // Two is not a search, it is half the register.
    expect(detectLookup("4F").kind).not.toBe("partial");
    // Eight is a whole code.
    expect(detectLookup("4F2K91XZ").kind).toBe("code");
  });

  it("refuses a fragment carrying a symbol outside the alphabet", () => {
    // `AMBIGUOUS` maps I/L/O/U; every other letter absent from Crockford —
    // there are none — would fail. A non-alphanumeric is stripped, so the
    // realistic failure is a fragment that is not a fragment at all.
    expect(partialSymbols("!!!")).toBeNull();
  });

  it("agrees with normalizeCode on every symbol it maps", () => {
    /**
     * `codec.ts` keeps its ambiguity table private and `partialSymbols` carries
     * its own copy. This is what stops the two drifting: every symbol a whole
     * code accepts, a fragment must accept identically.
     */
    for (const symbol of [...CROCKFORD_ALPHABET, "I", "L", "O", "U"]) {
      const whole = normalizeCode(`${symbol}${"0".repeat(7)}`);
      const fragment = partialSymbols(`${symbol}00`);
      expect(fragment).not.toBeNull();
      expect(whole).not.toBeNull();
      // The first symbol of the canonical code is the mapped one.
      expect(fragment?.[0]).toBe(whole?.slice(4, 5));
    }
  });
});

describe("detectLookup — a national ID", () => {
  it("reads exactly ten digits as a document number", () => {
    expect(detectLookup("1012345678")).toEqual({
      kind: "national_id",
      digits: "1012345678",
    });
    expect(detectLookup("2087654321")).toEqual({
      kind: "national_id",
      digits: "2087654321",
    });
  });

  it("reads Arabic-Indic digits, which is what an Arabic keyboard produces", () => {
    expect(detectLookup("١٠١٢٣٤٥٦٧٨")).toEqual({
      kind: "national_id",
      digits: "1012345678",
    });
  });

  it("accepts the spacing people actually type", () => {
    expect(detectLookup("1012 345 678")).toEqual({
      kind: "national_id",
      digits: "1012345678",
    });
  });

  it("does not claim a longer or shorter run of digits", () => {
    expect(detectLookup("101234567").kind).not.toBe("national_id");
    expect(detectLookup("10123456789").kind).not.toBe("national_id");
  });
});

describe("detectLookup — a mobile number", () => {
  it.each([
    "+966512345678",
    "00966512345678",
    "966512345678",
    "0512345678",
    "512345678",
    "+966 51 234 5678",
  ])("%s normalises to E.164", (input) => {
    expect(detectLookup(input)).toEqual({
      kind: "mobile",
      e164: "+966512345678",
    });
  });

  it("requires the leading 5 — a landline is not a mobile", () => {
    expect(toSaudiE164("966112345678")).toBeNull();
    expect(detectLookup("0112345678").kind).not.toBe("mobile");
  });

  it("a local mobile is never mistaken for a national ID", () => {
    // Both are ten digits. The mobile check runs first and the ID check
    // requires exactly ten digits, so only the ordering separates them.
    expect(detectLookup("0512345678").kind).toBe("mobile");
  });
});

describe("detectLookup — module serials and names", () => {
  it("reads an alphanumeric token with no space as a module serial", () => {
    expect(detectLookup("RID-MOD-4471")).toEqual({
      kind: "module_serial",
      serial: "RID-MOD-4471",
    });
  });

  it("reads words as a name, in Arabic and in English", () => {
    expect(detectLookup("الشهري")).toEqual({ kind: "name", text: "الشهري" });
    expect(detectLookup("Fahad Alshehri")).toEqual({
      kind: "name",
      text: "Fahad Alshehri",
    });
  });

  it("reads a nine-letter word as a name — too long to be a code", () => {
    expect(detectLookup("Alqahtani").kind).toBe("name");
  });

  /**
   * **The collision, asserted rather than wished away.** The Crockford
   * alphabet is ordinary Latin, so an eight-letter family name can *be* a
   * valid Remote ID: `Alshehri` is `A L S H E H R I`, and with `L` and `I` both
   * mapping to `1` it normalises to `AJN-A1SH-EHR1`.
   *
   * Code-first is the right order on a page whose common case is a sticker, so
   * this is what the classifier does and the screen says so. `lookupAction`'s
   * override is what re-runs it as a name — this test exists so that if
   * somebody "fixes" the ordering, they see the escape hatch they are about to
   * strand.
   */
  it("reads an eight-letter name as a code, which is why the override exists", () => {
    expect(detectLookup("Alshehri")).toEqual({
      kind: "code",
      code: "AJN-A1SH-EHR1",
    });
  });

  it("an empty or blank box is not a search", () => {
    expect(detectLookup("").kind).toBe("empty");
    expect(detectLookup("   ").kind).toBe("empty");
  });

  it("truncates rather than refusing an absurdly long paste", () => {
    const query = detectLookup("م".repeat(500));
    expect(query.kind).toBe("name");
    if (query.kind === "name") {
      expect(query.text.length).toBeLessThanOrEqual(MAX_LOOKUP_LENGTH);
    }
  });
});

describe("what may be written to the audit trail", () => {
  it("names every kind except empty", () => {
    // `empty` is not a search and writes nothing. If a kind is ever added to
    // the union without being added here, this fails rather than a search
    // silently going unlogged.
    expect([...LOGGED_LOOKUP_KINDS].sort()).toEqual(
      [
        "code",
        "module_serial",
        "mobile",
        "name",
        "national_id",
        "partial",
      ].sort(),
    );
  });
});

describe('flightAuthorisationOf — "authorised right now?"', () => {
  const flight = {
    zoneNameAr: "حديقة الملك عبدالله",
    zoneNameEn: "King Abdullah Park",
    slotStart: new Date("2026-08-20T12:00:00Z"),
    slotEnd: new Date("2026-08-20T14:00:00Z"),
  };

  function staffView(
    over: Partial<Extract<RedactedRemoteId, { canReveal: true }>>,
  ): RedactedRemoteId {
    return {
      level: "reviewer",
      canReveal: true,
      code: "AJN-4F2K-91XZ",
      registrationStatus: "active",
      validUntil: new Date("2029-08-19T00:00:00Z"),
      buildType: "self_built",
      weightClass: "light",
      cityNameAr: "الرياض",
      cityNameEn: "Riyadh",
      flightInProgress: false,
      networkCapable: true,
      broadcastCapable: false,
      droneId: "drone-1",
      nickname: "طائرتي",
      manufacturer: null,
      model: null,
      serialNumber: null,
      weightGrams: 900,
      hasCamera: true,
      ownerNameAr: "فهد",
      ownerNameEn: "Fahad",
      ownerMobile: "+966512345678",
      ownerIdDocumentType: "saudi_national_id",
      ownerIdDocumentMasked: "•••••5678",
      activeFlight: null,
      photoUrls: [],
      declarations: [],
      bookings: [],
      scans: [],
      ...over,
    } as RedactedRemoteId;
  }

  it("yes, with the zone and the slot, when a registration is active and a slot contains now", () => {
    const answer = flightAuthorisationOf(
      staffView({ activeFlight: flight, flightInProgress: true }),
    );
    expect(answer).toEqual({ authorised: true, flight });
  });

  it("no, with no_flight, for the same aircraft outside its slot", () => {
    expect(flightAuthorisationOf(staffView({ activeFlight: null }))).toEqual({
      authorised: false,
      because: "no_flight",
    });
  });

  it("no, with not_registered, when the registration itself does not permit flight", () => {
    // A booking approved while the registration was valid does not make an
    // expired, suspended or revoked registration lawful.
    for (const registrationStatus of [
      "expired",
      "suspended",
      "revoked",
      "unregistered",
    ] as const) {
      expect(
        flightAuthorisationOf(
          staffView({
            registrationStatus,
            activeFlight: flight,
            flightInProgress: true,
          }),
        ),
      ).toEqual({ authorised: false, because: "not_registered" });
    }
  });

  it("a bystander's view never reads as authorised — it carries no zone", () => {
    const anonymous: RedactedRemoteId = {
      level: "anonymous",
      canReveal: false,
      code: "AJN-4F2K-91XZ",
      registrationStatus: "active",
      validUntil: null,
      buildType: "fpv",
      weightClass: "micro",
      cityNameAr: null,
      cityNameEn: null,
      flightInProgress: true,
      networkCapable: true,
      broadcastCapable: false,
    };
    expect(flightAuthorisationOf(anonymous)).toEqual({
      authorised: false,
      because: "no_flight",
    });
  });
});

/**
 * **The grep, as a test.**
 *
 * F24's acceptance criterion is "verified by grep that no bespoke select exists
 * here" — which is a thing somebody does once and nobody does again. A source
 * scan makes it a failing test instead, the same way `audit-actions.test.ts`
 * turned "check the labels" into one.
 *
 * Two properties, and they are the whole privacy model of this feature:
 *
 * 1. A **candidate** carries no identity. A partial-code search that matched
 *    six aircraft must not hand back six people's names for a fragment somebody
 *    half-read off a moving drone.
 * 2. The **identified** record is produced by `resolveRemoteId` — which goes
 *    through `redactRemoteId` with a server-computed viewer level — and by
 *    nothing else. A second query here is the first step of the drift that
 *    `redact.ts` exists to prevent.
 */
describe("the lookup never builds its own view of a person", () => {
  const search = readFileSync(
    join(process.cwd(), "src/lib/lookup/search.ts"),
    "utf8",
  );
  const action = readFileSync(
    join(process.cwd(), "src/lib/actions/lookup.ts"),
    "utf8",
  );

  /** Columns that identify a human being, as they are spelled in the schema. */
  const IDENTITY_COLUMNS = [
    "idDocumentNumber",
    "idDocumentType",
    "fullNameAr",
    "fullNameEn",
    "mobileE164",
  ];

  it("selects no identity column into a candidate", () => {
    // The `.select({ ... })` projections, isolated from the `where` predicates
    // — matching *on* a name or a mobile is the entire point of two of the
    // searches; returning one is what must never happen.
    const projections = [...search.matchAll(/\.select(?:Distinct)?\(\{([^}]*)\}/g)]
      .map((match) => match[1])
      .join("\n");

    expect(projections).not.toBe("");
    for (const column of IDENTITY_COLUMNS) {
      expect(projections).not.toContain(column);
    }
  });

  it("declares no identity field on the candidate type", () => {
    const type = search.slice(
      search.indexOf("export type LookupCandidate"),
      search.indexOf("};", search.indexOf("export type LookupCandidate")),
    );
    expect(type).toContain("code");
    for (const column of IDENTITY_COLUMNS) {
      expect(type).not.toContain(column);
    }
  });

  it("produces the identified record only through resolveRemoteId", () => {
    expect(action).toContain("resolveRemoteId");
    // No direct database access in the action at all beyond the audit write,
    // and no second call into the record reader.
    expect(action).not.toContain("getRemoteIdRecordByCode");
    expect(action).not.toContain("db.select");
    expect(action).not.toContain("db.query");
  });

  it("hashes a document number rather than matching its digits", () => {
    expect(search).toContain("hashIdDocument");
    // An `ilike` over identity documents is a substring search across a
    // national register. There is nothing to add it to, and this is what keeps
    // it that way.
    expect(search).not.toMatch(/ilike\([^)]*idDocument/);
  });
});
