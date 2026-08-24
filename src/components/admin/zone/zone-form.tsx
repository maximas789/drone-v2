"use client";

import { useTranslations } from "next-intl";
import { useId, useMemo, useState, useTransition } from "react";
import { EditorMount } from "@/components/admin/zone/editor-mount";
import { FormProblem } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import {
  createZoneAction,
  previewGeometryChangeAction,
  updateZoneAction,
} from "@/lib/actions/admin";
import type { Reason } from "@/lib/actions/result";
import type { Geometry } from "@/lib/geo";
import { validateGeometry } from "@/lib/geo/validate";
import {
  formatArea,
  formatDateTime,
  formatNumber,
  formatSeconds,
} from "@/lib/format";
import type { Locale } from "@/lib/locale";
import {
  WEIGHT_CLASSES,
  ZONE_KINDS,
  emptyZoneDraft,
  type ZoneDraft,
} from "@/lib/validation/zone";
import { BUILD_TYPES } from "@/lib/validation/drone";

/**
 * The zone editor's form — **the map and the rules on one screen.**
 *
 * A boundary and the rules inside it are one decision. Splitting them across
 * two steps would let somebody draw a polygon, walk away, and leave a shape
 * with nobody's rules attached; and the ceiling, the capacity and the permitted
 * build types are exactly what an admin is thinking about *while* they choose
 * where the edge goes.
 *
 * **Every rule carries a sentence about what it does to pilots.** Not a tooltip
 * — a line under the field. `requiresBroadcastRid` excludes every pilot without
 * a *verified* module, and an admin who ticks it without knowing that has
 * grounded people by accident.
 *
 * **The geometry is checked live, by the same function the server uses.**
 * `validateGeometry` is pure and has no `server-only` import precisely so both
 * sides can call it: the sentence under the map is a courtesy, and
 * `createZoneAction` runs the identical check as the authority. The client's
 * answer is never trusted — the action recomputes the bbox and the vertex count
 * from the geometry it received.
 *
 * **Arabic first, and both required.** The two name fields sit side by side
 * with the Arabic one first and `dir="rtl"` on it; a zone named only in English
 * is refused rather than stored with a silent gap, because the map, the
 * confirmation and the cancellation email would all show a name half this
 * app's users cannot read.
 */

export type ZoneFormCity = { id: string; nameAr: string; nameEn: string };

export function ZoneForm({
  zoneId,
  initial,
  initialGeometry,
  cities,
  contextGeojson,
  locale,
  status,
}: {
  /** `undefined` when drawing a new zone. */
  zoneId?: string;
  initial?: ZoneDraft;
  initialGeometry?: Geometry | null;
  cities: readonly ZoneFormCity[];
  contextGeojson: unknown;
  locale: Locale;
  /** Decides whether a boundary change has to be confirmed against its impact. */
  status?: string;
}) {
  const t = useTranslations("zoneAdmin");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const fieldId = useId();

  const [draft, setDraft] = useState<ZoneDraft>(
    () => initial ?? { ...emptyZoneDraft(), cityId: cities[0]?.id ?? "" },
  );
  const [geometry, setGeometry] = useState<Geometry | null>(
    initialGeometry ?? null,
  );
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  /**
   * Set when the server refuses a boundary change on a published zone until it
   * has been confirmed. The list is the server's, fetched *after* the refusal
   * rather than computed here — the client does not get to decide which flights
   * a moved boundary disturbs.
   */
  const [impact, setImpact] = useState<
    | null
    | {
        bookingId: string;
        pilotName: string;
        slotStart: string;
        slotEnd: string;
        status: string;
      }[]
  >(null);
  const [flagged, setFlagged] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof ZoneDraft>(key: K, value: ZoneDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  /** The same check the action will run, for the sentence under the map. */
  const geometryCheck = useMemo(
    () => (geometry ? validateGeometry(geometry) : null),
    [geometry],
  );

  /**
   * `confirmImpact` is only ever `true` after the admin has looked at the list
   * below. The **server** decides whether confirmation is needed — this asks it,
   * is refused with `geometry_impact_unconfirmed`, then fetches the list. The
   * alternative, working out here whether the boundary shrank, would be the
   * client deciding whose flight is disturbed.
   */
  function save(confirmImpact = false) {
    startTransition(async () => {
      setReasons([]);
      setWarnings([]);
      setFlagged(null);
      const result = zoneId
        ? await updateZoneAction(zoneId, draft, geometry, confirmImpact)
        : await createZoneAction(draft, geometry);

      if (!result.ok) {
        if (
          zoneId &&
          result.reasons.some((r) => r.code === "geometry_impact_unconfirmed")
        ) {
          const preview = await previewGeometryChangeAction(zoneId, geometry);
          if (preview.ok) {
            setImpact(preview.data.bookings);
            return;
          }
        }
        setReasons(result.reasons);
        return;
      }
      setImpact(null);
      setWarnings(result.data.warnings);
      if (result.data.flagged) setFlagged(result.data.flagged);
      router.push(`/admin/zones/${result.data.id}`);
      router.refresh();
    });
  }

  function messageFor(reason: Reason): string {
    if (reason.code === "rate_limited") {
      return tErrors("rateLimited", {
        duration: formatSeconds(
          Number(reason.params?.retryAfterSeconds ?? 0),
          locale,
        ),
      });
    }
    // Every field problem and every geometry problem has its own sentence; a
    // code with none is a bug, and `errors.generic` is what says so without
    // printing a dotted path at an admin.
    const known = t.has(`problems.${reason.code}`);
    return known
      ? t(`problems.${reason.code}`, formatParams(reason.params, locale))
      : tErrors("generic");
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("geometryHeading")}</h2>
        <EditorMount
          value={initialGeometry ?? null}
          onChange={setGeometry}
          kind={draft.kind as "permitted" | "restricted" | "no_fly"}
          contextGeojson={contextGeojson}
        />

        {/*
          What the server will say, said now. `validateGeometry` is the same
          function the action runs — this is the identical answer, arriving
          before somebody presses save rather than after.
        */}
        {geometryCheck === null ? (
          <p className="text-muted-foreground text-sm">{t("geometryNone")}</p>
        ) : geometryCheck.ok ? (
          <div className="flex flex-col gap-1 text-sm">
            <p>
              {t("geometryOk", {
                area: formatArea(geometryCheck.areaSqM, locale),
                vertices: formatNumber(geometryCheck.vertexCount, locale),
              })}
            </p>
            {geometryCheck.warnings.map((warning) => (
              <p key={warning.code} className="text-muted-foreground">
                {t(`problems.geometry_${warning.code}`)}
              </p>
            ))}
          </div>
        ) : (
          <div className="border-destructive flex flex-col gap-1 rounded-lg border border-s-4 p-3 text-sm">
            {geometryCheck.problems.map((problem) => (
              <p key={problem.code}>
                {t(
                  `problems.geometry_${problem.code}`,
                  formatParams(problem.params, locale),
                )}
              </p>
            ))}
          </div>
        )}

        {status && status !== "draft" ? (
          <p className="text-muted-foreground text-sm">
            {t("geometryPublishedNotice")}
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">{t("identityHeading")}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${fieldId}-code`} label={t("code")} hint={t("codeHint")}>
            <Input
              id={`${fieldId}-code`}
              dir="ltr"
              value={draft.code}
              onChange={(event) => set("code", event.target.value)}
              maxLength={20}
              autoComplete="off"
            />
          </Field>

          <Field id={`${fieldId}-city`} label={t("city")} hint={t("cityHint")}>
            <Select
              id={`${fieldId}-city`}
              value={draft.cityId}
              onChange={(event) => set("cityId", event.target.value)}
            >
              {cities.map((row) => (
                <option key={row.id} value={row.id}>
                  {locale === "ar" ? row.nameAr : row.nameEn}
                </option>
              ))}
            </Select>
          </Field>

          {/* Arabic first — the app's primary language, and the authored one. */}
          <Field id={`${fieldId}-name-ar`} label={t("nameAr")}>
            <Input
              id={`${fieldId}-name-ar`}
              dir="rtl"
              lang="ar"
              value={draft.nameAr}
              onChange={(event) => set("nameAr", event.target.value)}
              maxLength={120}
            />
          </Field>
          <Field id={`${fieldId}-name-en`} label={t("nameEn")}>
            <Input
              id={`${fieldId}-name-en`}
              dir="ltr"
              lang="en"
              value={draft.nameEn}
              onChange={(event) => set("nameEn", event.target.value)}
              maxLength={120}
            />
          </Field>

          <Field id={`${fieldId}-district-ar`} label={t("districtAr")}>
            <Input
              id={`${fieldId}-district-ar`}
              dir="rtl"
              lang="ar"
              value={draft.districtAr}
              onChange={(event) => set("districtAr", event.target.value)}
              maxLength={120}
            />
          </Field>
          <Field id={`${fieldId}-district-en`} label={t("districtEn")}>
            <Input
              id={`${fieldId}-district-en`}
              dir="ltr"
              lang="en"
              value={draft.districtEn}
              onChange={(event) => set("districtEn", event.target.value)}
              maxLength={120}
            />
          </Field>

          <Field
            id={`${fieldId}-kind`}
            label={t("kind")}
            hint={t(`kindHint.${draft.kind}`)}
          >
            <Select
              id={`${fieldId}-kind`}
              value={draft.kind}
              onChange={(event) => set("kind", event.target.value)}
            >
              {ZONE_KINDS.map((value) => (
                <option key={value} value={value}>
                  {t(`kinds.${value}`)}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            id={`${fieldId}-authority`}
            label={t("authorityRef")}
            hint={t("authorityRefHint")}
          >
            <Input
              id={`${fieldId}-authority`}
              dir="ltr"
              value={draft.authorityRef}
              onChange={(event) => set("authorityRef", event.target.value)}
              maxLength={120}
            />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">{t("rulesHeading")}</h2>
        <p className="text-muted-foreground text-sm">{t("rulesIntro")}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id={`${fieldId}-ceiling`}
            label={t("ceiling")}
            hint={t("ceilingHint")}
            value={draft.ceilingAglM}
            nullable
            onChange={(value) => set("ceilingAglM", value)}
          />
          <NumberField
            id={`${fieldId}-floor`}
            label={t("floor")}
            hint={t("floorHint")}
            value={draft.floorAglM}
            onChange={(value) => set("floorAglM", value ?? 0)}
          />
          <NumberField
            id={`${fieldId}-capacity`}
            label={t("capacity")}
            hint={t("capacityHint")}
            value={draft.capacity}
            onChange={(value) => set("capacity", value ?? 1)}
          />
          <NumberField
            id={`${fieldId}-slot`}
            label={t("slotDuration")}
            hint={t("slotDurationHint")}
            value={draft.slotDurationMinutes}
            onChange={(value) => set("slotDurationMinutes", value ?? 60)}
          />
          <NumberField
            id={`${fieldId}-lead`}
            label={t("minLead")}
            hint={t("minLeadHint")}
            value={draft.minLeadMinutes}
            onChange={(value) => set("minLeadMinutes", value ?? 0)}
          />
          <NumberField
            id={`${fieldId}-advance`}
            label={t("maxAdvance")}
            hint={t("maxAdvanceHint")}
            value={draft.maxAdvanceDays}
            onChange={(value) => set("maxAdvanceDays", value ?? 30)}
          />
          <NumberField
            id={`${fieldId}-per-day`}
            label={t("slotsPerDay")}
            hint={t("slotsPerDayHint")}
            value={draft.maxSlotsPerPilotPerDay}
            onChange={(value) => set("maxSlotsPerPilotPerDay", value ?? 1)}
          />
          <Field
            id={`${fieldId}-weight`}
            label={t("maxWeightClass")}
            hint={t("maxWeightClassHint")}
          >
            <Select
              id={`${fieldId}-weight`}
              value={draft.maxWeightClass ?? ""}
              onChange={(event) =>
                set("maxWeightClass", event.target.value || null)
              }
            >
              <option value="">{t("noWeightLimit")}</option>
              {WEIGHT_CLASSES.map((value) => (
                <option key={value} value={value}>
                  {t(`weightClasses.${value}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <fieldset className="flex flex-col gap-2 rounded-lg border p-4">
          <legend className="px-1 text-sm font-medium">
            {t("permittedBuildTypes")}
          </legend>
          <p className="text-muted-foreground text-sm">
            {t("permittedBuildTypesHint")}
          </p>
          {BUILD_TYPES.map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.permittedBuildTypes.includes(value)}
                onChange={(event) =>
                  set(
                    "permittedBuildTypes",
                    event.target.checked
                      ? [...draft.permittedBuildTypes, value]
                      : draft.permittedBuildTypes.filter((v) => v !== value),
                  )
                }
              />
              <span>{t(`buildTypes.${value}`)}</span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-3">
          <Toggle
            checked={draft.autoApprove}
            onChange={(value) => set("autoApprove", value)}
            label={t("autoApprove")}
            hint={t("autoApproveHint")}
          />
          <Toggle
            checked={draft.nightAllowed}
            onChange={(value) => set("nightAllowed", value)}
            label={t("nightAllowed")}
            hint={t("nightAllowedHint")}
          />
          <Toggle
            checked={draft.requiresBroadcastRid}
            onChange={(value) => set("requiresBroadcastRid", value)}
            label={t("requiresBroadcastRid")}
            hint={t("requiresBroadcastRidHint")}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("notesHeading")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${fieldId}-notes-ar`} label={t("notesAr")}>
            <textarea
              id={`${fieldId}-notes-ar`}
              dir="rtl"
              lang="ar"
              rows={4}
              maxLength={2000}
              value={draft.notesAr}
              onChange={(event) => set("notesAr", event.target.value)}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent p-2.5 text-base outline-none focus-visible:ring-3 md:text-sm"
            />
          </Field>
          <Field id={`${fieldId}-notes-en`} label={t("notesEn")}>
            <textarea
              id={`${fieldId}-notes-en`}
              dir="ltr"
              lang="en"
              rows={4}
              maxLength={2000}
              value={draft.notesEn}
              onChange={(event) => set("notesEn", event.target.value)}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent p-2.5 text-base outline-none focus-visible:ring-3 md:text-sm"
            />
          </Field>
        </div>
      </section>

      {reasons.length > 0 ? (
        <div className="border-destructive flex flex-col gap-1 rounded-lg border border-s-4 p-4 text-sm">
          {reasons.map((reason, index) => (
            <p key={`${reason.code}-${index}`}>{messageFor(reason)}</p>
          ))}
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <FormProblem>
          {warnings.map((code) => t(`problems.geometry_${code}`)).join(" ")}
        </FormProblem>
      ) : null}

      {/*
        **The consequences of a moved boundary, before it moves.** Shown only
        after the server has refused the save, so what appears here is the
        server's own list of affected flights and not a guess made in the
        browser.
      */}
      {impact ? (
        <div className="border-destructive flex flex-col gap-3 rounded-lg border border-s-4 p-4">
          <h3 className="font-medium">{t("geometryImpactHeading")}</h3>
          <p className="text-sm">{t("geometryImpactIntro")}</p>
          <p className="text-muted-foreground text-sm">
            {t("geometryImpactNoLaunchPoint")}
          </p>

          {impact.length === 0 ? (
            <p className="text-sm">{t("impactNone")}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {impact.map((row) => (
                <li key={row.bookingId} className="flex flex-wrap gap-2">
                  <span className="font-medium">{row.pilotName}</span>
                  <bdi className="text-muted-foreground">
                    {formatDateTime(new Date(row.slotStart), locale)}
                  </bdi>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => save(true)}
            >
              {t("geometryImpactConfirm")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setImpact(null)}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : null}

      {flagged !== null ? (
        <p className="text-sm">
          {t("flaggedNotice", { count: formatNumber(flagged, locale) })}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={pending} onClick={() => save()}>
          {pending ? t("saving") : zoneId ? t("save") : t("createDraft")}
        </Button>
        <p className="text-muted-foreground self-center text-xs">
          {status && status !== "draft" ? t("geometryPublishedNotice") : t("draftNotice")}
        </p>
      </div>
    </div>
  );
}

/** Numbers reaching a message go through `format.ts` first — thread 22. */
function formatParams(
  params: Record<string, string | number> | undefined,
  locale: Locale,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    out[key] = typeof value === "number" ? formatNumber(value, locale) : value;
  }
  return out;
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

/**
 * A number field that can be emptied. `""` becomes `null` rather than `0`,
 * because "no ceiling" and "a ceiling of nought metres" are different claims —
 * one means the zone has no limit of its own, the other means nobody may fly.
 */
function NumberField({
  id,
  label,
  hint,
  value,
  nullable = false,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number | null;
  nullable?: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <Field id={id} label={label} hint={hint}>
      {/**
       * **Not `type="number"`** — Chrome renders a number input's display
       * value through the *browser's* locale, so on the Arabic page it draws
       * Arabic-Indic digits while the `value` stays ASCII. Invisible to every
       * check; the same trap as the banned `<input type="date">`.
       *
       * Losing `type="number"` means the field no longer rejects letters on
       * the browser's behalf, so it rejects them here instead — an
       * unparseable keystroke is *ignored* rather than turned into `null`,
       * which is a real value meaning "no ceiling".
       */}
      <Input
        id={id}
        inputMode="numeric"
        maxLength={6}
        dir="ltr"
        className="text-start font-mono"
        value={value === null ? "" : String(value)}
        onChange={(event) => {
          const raw = event.target.value.trim();
          if (raw === "") {
            onChange(nullable ? null : 0);
            return;
          }
          if (!/^\d+$/.test(raw)) return;
          onChange(Number(raw));
        }}
      />
    </Field>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        {label}
      </span>
      <span className="text-muted-foreground ps-6 text-xs">{hint}</span>
    </label>
  );
}
