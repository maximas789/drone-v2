"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DecisionReasons } from "@/components/airspace/decision-reasons";
import { riyadhYmd } from "@/lib/airspace/time";
import {
  REASON_CODES,
  type Reason as AirspaceReason,
  type Slot,
  type ZoneWindow,
} from "@/lib/airspace/types";
import {
  createBookingAction,
  listSlotsAction,
  type SlotListing,
} from "@/lib/actions/booking";
import { formatAltitude, formatDate, formatSeconds } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { dayOptions } from "@/lib/maps/probe";
import {
  FLIGHT_PURPOSES,
  MAX_COPILOTS,
  validateCopilots,
} from "@/lib/validation/booking";
import { Copilots, type CopilotDraft } from "./copilots";
import { DateStrip } from "./date-strip";
import { DroneSelect, type BookableDrone } from "./drone-select";
import { SafetyAck } from "./safety-ack";
import { SlotTime } from "./slot-time";
import { SlotPicker } from "./slot-picker";

/**
 * `/bookings/new` — turning "I can fly here" into a seat.
 *
 * **Nothing the map already answered is asked again.** Zone, altitude, slot and
 * aircraft arrive in the query string, and the wizard opens on the first step
 * that is still unanswered. A pilot who has just spent a minute tapping the map
 * and reading the panel must not land on a blank form.
 *
 * **The client validates with the same pure functions the server runs**, and
 * the server runs them again. `validateCopilots` here is the same check,
 * earlier — never the check: `createBookingAction` is an ordinary POST and
 * re-runs the whole airspace evaluation as well, so a zone that closed between
 * page load and submit is refused even though this form was happy.
 *
 * **Every refusal renders in place.** There is no error page and no lost input:
 * the reasons appear under the step that owns them, and losing the last seat
 * puts three alternative slots on screen with the rest of the form untouched.
 */

/**
 * Refusals arrive from two vocabularies and both have to reach the pilot.
 *
 * `evaluateAirspace` raises `ReasonCode`s, which `DecisionReasons` renders with
 * their fixes and which F21 shares with the map. The form raises its own —
 * `copilot_name_required`, `invalid_purpose` — which have no airspace meaning
 * and are shown by the field that owns them. This is the shape both fit, and
 * the split is made explicitly below rather than by widening `ReasonCode` with
 * codes the engine will never produce.
 */
type FormReason = {
  code: string;
  params?: Record<string, string | number>;
  fixParams?: Record<string, string | number>;
  zoneId?: string;
  zoneNameAr?: string;
  zoneNameEn?: string;
};

const isAirspaceReason = (reason: FormReason): reason is AirspaceReason =>
  (REASON_CODES as readonly string[]).includes(reason.code);

const TOTAL_STEPS = 6;
type Step = 1 | 2 | 3 | 4 | 5 | 6;

/** Which step owns which refusal, so a reason is shown to somebody who can fix it. */
const STEP_FOR_CODE: Record<string, Step> = {
  zone_closed_now: 2,
  zone_closed_window: 2,
  slot_not_on_grid: 2,
  slot_in_past: 2,
  slot_full: 2,
  booking_lead_time: 2,
  booking_too_far_ahead: 1,
  duplicate_booking: 2,
  max_slots_per_day: 2,
  night_operation_not_permitted: 2,
  drone_not_approved: 3,
  drone_registration_expired: 3,
  drone_revoked: 3,
  no_remote_id: 3,
  remote_id_not_active: 3,
  broadcast_rid_required: 3,
  build_type_not_permitted: 3,
  weight_class_not_permitted: 3,
  above_ceiling: 4,
  below_floor: 4,
  invalid_purpose: 4,
  copilot_name_required: 4,
  copilot_name_too_long: 4,
  copilot_mobile_format: 4,
  too_many_copilots: 4,
};

/** What the wizard needs to know about a zone without a second round trip. */
export type BookableZone = {
  id: string;
  nameAr: string;
  nameEn: string;
  ceilingAglM: number | null;
  maxAdvanceDays: number;
  nightAllowed: boolean;
  autoApprove: boolean;
  hours: readonly ZoneWindow[];
};

export type BookingPrefill = {
  zoneId: string | null;
  droneId: string | null;
  slotStart: string | null;
  altitudeAglM: number | null;
};

export function BookingWizard({
  zones,
  drones,
  prefill,
  locale,
  onCreated,
}: {
  zones: readonly BookableZone[];
  drones: readonly BookableDrone[];
  prefill: BookingPrefill;
  locale: Locale;
  /** Called once the seat is claimed; the page owns what happens next. */
  onCreated: (result: { bookingId: string; approved: boolean }) => void;
}) {
  const t = useTranslations("booking");
  const tErrors = useTranslations("errors");

  const [zoneId, setZoneId] = useState<string>(
    () => prefill.zoneId ?? zones[0]?.id ?? "",
  );
  const [ymd, setYmd] = useState<string>(() =>
    riyadhYmd(prefill.slotStart ? new Date(prefill.slotStart) : new Date()),
  );
  const [slotStart, setSlotStart] = useState<string | null>(prefill.slotStart);
  const [droneId, setDroneId] = useState<string | null>(() =>
    prefill.droneId ?? defaultDroneId(drones),
  );
  const [purpose, setPurpose] = useState("");
  const [purposeNote, setPurposeNote] = useState("");
  const [altitude, setAltitude] = useState<string>(() =>
    prefill.altitudeAglM === null ? "" : String(prefill.altitudeAglM),
  );
  const [copilots, setCopilots] = useState<CopilotDraft[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);

  /**
   * The day's grid **together with the question it answers.**
   *
   * Not a listing plus a `loading` flag: those two have to be reset in step
   * with every change to the zone, the day or the aircraft, and the reset is
   * what gets forgotten. Keying the answer makes a stale grid structurally
   * unusable — it simply does not match — so a slow reply for a day the pilot
   * has already moved off can never be the grid they click.
   */
  const [slotAnswer, setSlotAnswer] = useState<{
    key: string;
    listing: SlotListing | null;
  } | null>(null);
  const [reasons, setReasons] = useState<readonly FormReason[]>([]);
  const [alternatives, setAlternatives] = useState<readonly Slot[]>([]);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * Opens on the first step the map has *not* already answered. A pilot who
   * chose a point, an altitude and a time on the map and then had to press
   * "next" four times would rightly wonder what the map was for.
   */
  const [step, setStep] = useState<Step>(() =>
    prefill.slotStart ? (prefill.droneId ? 4 : 3) : prefill.zoneId ? 2 : 1,
  );

  const zone = zones.find((candidate) => candidate.id === zoneId) ?? null;
  const problems = new Set(reasons.map((reason) => reason.code));
  const airspaceReasons = reasons.filter(isAirspaceReason);

  const slotKey = `${zoneId}|${ymd}|${droneId ?? ""}`;
  const listing = slotAnswer?.key === slotKey ? slotAnswer.listing : null;
  /** Derived, never stored: pending *is* "no answer for this question yet". */
  const loadingSlots = zoneId !== "" && slotAnswer?.key !== slotKey;

  /**
   * The day's grid, refetched whenever the question changes.
   *
   * Keyed on the zone, the day **and the aircraft**: `listSlotsAction` folds the
   * pilot's own bookings into each slot's state, so the same grid can read
   * differently once a drone is chosen.
   */
  useEffect(() => {
    if (!zoneId) return;
    let current = true;
    void listSlotsAction(zoneId, ymd, droneId).then((result) => {
      if (current) {
        setSlotAnswer({ key: slotKey, listing: result.ok ? result.data : null });
      }
    });
    return () => {
      current = false;
    };
  }, [zoneId, ymd, droneId, slotKey]);

  const applyReasons = useCallback(
    (next: readonly FormReason[], nextAlternatives: readonly Slot[] = []) => {
      setReasons(next);
      setAlternatives(nextAlternatives);

      const rateLimited = next.find((reason) => reason.code === "rate_limited");
      if (rateLimited) {
        setFormMessage(
          tErrors("rateLimited", {
            duration: formatSeconds(
              Number(rateLimited.params?.retryAfterSeconds ?? 0),
              locale,
            ),
          }),
        );
        return;
      }
      setFormMessage(null);

      // Jump to the earliest step that owns one of these refusals, so the
      // pilot is looking at the control that fixes it.
      const owning = next
        .map((reason) => STEP_FOR_CODE[reason.code])
        .filter((value): value is Step => value !== undefined)
        .sort((a, b) => a - b)[0];
      if (owning) setStep(owning);
    },
    [locale, tErrors],
  );

  function submit() {
    if (!zone || !slotStart || !droneId) return;

    // The same function the action runs, for an answer without a round trip.
    const crew = validateCopilots(copilots);
    if (!crew.ok) {
      applyReasons(crew.problems.map((code) => ({ code })));
      return;
    }

    startTransition(async () => {
      const result = await createBookingAction({
        zoneId: zone.id,
        droneId,
        slotStart,
        purpose: purpose || null,
        purposeNote: purposeNote || null,
        plannedAltitudeM: altitude === "" ? null : Number(altitude),
        copilots,
      });

      if (!result.ok) {
        applyReasons(result.reasons, result.alternatives ?? []);
        // The seat is gone; refresh the grid so it greys in place rather than
        // still offering the slot that just refused.
        void listSlotsAction(zone.id, ymd, droneId).then((refreshed) => {
          if (refreshed.ok) {
            setSlotAnswer({ key: slotKey, listing: refreshed.data });
          }
        });
        return;
      }

      onCreated({
        bookingId: result.data.bookingId,
        approved: result.data.approved,
      });
    });
  }

  const days = zone ? dayOptions(new Date(), zone.maxAdvanceDays) : [];
  const canContinue = CONTINUE_GUARD[step]({
    zoneId,
    slotStart,
    droneId,
    acknowledged,
  });

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {t("stepOf", { step, total: TOTAL_STEPS })}
      </p>

      {formMessage ? (
        <p role="alert" className="text-destructive text-sm">
          {formMessage}
        </p>
      ) : null}

      {step === 1 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">{t("stepZone")}</h2>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="booking-zone">{t("zone")}</Label>
            <Select
              id="booking-zone"
              value={zoneId}
              onChange={(event) => {
                setZoneId(event.target.value);
                // A slot belongs to a zone's grid; keeping it across a zone
                // change would carry an instant that is not on the new one.
                setSlotStart(null);
              }}
            >
              {zones.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {locale === "ar" ? candidate.nameAr : candidate.nameEn}
                </option>
              ))}
            </Select>
          </div>

          {zone ? (
            <div className="flex flex-col gap-2">
              <Label>{t("day")}</Label>
              <p className="text-muted-foreground text-sm">
                {formatDate(new Date(`${ymd}T12:00:00.000Z`), locale)}
              </p>
              <DateStrip
                days={days}
                selected={ymd}
                onSelect={(next) => {
                  setYmd(next);
                  setSlotStart(null);
                }}
                locale={locale}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">{t("stepSlot")}</h2>
          <SlotPicker
            slots={listing?.slots ?? []}
            capacity={listing?.zone.capacity ?? 0}
            selected={slotStart}
            onSelect={setSlotStart}
            locale={locale}
            loading={loadingSlots}
          />

          {alternatives.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-sm font-medium">{t("alternativesTitle")}</p>
              <ul className="flex flex-wrap gap-2">
                {alternatives.slice(0, 3).map((slot) => (
                  <li key={slot.slotStart}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setYmd(riyadhYmd(new Date(slot.slotStart)));
                        setSlotStart(slot.slotStart);
                        setAlternatives([]);
                        setReasons([]);
                      }}
                    >
  
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 3 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">{t("stepDrone")}</h2>
          <DroneSelect
            drones={drones}
            selected={droneId}
            onSelect={setDroneId}
            locale={locale}
          />
        </section>
      ) : null}

      {step === 4 ? (
        <section className="flex flex-col gap-5">
          <h2 className="text-lg font-medium">{t("stepDetails")}</h2>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="booking-purpose">{t("purpose")}</Label>
            <Select
              id="booking-purpose"
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
            >
              <option value="">{t("purposeNone")}</option>
              {FLIGHT_PURPOSES.map((code) => (
                <option key={code} value={code}>
                  {t(`purposes.${code}` as never)}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="booking-note">{t("purposeNote")}</Label>
            <Input
              id="booking-note"
              value={purposeNote}
              onChange={(event) => setPurposeNote(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="booking-altitude">{t("plannedAltitude")}</Label>
            {/**
             * **Not `type="number"`** — the same trap as the banned
             * `<input type="date">`, and found the same way. Chrome renders a
             * number input's *display* value through the browser's locale, so
             * on the Arabic page this drew `١٢٠` while the ceiling hint one
             * line below drew `120`. The DOM `value` stays ASCII throughout,
             * which is why every test, `innerText` check and i18n scan reads
             * "120" and only a screenshot catches it.
             *
             * `min`/`max` went with it: they are inert on a text input, and
             * the ceiling was never theirs to enforce — `above_ceiling` comes
             * back from the server and is rendered just below.
             */}
            <Input
              id="booking-altitude"
              inputMode="numeric"
              maxLength={4}
              dir="ltr"
              className="text-start font-mono"
              value={altitude}
              onChange={(event) => setAltitude(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              {zone?.ceilingAglM === null || zone === null
                ? t("plannedAltitudeNoCeiling")
                : t("plannedAltitudeHint", {
                    ceiling: formatAltitude(zone.ceilingAglM, locale),
                  })}
            </p>
            {problems.has("above_ceiling") ? (
              <p className="text-destructive text-sm">{t("altitudeAboveCeiling")}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-medium">
              {t("copilots", { max: MAX_COPILOTS })}
            </h3>
            <Copilots
              copilots={copilots}
              onChange={setCopilots}
              problems={problems}
            />
          </div>
        </section>
      ) : null}

      {step === 5 && zone ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">{t("stepSafety")}</h2>
          <SafetyAck
            ceilingAglM={zone.ceilingAglM}
            hours={zone.hours}
            ymd={ymd}
            nightAllowed={zone.nightAllowed}
            checked={acknowledged}
            onChange={setAcknowledged}
            locale={locale}
          />
        </section>
      ) : null}

      {step === 6 && zone ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">{t("stepReview")}</h2>

          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Row label={t("zone")}>
              {locale === "ar" ? zone.nameAr : zone.nameEn}
            </Row>
            <Row label={t("slot")}>
              {slotStart ? (
                <SlotTime start={new Date(slotStart)} locale={locale} />
              ) : (
                "—"
              )}
            </Row>
            <Row label={t("drone")}>
              {drones.find((drone) => drone.id === droneId)?.nickname ?? "—"}
            </Row>
            <Row label={t("plannedAltitude")}>
              <span dir="ltr">
                {altitude === ""
                  ? "—"
                  : formatAltitude(Number(altitude), locale)}
              </span>
            </Row>
            <Row label={t("purpose")}>
              {purpose ? t(`purposes.${purpose}` as never) : t("purposeNone")}
            </Row>
            <Row label={t("copilotsCount")}>
              {String(copilots.filter((c) => c.fullNameAr || c.fullNameEn).length)}
            </Row>
          </dl>

          {/**
           * **What happens next, before it happens.** A pilot who presses
           * confirm expecting an authorisation and receives "pending" has been
           * surprised by the product; the zone's `autoApprove` is known here, so
           * there is no reason for that.
           */}
          <p className="bg-card rounded-lg border p-3 text-sm">
            {zone.autoApprove ? t("willApproveInstantly") : t("willEnterReview")}
          </p>
        </section>
      ) : null}

      {/**
       * Only the engine's own codes go through the shared component: it renders
       * `airspace.reasons.*` and `airspace.fixes.*`, and a form code has no
       * entry in either. The form's own refusals are rendered by the field that
       * caused them, where the fix actually is.
       */}
      {airspaceReasons.length > 0 ? (
        <DecisionReasons reasons={airspaceReasons} locale={locale} />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {step > 1 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((current) => (current - 1) as Step)}
          >
            {t("back")}
          </Button>
        ) : null}

        {step < TOTAL_STEPS ? (
          <Button
            type="button"
            disabled={!canContinue}
            onClick={() => setStep((current) => (current + 1) as Step)}
          >
            {t("next")}
          </Button>
        ) : (
          <Button type="button" disabled={!acknowledged || pending} onClick={submit}>
            {pending ? t("submitting") : t("confirm")}
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 sm:block">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-start">{children}</dd>
    </div>
  );
}

type GuardState = {
  zoneId: string;
  slotStart: string | null;
  droneId: string | null;
  acknowledged: boolean;
};

/**
 * What each step must have before "next" means anything.
 *
 * A guard per step rather than one condition with five `&&`s, because the
 * failure mode of the latter is a button that is disabled and does not say
 * which of five things is missing.
 */
const CONTINUE_GUARD: Record<Step, (state: GuardState) => boolean> = {
  1: (state) => state.zoneId !== "",
  2: (state) => state.slotStart !== null,
  3: (state) => state.droneId !== null,
  4: () => true,
  5: (state) => state.acknowledged,
  6: (state) => state.acknowledged,
};

/**
 * The pilot's only bookable drone, when there is exactly one — the same rule
 * the map's aircraft selector uses, and for the same reason: with two or more,
 * choosing the first answers for an airframe nobody picked.
 */
function defaultDroneId(drones: readonly BookableDrone[]): string | null {
  const bookable = drones.filter((drone) => drone.blockedReason === null);
  return bookable.length === 1 ? bookable[0].id : null;
}
