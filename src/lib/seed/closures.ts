/**
 * Seeded closures — the NOTAM analogue.
 *
 * Both sit on `RUH-P-07` (Janadriyah), the events zone, and both are computed
 * from `SEED_EPOCH` rather than from `Date.now()`. That is what makes re-seeding
 * reproducible: the same run produces the same two closures, one already over
 * and one still ahead, so the "past vs upcoming" split in the UI has something
 * to show without anyone waiting for a date to pass.
 */

/** The fixed origin every relative date in the seed is measured from. */
export const SEED_EPOCH = new Date("2026-01-01T00:00:00Z");

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days from the epoch, in Riyadh terms — the times below are +03:00. */
function epochPlusDays(days: number, hour: number, minute = 0): Date {
  const date = new Date(SEED_EPOCH.getTime() + days * DAY_MS);
  // Riyadh is UTC+3, fixed. 09:00 local is 06:00Z.
  date.setUTCHours(hour - 3, minute, 0, 0);
  return date;
}

export type SeedClosure = {
  zoneCode: string;
  startsAt: Date;
  endsAt: Date;
  reasonAr: string;
  reasonEn: string;
  authorityRef: string;
};

export const CLOSURES: SeedClosure[] = [
  {
    zoneCode: "RUH-P-07",
    // Past: a closure that has already run its course.
    startsAt: epochPlusDays(20, 6),
    endsAt: epochPlusDays(23, 22),
    reasonAr: "مهرجان الجنادرية — إغلاق مؤقت للمجال الجوي فوق موقع الفعالية.",
    reasonEn:
      "Janadriyah festival — temporary airspace closure over the event site.",
    authorityRef: "AJNIHA-PROPOSAL/NOTAM-2026-001",
  },
  {
    zoneCode: "RUH-P-07",
    // Future: far enough ahead to still be upcoming on any plausible demo day.
    startsAt: epochPlusDays(400, 6),
    endsAt: epochPlusDays(403, 22),
    reasonAr: "فعالية مجدولة — إغلاق مؤقت معلن مسبقاً.",
    reasonEn: "Scheduled event — closure published in advance.",
    authorityRef: "AJNIHA-PROPOSAL/NOTAM-2027-014",
  },
];
