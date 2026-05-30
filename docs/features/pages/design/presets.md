# Preset page — design

**Feature:** Pages · **Phase:** 2 (implementation) · **Status:** LOCKED — matches shipped implementation (Task 9, FR-11)
**Spec:** `docs/features/pages/spec.md` — FR-8, FR-9, FR-10
**Impl:** `apps/app/src/pages/PresetPage.tsx`

## Purpose

A Preset page captures a single track's processing chain in human-readable form — named devices, their settings, and the specific parameter values that made the sound work — so it can be recalled and reused later, even without the DAW file.

## Design — signal chain + detail

The page is scoped to one named track (FR-8). Devices form an ordered left→right horizontal chain; the selected device's detail renders below the chain.

```
+-----------------------------------------------+
| Lead Vocal                                    |
+-----------------------------------------------+
| [Pro-Q 3] → [CLA-2A] → [Verb] →  [+]          |
|  (selected border accent)                     |
+-----------------------------------------------+
| Pro-Q 3                              [X]      |  ← X = delete device
| Settings                                      |
| [ HPF 80Hz, +3 @ 5k … textarea, bg-canvas ]  |
|                                               |
| Parameters                                    |
|  HPF       =  80 Hz                    [×]   |
|  Air       =  +2.5 dB                  [×]   |
|  + add parameter                             |
+-----------------------------------------------+
```

## Track identity

The track name **is** the page `title` field from the shared `PageBase` — the same field the shell's Rename action edits. There is no separate `trackName` field. The `PresetPage` component renders `page.title` as a `font-display text-lg font-semibold` heading above the chain.

*(Deviation from Phase-1 data shape which showed `{ trackName, ... }` — resolved in Task 2 to use the shared `title` for single source of truth.)*

## Device chain

Devices render as horizontal pill-buttons (`rounded-md border px-3 py-1.5 text-xs`) separated by `→` text glyphs. The chain is wrapped in `@dnd-kit/core` `DndContext` + `SortableContext` (`horizontalListSortingStrategy`), using the same `PointerSensor` with `activationConstraint: { distance: 6 }` as the page list (Task 5).

- **Selected node**: `border-fg-primary bg-surface-hover text-fg-primary`. Unselected: `border-brand-rule text-fg-secondary`.
- **Add**: `[+]` button (`rounded-md border border-dashed`) at the end of the chain calls `addDevice()`, which appends `{ id: newId(), name: "New device", settings: "", params: [] }`, saves, and selects the new device.
- **Reorder**: drag chain nodes; `onDragEnd` splices the array and saves.
- **Select**: click a node to show its detail below. First device is auto-selected on open.

### Add-device focus (deviation from Phase-1 design)

**Phase-1 designed:** adding a device focuses the name field so the user can type the name immediately.

**Shipped:** adding selects the device and shows its detail, but the name field is not automatically put into edit mode. The user clicks the name to rename it. Minor deviation — acceptable for MVP.

## Device detail

The `DeviceDetailPanel` component remounts when `selectedDevice.id` changes (via `key={selectedDevice.id}`), resetting local state cleanly.

### Name (deviation from Phase-1 design)

**Phase-1 designed:** device rename via a `⋯` menu.

**Shipped:** the device name is rendered as a `<button>` (`font-display text-base font-semibold`) that, when clicked, switches to an `<Input>` in a `<form>`. Blur or Enter submits; Escape cancels and resets to the saved name. No ⋯ menu for the device — delete uses the X button instead (see below).

### Delete

An `X` (`lucide-react X`, `h-4 w-4`) button in the top-right of the detail panel triggers an `AlertDialog` confirm. On confirm, the device is removed and the selection advances to the first remaining device (or null if empty).

### Settings

An optional free-text `<textarea>` (`rows={3}`, `bg-otocho-canvas`, `resize-none`). Saves with a **400ms debounce** on change. Placeholder: `"Free-text notes about this device…"`.

### Parameters

An optional list of `{ id, key, value }` rows. All three fields carry a stable `id` (UUID).

- **Add**: `+ add parameter` button appends `{ id: newId(), key: "", value: "" }` and saves immediately.
- **Key / Value**: each is an `<input>` (`font-mono text-xs`, `bg-otocho-canvas`). `onChange` calls `onUpdateParam` **immediately** (no debounce — single-field updates are cheap and the param row is already structured).
- **Delete**: `[×]` (`X h-3.5 w-3.5`) button removes the row and saves immediately.
- **Layout**: key input is `w-32` (fixed); `=` separator; value input is `flex-1`; `[×]` is `shrink-0`.

*(Deviation from Phase-1: Phase-1 noted params as "autosave (debounced)". Shipped as immediate save on change — simpler and correct since each keystroke in a short field is a discrete intent.)*

## Empty states

- **No devices**: page heading + a `"+ Add first device"` button centered in the content area. Clicking calls `addDevice()`.
- **Device with no settings**: textarea is empty with placeholder. Parameters section shows only `+ add parameter`.

## Data shape (as shipped)

```ts
interface PresetParam { id: string; key: string; value: string; }
interface PresetDevice { id: string; name: string; settings: string; params: PresetParam[]; }
interface PresetPage extends PageBase { type: "presets"; devices: PresetDevice[]; }
```

`settings` is always a string (empty string = unused). `params` is always an array (empty = unused). Chain order is positional (array order) — reorder splices and saves the full devices array.

## Mobile

The horizontal chain overflows with `overflow-x-auto`. The detail panel stacks below full-width naturally. Desktop-first per the spec's mobile scope — mobile reads presets, desktop authors them.

## Brand

`font-display` for the track title and device name. `font-mono text-xs uppercase tracking-label text-fg-tertiary` for **Settings** / **Parameters** headings. `font-mono text-xs` for param keys and values. `bg-otocho-canvas` for settings textarea and param inputs. `text-fg-tertiary` for `=` separators and `+ add parameter`. Tokens from `packages/ui` via the saboteur-styles source of truth.
