# F25 — Compliance Analytics & Audit Browser

**Wave:** 7 · **Depends on:** [F14](./F14-workflow-and-audit.md) · **Reviewer (analytics) + admin (audit)**

---

## The split — settled with the user before any code was written (2026-08-21)

**F25 is built in two sessions, a then b.** Same seam rule as F16/F19/F20/F21/F22/F23:
**nothing in a part points at a route a later part builds**, so each tab on the admin
strip goes somewhere from the moment it is drawn.

### F25a — Analytics · `/[locale]/admin/analytics` · reviewer

The six header tiles, all seven charts, the 7/30/90/all date range, the CSV export with
its UTF-8 BOM, `src/lib/analytics/queries.ts`, the ten `components/admin/analytics/*`
files, the shared categorical palette, the RTL-axis decision and its on-page sentence,
and every chart's empty state. Adds the **`analytics`** tab to `QueueTabs`.

**It goes first because it is the pitch artefact.** The build-type split — the share of
registrations that are self-built or FPV, aircraft that could not legally have registered
before — is this product's evidence, and it is the one screen a regulator is shown. It
also establishes the palette, the date-range control and the CSV writer that F25b reuses.

~~It owns a decision this file does not make: there is no charting library
installed.~~ **Settled with the user before any chart code was written (2026-08-21):
hand-rolled SVG, no charting library, and none installed.** The reasoning, so it is
not re-litigated:

- Two of the seven forms — the turnaround histogram and the weekday × hour heatmap —
  have no primitive in any charting library, so a library would have covered five of
  seven and left the build carrying two chart idioms.
- Six of the seven charts now render **on the server**. Arabic labels come from
  `getTranslations` and every number goes through `src/lib/format.ts` *by construction*.
  A library's own tick and tooltip formatters are a second route to `Intl` that rule 6's
  ESLint ban cannot see, and it would have had to be threaded by hand at every call site.
- One `"use client"` module ships to the browser — `chart-hover.tsx`, the shared hover
  layer — instead of seven chart components.
- No new dependency in a proposal whose credibility rests on what it does not claim.

The cost, paid: axis layout, tick thinning and the hover overlay were written here, and
four defects in them were found by opening the page rather than by any check. They are
listed in the build log's Session 33 entry.

### F25b — Audit browser · `/[locale]/admin/audit` · admin only

Cursor pagination and the filters in `src/lib/data/audit.ts`, the field-level
`before`/`after` diff, the **geometry diff map**, the audited CSV export, the integrity
grep, and the one missing entity timeline. Adds the **`audit`** tab.

**Two things shrink it, and both were checked rather than assumed:**

1. **The entity timeline is already built on three of the four pages.** `AuditTrail`
   (F22a) renders on `/admin/drones/[id]`, `/admin/bookings/[id]` and
   `/admin/pilots/[id]`, and F24 put it on the lookup result card too. **Only
   `/admin/zones/[id]` has none.** The acceptance criterion "drone, booking and zone
   detail pages each show their own inline audit trail" is therefore one page of work
   plus a re-check of the other two, not four builds. `listAuditForDrone` in
   `src/lib/data/review.ts` is the worked example of a trail keyed on two entity ids.
2. **`audit-actions.ts` already names every action a trail can show**, across five
   lists including F24's `USER_TRAIL_ACTIONS`, and `audit-actions.test.ts` fails if a
   newly audited action arrives without a label. The audit browser spans *every* entity
   type, so it is the first screen that renders all five lists at once — which is
   exactly what that test was built to make safe.

**And one thing that will cost more than it looks: the geometry diff map.** It is the
second MapLibre surface in the build and inherits every trap F20 paid for —
`setRTLTextPlugin` exactly once, `setWorkerUrl` pointed at `public/vendor/maplibre/`
before anything touches the worker pool, and `ensureRtlTextPlugin` rather than a bare
`new Map()`. **A blank map in a screenshot is usually not a blank map: click the canvas
first.** Two polygons overlaid, old and new, is the whole feature — but the plumbing
under it is the part that cost most of a session last time.

### Not in either part

Nothing. F25's spec is fully covered by a + b.

## Purpose

The oversight view: what is happening across the platform, and the searchable record of every decision anyone made. This is the AirHub "operations centre" pattern — the screen that would justify Ajniha to a regulator who has to answer for it.

## Technical design

### Analytics — `/[locale]/admin/analytics`

Reviewer-accessible. Every number is derived from live queries; **nothing is precomputed or mocked**.

**Header tiles** (current state, not vanity metrics): pending registrations · pending bookings · **median review turnaround** over 30 days · active registrations · expiring within 30 days · flights authorised today.

**Charts:**

| Chart | Form | Why this form |
|---|---|---|
| Registrations over time, split by build type | Stacked area | Shows the serial-less share growing — **the single most important chart in the pitch** |
| Approval outcomes | Grouped bar, approved vs rejected per month | Trend matters more than a total |
| Review turnaround distribution | Histogram | A median hides a long tail; a regulator cares about the tail |
| Bookings by zone | Horizontal bar | Long Arabic zone names need horizontal room |
| Zone utilisation | Heatmap, weekday × hour | Where and when demand actually is |
| No-show rate over time | Line | Compliance signal |
| Remote ID resolutions | Line, split **public / staff** | Shows the enforcement side is being used |

**Build-type split is the headline.** The proportion of registered drones that are self-built or FPV — aircraft that could not legally have registered before — is the product's evidence. It goes first, largest.

**The resolutions split is public-against-staff, not the "anonymous / reviewer" this
table said** (corrected in F25a). `remote_id_scan.viewer_level` takes five values, and
the other three — `pilot`, `owner`, `admin` — are 26 of the 30 scans in this database.
Charting two of five would have drawn a total that is not the total. The public
(anonymous, pilot, owner) against staff (reviewer, admin) answers the question this row
is actually asking and every scan lands in exactly one series.

Charts follow the project's `dataviz` conventions: one categorical palette shared across every chart, so `self_built` is the same colour everywhere; accessible in light and dark; **direct labels rather than a legend** where a series can be labelled at its end; axes and tooltips through `src/lib/format.ts`.

**"At its end" did not survive real data** (corrected in F25a). Two series whose last
non-empty bucket is a month apart print their numbers fifteen pixels apart on a
three-year axis, and two series ending on the same value overlap exactly. The direct
label is therefore the **series total, carried in the legend beside its swatch** —
which cannot collide, is present even when a series is empty for the whole window, and
binds the number to the colour. The histogram and the horizontal bar chart, where
collision is impossible, still label every mark in place.

**RTL charts:** the plot area is not mirrored (time still runs left→right — reversing a time axis for Arabic misleads more than it accommodates), but axis labels, tooltips, and legends are Arabic and right-aligned. Numbers stay Latin. Documented on the page so it reads as a decision.

**One chart is mirrored, and F25a states the exception on the page.** *Bookings by
zone* has a **count** on its x axis and a list of names on its y axis; bars growing away
from the names they belong to are back to front in any language. The rule the page
states is that a *time* axis is fixed and reading order is not.

**And the mechanic that nearly broke it:** SVG's `text-anchor` is relative to the inline
base direction, so `end` anchors the **left** edge on an Arabic page. Every y-axis tick
was anchored backwards into the plot, with every check green. `anchorAtMinX` /
`anchorAtMaxX` in `src/lib/analytics/layout.ts` say what they mean; `dir="ltr"` on the
SVG is **not** the fix, because it would simultaneously reorder every Arabic date label
on the category axis.

Date range: 7 / 30 / 90 days / all, defaulting to 30. Export current view to CSV with UTF-8 BOM so Arabic opens correctly in Excel.

### Empty state

A new deployment has no data. Every chart shows a purposeful empty state — "no registrations yet" — never a zero-line axis that looks like a rendering failure.

### Audit browser — `/[locale]/admin/audit`

**Admin only.** The complete `audit_event` stream, newest first, paginated by cursor (offset pagination drifts as rows are inserted mid-scroll).

Filters: actor, role, action, entity type, entity id, date range, and `actorIsSystem`. Free text over `reason`.

Each row: timestamp (Riyadh, Gregorian, Latin numerals), actor + role **at the time**, action, entity with a link, and reason. Expanding shows the `before`/`after` diff, rendered as a field-level comparison rather than raw JSON — except zone geometry, which gets a **small map showing the old and new boundary overlaid**, because that is the one diff a human genuinely cannot read as text.

**Entity timeline:** every drone, booking, and zone detail page carries its own audit trail inline — the question is usually "what happened to *this*", not "what happened at 14:32".

### Integrity

- **Append-only, and visibly so.** No edit control, no delete control, no bulk action, and no server action that updates or deletes an `audit_event`. The page says so in one line.
- Viewing the audit log is **itself audited** for reveals and lookups, but not for plain browsing — logging every page view would bury the events that matter.
- A deleted user's events remain with `actorUserId = null` and the name captured at write time, so the trail survives account deletion.
- Export to CSV is admin-only and writes an audit event, because a full audit export is a serious act.

### Performance

Analytics queries are aggregate SQL with date-range predicates against the indexes from [F03](./F03-database-schema.md), cached with a short revalidate. The audit browser is cursor-paginated on `(created_at desc, id)`. Neither loads a full table into memory.

## Files

```
src/app/[locale]/(admin)/admin/analytics/page.tsx
src/app/[locale]/(admin)/admin/audit/page.tsx
src/lib/analytics/queries.ts
src/lib/data/audit.ts                  cursor pagination + filters
src/components/admin/analytics/{stat-tiles,registrations-chart,outcomes-chart,
                                turnaround-histogram,zone-bar,utilisation-heatmap,
                                noshow-line,resolutions-line,date-range,export-csv}.tsx
src/components/admin/audit/{table,filters,diff-view,geometry-diff-map,entity-timeline}.tsx
```

## Acceptance criteria

**Analytics**
- [ ] Every tile and chart is derived from a live query — **no mock or precomputed data anywhere**.
- [ ] The build-type split chart is first and largest, and shows the self-built + FPV share.
- [ ] Median review turnaround matches a hand-checked calculation on seeded data.
- [ ] All seven charts render with real data.
- [ ] One shared categorical palette — `self_built` is the same colour in every chart.
- [ ] Charts are legible in light **and** dark mode, and distinguishable in greyscale.
- [ ] Axis labels and tooltips are Arabic in the Arabic locale, right-aligned; numbers stay Latin; dates are Gregorian.
- [ ] The time axis is **not** reversed in RTL, and the page says why.
- [ ] Date range switching updates every chart.
- [ ] CSV export opens in Excel with Arabic intact (UTF-8 BOM present).
- [ ] With an empty database every chart shows a purposeful empty state, not a broken axis.
- [ ] Long Arabic zone names do not overflow or truncate mid-word.

**Audit browser**
- [ ] Admin-only: a **reviewer** gets 404 on `/admin/audit` but **can** reach `/admin/analytics`.
- [ ] Every filter works, alone and combined.
- [ ] Cursor pagination is stable — inserting a new event mid-scroll does not duplicate or skip rows.
- [ ] `actorRole` shows the role at the time; promoting a reviewer does not rewrite old rows.
- [ ] A deleted user's events remain, with `actorUserId = null` and the captured name.
- [ ] System events show as system, with `actorIsSystem: true`.
- [ ] The before/after diff renders field-level, not raw JSON.
- [ ] A zone geometry change renders old and new boundaries overlaid on a map.
- [ ] **No UI control anywhere edits or deletes an audit event**, and no such server action exists (verified by grep).
- [ ] Drone, booking, and zone detail pages each show their own inline audit trail.
- [ ] A CSV export writes an audit event.
- [ ] Both pages render correctly in Arabic RTL; tables are readable at 1024 px.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
