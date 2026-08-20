import { riyadhInstant } from "@/lib/airspace/time";
import { parseHhMm } from "./zone-hours";

/**
 * A closure's rules — **pure, and shared by the form and the action.**
 *
 * The NOTAM analogue. A closure is a window over a zone that already exists:
 * for as long as it stands, every flight inside it is refused and every booking
 * already holding a slot in it is cancelled. That second half is why the
 * checking here is not cosmetic — a window typed the wrong way round, or one
 * that runs for a year, cancels real people's authorised flights.
 *
 * **The times arrive as a Riyadh civil date and a `HH:mm`**, never as an
 * instant from the browser. A closure is announced in local time ("Thursday
 * 18:00 to Saturday 06:00") and `riyadhInstant` is the single place in this
 * app that turns that into a UTC instant — the same one `deriveSlots` uses, so
 * a closure boundary and a slot boundary cannot land a millisecond apart.
 *
 * Same split as `validation/zone.ts` and `validation/zone-hours.ts`: the form
 * runs these for live feedback, `createZoneClosureAction` runs the identical
 * ones as the authority, because a server action is an ordinary POST.
 */

/** A reason quoted verbatim to a pilot has to be a sentence, not a word. */
export const MIN_REASON_LENGTH = 20;
export const MAX_REASON_LENGTH = 2_000;
export const MAX_AUTHORITY_REF_LENGTH = 120;

/**
 * **Ninety days is where "temporary" stops.** A closure longer than that is not
 * a NOTAM, it is a change of mind about the zone — and the honest way to say
 * that is to suspend the zone, which is reversible, tells every pilot why, and
 * leaves the airspace visibly withdrawn rather than open with a year-long hole
 * in it.
 */
export const MAX_CLOSURE_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ClosureProblem =
  | "closure_start_required"
  | "closure_end_required"
  | "closure_not_ordered"
  | "closure_already_over"
  | "closure_too_long"
  | "closure_reason_ar_required"
  | "closure_reason_en_required"
  | "closure_reason_too_long"
  | "closure_authority_ref_too_long";

export type ClosureDraft = {
  /** `YYYY-MM-DD`, Riyadh civil. From the three-select control, never a native picker. */
  startYmd: string;
  /** `HH:mm`, Riyadh local, typed as text — thread 46. */
  startHhMm: string;
  endYmd: string;
  endHhMm: string;
  reasonAr: string;
  reasonEn: string;
  authorityRef: string;
};

export type ClosureValue = {
  startsAt: Date;
  endsAt: Date;
  reasonAr: string;
  reasonEn: string;
  authorityRef: string | null;
};

export type ClosureValidation =
  | { ok: true; value: ClosureValue }
  | { ok: false; problems: ClosureProblem[] };

export function emptyClosureDraft(): ClosureDraft {
  return {
    startYmd: "",
    startHhMm: "",
    endYmd: "",
    endHhMm: "",
    reasonAr: "",
    reasonEn: "",
    authorityRef: "",
  };
}

/** `YYYY-MM-DD` + `HH:mm` → the instant, or `null` if either half is unusable. */
export function closureInstant(ymd: string, hhMm: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const minutes = parseHhMm(hhMm);
  if (minutes === null) return null;
  return riyadhInstant(ymd, minutes);
}

/**
 * **Both languages are required, and both are floored at twenty characters.**
 *
 * The reason is not a label on an admin screen — it is quoted verbatim into the
 * cancellation notification and the email each pilot receives, in their own
 * language. "closed" tells somebody whose flight has just been cancelled
 * nothing they can act on, and a pilot reading English must not receive the
 * Arabic because the English was left blank.
 *
 * A closure whose end has already passed is refused rather than stored: it can
 * cancel nothing, the engine will never read it, and a record of a closure that
 * did nothing is a row that makes the trail harder to read, not easier.
 */
export function validateClosure(
  draft: ClosureDraft,
  now: Date = new Date(),
): ClosureValidation {
  const problems: ClosureProblem[] = [];

  const startsAt = closureInstant(draft.startYmd, draft.startHhMm);
  const endsAt = closureInstant(draft.endYmd, draft.endHhMm);

  if (!startsAt) problems.push("closure_start_required");
  if (!endsAt) problems.push("closure_end_required");

  if (startsAt && endsAt) {
    // Half-open `[start, end)` everywhere in this app, so an empty window is
    // not a closure: `start === end` closes nothing at all.
    if (endsAt.getTime() <= startsAt.getTime()) problems.push("closure_not_ordered");
    else {
      if (endsAt.getTime() <= now.getTime()) problems.push("closure_already_over");
      if (endsAt.getTime() - startsAt.getTime() > MAX_CLOSURE_DAYS * DAY_MS) {
        problems.push("closure_too_long");
      }
    }
  }

  const reasonAr = draft.reasonAr.trim();
  const reasonEn = draft.reasonEn.trim();
  if (reasonAr.length < MIN_REASON_LENGTH) problems.push("closure_reason_ar_required");
  if (reasonEn.length < MIN_REASON_LENGTH) problems.push("closure_reason_en_required");
  if (
    reasonAr.length > MAX_REASON_LENGTH ||
    reasonEn.length > MAX_REASON_LENGTH
  ) {
    problems.push("closure_reason_too_long");
  }

  const authorityRef = draft.authorityRef.trim();
  if (authorityRef.length > MAX_AUTHORITY_REF_LENGTH) {
    problems.push("closure_authority_ref_too_long");
  }

  if (problems.length > 0 || !startsAt || !endsAt) {
    return { ok: false, problems };
  }

  return {
    ok: true,
    value: {
      startsAt,
      endsAt,
      reasonAr,
      reasonEn,
      authorityRef: authorityRef === "" ? null : authorityRef,
    },
  };
}

export type ClosureWindow = { startsAt: Date; endsAt: Date };

/**
 * Whether two closure windows overlap, **half-open** `[start, end)`.
 *
 * The same rule as the operating-hours grid and the booking seat: a closure
 * ending at 12:00 and one starting at 12:00 are adjacent, not overlapping. Used
 * to *tell* an admin that a window is already covered — never to refuse one.
 * Two closures over one span is legitimate (two authorities, two reasons) and
 * the engine refuses a flight if **any** published closure covers it, so a
 * duplicate is harmless. What is not harmless is publishing one believing it
 * cancels flights when an earlier closure already cancelled them.
 */
export function closureOverlaps(a: ClosureWindow, b: ClosureWindow): boolean {
  return (
    a.startsAt.getTime() < b.endsAt.getTime() &&
    b.startsAt.getTime() < a.endsAt.getTime()
  );
}

/** Every window in `existing` that the draft one overlaps. */
export function overlappingClosures<T extends ClosureWindow>(
  window: ClosureWindow,
  existing: readonly T[],
): T[] {
  return existing.filter((other) => closureOverlaps(window, other));
}
