/**
 * The documents `/remote-id` cites — **every one of them fetched and read**.
 *
 * The honesty rule forbids fabricated credibility, and a plausible-looking
 * citation to a document nobody opened is exactly that: it borrows a
 * regulator's authority for a claim the regulator may not have made. So this
 * list is deliberately short, every entry carries the date it was retrieved,
 * and nothing appears on the page that is not quoted out of one of them.
 *
 * **Titles are verbatim and untranslated.** A document's title is how you find
 * it again; translating "GACAR Part 107" into Arabic prose would make the
 * citation unusable to the one reader most likely to check it. The publisher
 * is a real organisation with a real name in both languages, so it takes the
 * paired-column treatment the rest of the app gives human-authored text. What
 * each source is *cited for* is UI copy and lives in the message catalogue,
 * keyed by `id`.
 *
 * **`14 CFR Part 89` is cited from Cornell LII, not eCFR.** eCFR refused every
 * request; LII is what was actually read, so LII is what is credited. Citing
 * the canonical URL because it is the canonical URL would be claiming a read
 * that never happened.
 */

export type Source = {
  /** Also the message-catalogue key for the "cited for" note. */
  id: string;
  /** Verbatim, in the document's own language. Rendered `dir="ltr"`. */
  title: string;
  publisherAr: string;
  publisherEn: string;
  url: string;
  /** ISO date. When the document was fetched and read, not when it was issued. */
  retrievedOn: string;
};

const GACA_AR = "الهيئة العامة للطيران المدني";
const GACA_EN = "General Authority of Civil Aviation (Saudi Arabia)";

/** Every document below was fetched and read on this date. */
const RETRIEVED = "2026-08-18";

const GACAR_PDF_BASE =
  "https://gaca.gov.sa/-/media/Files/PDF/LawsAndRegulation/Aviation-Safety-and-Environmental-Sustainability";

export const REMOTE_ID_SOURCES: readonly Source[] = [
  {
    id: "gacar107",
    title: "GACAR Part 107 — Operation of Unmanned Aircraft Systems, Version 4.0",
    publisherAr: GACA_AR,
    publisherEn: GACA_EN,
    url: `${GACAR_PDF_BASE}/GACAR-Safety-Regulations/107-v4.pdf`,
    retrievedOn: RETRIEVED,
  },
  {
    id: "gacarVersions",
    title: "GACAR Log of Versions, 2 August 2026",
    publisherAr: GACA_AR,
    publisherEn: GACA_EN,
    url: `${GACAR_PDF_BASE}/GACAR-Safety-Regulations/Change_History-v107.pdf`,
    retrievedOn: RETRIEVED,
  },
  {
    id: "volume18",
    title: "E-Book Volume 18 — Unmanned Aircraft Systems, Version 1.0",
    publisherAr: GACA_AR,
    publisherEn: GACA_EN,
    url: `${GACAR_PDF_BASE}/E-Book/VOLUME18UNMANNEDAIRCRAFTSYSTEMS-v1.pdf`,
    retrievedOn: RETRIEVED,
  },
  {
    id: "cfr89",
    title: "14 CFR Part 89 — Remote Identification of Unmanned Aircraft",
    publisherAr: "معهد المعلومات القانونية، جامعة كورنيل",
    publisherEn: "Legal Information Institute, Cornell Law School",
    url: "https://www.law.cornell.edu/cfr/text/14/part-89",
    retrievedOn: RETRIEVED,
  },
  {
    id: "cfr89115",
    title: "14 CFR § 89.115 — Remote identification alternative",
    publisherAr: "معهد المعلومات القانونية، جامعة كورنيل",
    publisherEn: "Legal Information Institute, Cornell Law School",
    url: "https://www.law.cornell.edu/cfr/text/14/89.115",
    retrievedOn: RETRIEVED,
  },
  {
    id: "cfr89305",
    title:
      "14 CFR § 89.305 — Minimum message elements, standard remote identification unmanned aircraft",
    publisherAr: "معهد المعلومات القانونية، جامعة كورنيل",
    publisherEn: "Legal Information Institute, Cornell Law School",
    url: "https://www.law.cornell.edu/cfr/text/14/89.305",
    retrievedOn: RETRIEVED,
  },
  {
    id: "cfr89315",
    title:
      "14 CFR § 89.315 — Minimum message elements, remote identification broadcast module",
    publisherAr: "معهد المعلومات القانونية، جامعة كورنيل",
    publisherEn: "Legal Information Institute, Cornell Law School",
    url: "https://www.law.cornell.edu/cfr/text/14/89.315",
    retrievedOn: RETRIEVED,
  },
];

/**
 * The passages `/remote-id` actually quotes.
 *
 * **Verbatim, and deliberately not translated.** A quotation is a claim about
 * what a document says; rendering an Arabic paraphrase inside quotation marks
 * would be putting words a regulator never wrote in a regulator's mouth, on the
 * one page whose whole argument rests on what the regulators did write. So the
 * quote stays in its own language and its own direction, and the Arabic reader
 * gets the explanation — which *is* translated — around it. This is the same
 * reasoning that keeps the document titles untranslated above.
 *
 * `cite` is the pinpoint (a section number), not the document; the document is
 * `sourceId` and its full title is rendered from `REMOTE_ID_SOURCES`.
 */
export type Quote = {
  id: string;
  sourceId: Source["id"];
  cite: string;
  text: string;
};

export const REMOTE_ID_QUOTES: readonly Quote[] = [
  {
    id: "faaIdentity",
    sourceId: "cfr89305",
    cite: "14 CFR § 89.305(a)",
    text: "The identity of the unmanned aircraft, consisting of: (1) A serial number assigned to the unmanned aircraft by the person responsible for the production of the standard remote identification unmanned aircraft; or (2) A session ID.",
  },
  {
    id: "faaModule",
    sourceId: "cfr89315",
    cite: "14 CFR § 89.315(a)",
    text: "the serial number assigned to the remote identification broadcast module by the person responsible for the production of the remote identification broadcast module",
  },
  {
    id: "faaDoc",
    sourceId: "cfr89115",
    cite: "14 CFR § 89.115(a)",
    text: "the serial number of the remote identification broadcast module must be listed on an FAA-accepted declaration of compliance",
  },
  {
    id: "gacaDate",
    sourceId: "gacar107",
    cite: "GACAR Part 107, Subpart F",
    text: "This Subpart is applicable as of 1 January 2026.",
  },
  {
    id: "gacaMandate",
    sourceId: "gacar107",
    cite: "GACAR § 107.302(b)",
    text: "Registered UA and model aircraft intended to be operated under this Part must be equipped with Direct Remote Identification or Network Remote Identification.",
  },
  {
    id: "gacaDri",
    sourceId: "gacar107",
    cite: "GACAR § 107.303(c)",
    text: "the UAS operator registration number and the verification code provided by GACA during the registration process … the unique serial number of the add-on",
  },
  {
    id: "gacaNri",
    sourceId: "gacar107",
    cite: "GACAR § 107.304(b)(2)",
    text: "the unique serial number of the UA compliant with a standard acceptable to GACA",
  },
  {
    id: "gacaSerialOptional",
    sourceId: "volume18",
    cite: "E-Book Volume 18, § 18.1.1.3, Note 3",
    text: "ask the Applicant for the manufacturer, model name and serial number of the unmanned aircraft if this information is available",
  },
  {
    id: "gacaIdentifier",
    sourceId: "volume18",
    cite: "E-Book Volume 18, § 18.1.1.3, Note 3",
    text: "This is either the GACA registration certificate number or the UAS serial number (in accordance with GACAR 48.21).",
  },
  {
    id: "gacaLabel",
    sourceId: "volume18",
    cite: "E-Book Volume 18, § 18.1.1.3, Note 4",
    text: "must ... also display a label or QR-code reflecting eligibility to conduct such UAS operations",
  },
];
