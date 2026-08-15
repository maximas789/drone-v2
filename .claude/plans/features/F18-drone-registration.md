# F18 — Drone Registration Flow

**Wave:** 6 · **Depends on:** [F07](./F07-file-uploads.md), [F10](./F10-remote-id-issuance.md), [F14](./F14-workflow-and-audit.md), [F17](./F17-pilot-profile.md)

## Purpose

The flow the whole product exists for: registering a drone that has **no manufacturer serial number**. It must be obviously first-class, not a fallback path with an apology attached.

## Technical design

### Build type comes first

The wizard opens on the question that determines everything else:

| Choice | Copy | Consequence |
|---|---|---|
| **تجارية / Commercial** | Bought from a manufacturer | Serial number **required** |
| **تصنيع ذاتي / Self-built** | You built it yourself | Serial number field **not shown** |
| **FPV** | Racing or freestyle | Serial number field **not shown** |

For self-built and FPV, the UI says plainly: *"Your drone will be issued an Ajniha Remote ID — that is its registration identity."* Not "no serial number required" (an absence), but a statement of what it gets instead.

This inverts GACA's rule, and the code carries a comment saying so, so nobody later "fixes" the nullable column.

### Wizard steps

1. **Type** — build type, manufacturer (free text; a self-builder writes their own name), model, propulsion.
2. **Specifications** — `weightGrams`, from which `weightClass` is derived and stored (`micro <250g`, `light <4kg`, `medium <25kg`, `heavy ≥25kg`), plus `hasCamera` and the serial number if commercial. The weight class is shown live, with a note that under 250 g may be exempt from registration.
3. **Remote ID** — choose one or both:
   - **Ajniha Remote ID** (default, always available) — issued on approval, network-based.
   - **Declare an existing module** — kind, manufacturer, module serial, Declaration of Compliance reference, optional PDF, validity dates. Clearly marked *pending verification*.
4. **Photos** — at least one `overall`. Optional `serial_plate`, `remote_id_module`, `payload`.
5. **Review & submit** — everything on one screen, with an explicit statement that submission enters a **GACA review queue** and is not instant.

Progress saves at each step; a drone exists in `draft` from step 1, so a closed tab loses nothing.

### The submission gate

`submitDroneForReview` refuses unless: profile complete, at least one photo, a Remote ID mode chosen, and a serial present **iff** commercial. Each failure returns a specific bilingual reason with a link to the step that fixes it — never a generic "invalid form".

### Status and what a pilot sees

| Status | Screen |
|---|---|
| `draft` | Editable; "Submit for review" |
| `pending` | **Read-only.** "Under review since {date}" — no edits, no deletion |
| `approved` | Remote ID card, QR, valid-until, "Book a flight" |
| `rejected` | **The reviewer's reason quoted verbatim**, edit re-enabled, "Resubmit" |
| `expired` | "Renew" — same Remote ID retained, and the UI says so |
| `revoked` | Reason shown; no path back except an admin |

A rejection must never be a dead end. The screen shows the reason, the specific fields to fix, and one clear action.

### Deletion

Only in `draft`. A submitted registration is part of the regulatory record. The list offers Delete only on drafts, and the action re-checks status server-side. Deleting cascades photos and removes every stored blob ([F07](./F07-file-uploads.md)).

### List — `/[locale]/drones`

Cards with photo, nickname, make/model, **Remote ID code prominently** (or "pending" before approval), status badge, and valid-until with a warning tint inside 30 days. Empty state is a real invitation, not a blank panel — and it names the serial-less case, because that's who the product is for.

## Files

```
src/app/[locale]/(app)/drones/page.tsx
src/app/[locale]/(app)/drones/new/page.tsx
src/app/[locale]/(app)/drones/[id]/page.tsx
src/app/[locale]/(app)/drones/[id]/edit/page.tsx
src/lib/actions/drone.ts
src/lib/validation/drone.ts            weightClass derivation, serial-iff-commercial refine
src/components/drones/{wizard,step-type,step-specs,step-remote-id,step-photos,
                       step-review,card,status-badge,rejection-notice}.tsx
```

## Acceptance criteria

**The core case**
- [ ] Registering a **self-built drone with no serial number** completes end to end without a single validation error.
- [ ] The serial number field is **not rendered** for self-built or FPV.
- [ ] A commercial drone **without** a serial is refused; with one it succeeds.
- [ ] The self-built path states what the drone *gets* (an Ajniha Remote ID), not merely what isn't required.

**Wizard**
- [ ] Abandoning at step 3 and returning restores the draft.
- [ ] `weightClass` is derived correctly at each boundary (249 g → `micro`, 250 g → `light`, 3999 g → `light`, 4000 g → `medium`).
- [ ] A declared module can be added with a PDF, and shows as *pending verification*.
- [ ] Submitting with zero photos is refused with a reason linking to the photos step.
- [ ] Submitting with an incomplete profile is refused with a link to the profile wizard.

**States**
- [ ] A `pending` drone cannot be edited or deleted, through the UI **or** by calling the action directly.
- [ ] A rejected drone shows the reviewer's reason **verbatim** and re-enables editing.
- [ ] Resubmitting increments `rejectionCount`.
- [ ] An approved drone shows its Remote ID code, a scannable QR, and the valid-until date.
- [ ] An expired drone offers Renew and states the Remote ID stays the same — and after renewal the code is unchanged.
- [ ] Deleting is offered only on drafts; calling delete on a `pending` drone is refused server-side.
- [ ] Deleting a draft removes its rows **and** every stored blob.

**Ownership & UI**
- [ ] Pilot B opening pilot A's drone gets 404; the same for edit and every drone action.
- [ ] The list shows only the signed-in pilot's drones.
- [ ] The empty state is a real invitation naming the serial-less case.
- [ ] A drone within 30 days of expiry is visually flagged in the list.
- [ ] The wizard renders correctly in Arabic RTL at 375 px, with Latin numerals for weights and dates.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` pass.
