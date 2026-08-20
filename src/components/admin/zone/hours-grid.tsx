"use client";

import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState, useTransition } from "react";
import { SlotPreview } from "@/components/admin/zone/slot-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setZoneHoursAction } from "@/lib/actions/admin";
import type { Reason } from "@/lib/actions/result";
import {
  formatMinuteOfDay,
  formatSeconds,
  formatWeekday,
} from "@/lib/format";
import type { Locale } from "@/lib/locale";
import {
  MAX_WINDOWS_PER_DAY,
  WEEKDAYS,
  parseHhMm,
  toHhMm,
  validateZoneHours,
  type HourWindow,
  type Weekday,
} from "@/lib/validation/zone-hours";

/**
 * The weekly operating-hours grid — **Sunday first**, the Saudi week.
 *
 * Sunday is 0 in `zone_hour.weekday`, in `riyadhWeekdayOf`, and here. A grid
 * that started on Monday would be a fourth opinion about which day is which,
 * and the one an admin reads.
 *
 * **Times are typed as text, not into `<input type="time">`.** Thread 46: Chrome
 * renders the native date and time controls from the *browser's* locale and
 * ignores `lang` on the element and on `<html>`, so under an Arabic Chrome the
 * field prints Arabic-Indic digits and an AM/PM marker — rule 6 broken through
 * a surface `format.ts` cannot reach. A plain `dir="ltr"` field parsed by
 * `parseHhMm` is under this app's control in both languages.
 *
 * **The preview lives inside this component** because it must show the hours on
 * *screen*, including unsaved ones. That is the whole point of it: it is what
 * stops an admin discovering at 06:00 that their window is shorter than the
 * slot duration and derives nothing.
 */

export type HoursGridProps = {
  zoneId: string;
  initial: readonly HourWindow[];
  locale: Locale;
  /** Read by the preview: the grid it derives is the zone's own. */
  slotDurationMinutes: number;
  minLeadMinutes: number;
  capacity: number;
  nightAllowed: boolean;
  /** The zone's bbox centre — sunrise and sunset are a place, not a setting. */
  centre: { lat: number; lng: number };
};

type DraftWindow = {
  key: string;
  weekday: Weekday;
  opens: string;
  closes: string;
};

export function HoursGrid({
  zoneId,
  initial,
  locale,
  slotDurationMinutes,
  minLeadMinutes,
  capacity,
  nightAllowed,
  centre,
}: HoursGridProps) {
  const t = useTranslations("zoneAdmin");
  const tErrors = useTranslations("errors");
  const fieldId = useId();

  /**
   * **Row keys come from the index, and new ones from a ref — never a
   * module-level counter.** The first version used one, and it rendered `w1` on
   * the server and `w2` in the browser: the module is evaluated once per
   * process on each side, so the counter had already moved on by the time the
   * client rendered. React reported a hydration mismatch on `htmlFor` and `id`,
   * with `typecheck`, `lint` and `test` all green — thread 11 again, found by
   * opening the console.
   *
   * The ref starts past the initial rows, so every key stays unique, and keys
   * minted by `addWindow` are created after hydration where no server render
   * exists to disagree with.
   */
  const nextKey = useRef(initial.length);
  const [rows, setRows] = useState<DraftWindow[]>(() =>
    initial.map((window, index) => ({
      key: `w${index}`,
      weekday: window.weekday,
      opens: toHhMm(window.opensMinute),
      closes: toHhMm(window.closesMinute),
    })),
  );
  const [saved, setSaved] = useState<string>(() => JSON.stringify(initial));
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  /**
   * Every row that parses becomes a window. A half-typed `06:` is simply not a
   * window yet — it is neither an error nor an opening time, and flashing a
   * refusal at somebody mid-keystroke teaches them to ignore refusals.
   */
  const windows = useMemo<HourWindow[]>(
    () =>
      rows.flatMap((row) => {
        const opensMinute = parseHhMm(row.opens);
        const closesMinute = parseHhMm(row.closes);
        if (opensMinute === null || closesMinute === null) return [];
        return [{ weekday: row.weekday, opensMinute, closesMinute }];
      }),
    [rows],
  );

  const check = useMemo(() => validateZoneHours(windows), [windows]);
  const complete = rows.length === windows.length;
  const dirty = JSON.stringify(sorted(windows)) !== saved;

  function addWindow(weekday: Weekday) {
    setDone(false);
    setRows((current) => [
      ...current,
      // 06:00–12:00 is what every seeded zone opens with, so the common case is
      // one click and no typing.
      { key: `w${nextKey.current++}`, weekday, opens: "06:00", closes: "12:00" },
    ]);
  }

  function update(key: string, patch: Partial<DraftWindow>) {
    setDone(false);
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function remove(key: string) {
    setDone(false);
    setRows((current) => current.filter((row) => row.key !== key));
  }

  function save() {
    startTransition(async () => {
      setReasons([]);
      setDone(false);
      const result = await setZoneHoursAction(zoneId, sorted(windows));
      if (!result.ok) {
        setReasons(result.reasons);
        return;
      }
      setSaved(JSON.stringify(sorted(windows)));
      setDone(true);
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{t("hoursHeading")}</h2>
        <p className="text-muted-foreground text-sm">{t("hoursIntro")}</p>
      </div>

      <div className="flex flex-col gap-3">
        {WEEKDAYS.map((weekday) => {
          const dayRows = rows.filter((row) => row.weekday === weekday);
          return (
            <div
              key={weekday}
              className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:gap-4"
            >
              {/*
                `sm:flex-col`, not `sm:block`: as a block the day name and the
                "closed" label are two inline spans with nothing between them,
                and they render as one run — `الأحدمغلقة`. Found by opening the
                page, which is the only thing that finds it (thread 11).
              */}
              <div className="flex min-w-32 flex-row items-center justify-between gap-2 sm:flex-col sm:items-start sm:gap-0.5">
                <span className="text-sm font-medium">
                  {formatWeekday(weekday, locale)}
                </span>
                {dayRows.length === 0 ? (
                  <span className="text-muted-foreground text-xs">
                    {t("noWindows")}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col gap-2">
                {dayRows.map((row) => (
                  <div key={row.key} className="flex flex-wrap items-end gap-2">
                    <TimeField
                      id={`${fieldId}-${row.key}-opens`}
                      label={t("opensAt")}
                      value={row.opens}
                      onChange={(value) => update(row.key, { opens: value })}
                    />
                    <TimeField
                      id={`${fieldId}-${row.key}-closes`}
                      label={t("closesAt")}
                      value={row.closes}
                      onChange={(value) => update(row.key, { closes: value })}
                    />
                    {/*
                      The formatted pair beside the raw fields: the fields hold
                      ASCII the app parses, this is what `format.ts` renders, so
                      an admin sees the time the way a pilot will.
                    */}
                    <span className="text-muted-foreground pb-2 text-xs">
                      <bdi>{readable(row, locale)}</bdi>
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mb-0.5"
                      onClick={() => remove(row.key)}
                    >
                      {t("removeWindow")}
                    </Button>
                  </div>
                ))}

                {dayRows.length < MAX_WINDOWS_PER_DAY ? (
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addWindow(weekday)}
                    >
                      {t("addWindow")}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* The same refusals the action will give, arriving before the save. */}
      {!check.ok && complete ? (
        <div className="border-destructive flex flex-col gap-1 rounded-lg border border-s-4 p-3 text-sm">
          {check.problems.map((code) => (
            <p key={code}>{t(`problems.${code}`)}</p>
          ))}
        </div>
      ) : null}

      {reasons.length > 0 ? (
        <div className="border-destructive flex flex-col gap-1 rounded-lg border border-s-4 p-3 text-sm">
          {reasons.map((reason, index) => (
            <p key={`${reason.code}-${index}`}>
              {reason.code === "rate_limited"
                ? tErrors("rateLimited", {
                    duration: formatSeconds(
                      Number(reason.params?.retryAfterSeconds ?? 0),
                      locale,
                    ),
                  })
                : t.has(`problems.${reason.code}`)
                  ? t(`problems.${reason.code}`)
                  : tErrors("generic")}
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={pending || !check.ok || !complete}
          onClick={save}
        >
          {t("saveHours")}
        </Button>
        {done && !dirty ? (
          <p className="text-sm">{t("hoursSaved")}</p>
        ) : dirty ? (
          <p className="text-muted-foreground text-sm">{t("hoursUnsaved")}</p>
        ) : null}
      </div>

      <SlotPreview
        windows={check.ok ? check.value : []}
        locale={locale}
        slotDurationMinutes={slotDurationMinutes}
        minLeadMinutes={minLeadMinutes}
        capacity={capacity}
        nightAllowed={nightAllowed}
        centre={centre}
        unsaved={dirty}
        invalid={!check.ok || !complete}
      />
    </section>
  );
}

function sorted(windows: readonly HourWindow[]): HourWindow[] {
  return [...windows].sort(
    (a, b) => a.weekday - b.weekday || a.opensMinute - b.opensMinute,
  );
}

function readable(row: DraftWindow, locale: Locale): string {
  const opens = parseHhMm(row.opens);
  const closes = parseHhMm(row.closes);
  if (opens === null || closes === null) return "—";
  return `${formatMinuteOfDay(opens, locale)} – ${formatMinuteOfDay(closes, locale)}`;
}

/**
 * A time of day as text.
 *
 * `dir="ltr"` on the input is safe and necessary — `06:00` is a bare numeric
 * string with no strong-RTL run in it, so it carries none of the hazard that
 * puts `dir="ltr"` on a formatted Arabic date (a month name reverses the
 * numerals around it). The rendered pair beside it is wrapped in `<bdi>` for
 * exactly that reason.
 */
function TimeField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        placeholder="06:00"
        maxLength={5}
        className="w-24 font-mono"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={parseHhMm(value) === null}
      />
    </div>
  );
}
