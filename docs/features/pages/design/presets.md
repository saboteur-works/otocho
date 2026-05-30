# Preset page — design

**Feature:** Pages · **Phase:** 1 (design) · **Status:** GUIDANCE (locked to implementation in Task 9, FR-11)
**Spec:** `docs/features/pages/spec.md` — FR-8, FR-9, FR-10
**Task:** Task 8 (Presets page)

> This document is Phase-1 guidance. The editor may deviate during the build; Task 9 reconciles this doc with what shipped.

## Purpose

A Preset page captures a single track's processing chain in human-readable form — the named devices, their settings, and the specific parameter values that made the sound work — so it can be recalled and reused later, even without the DAW file. It stores *intent and settings*, not binary plugin state. Capturing a value must be faster and lighter than a text file.

## Design — signal chain + detail

The page is scoped to one named track (FR-8). Devices form an ordered left→right chain mirroring signal flow; selecting a node opens its detail below.

```
+-----------------------------------------------+
| Preset: Lead Vocal                         ⋯  |
+-----------------------------------------------+
| [Pro-Q 3]→[CLA-2A]→[Verb]→  [+]               |
|    ▔▔▔▔                                        |
+-----------------------------------------------+
| Pro-Q 3                                  [⋯]  |
| Settings                                      |
| [ HPF 80Hz, +3 @ 5k … free text, optional ]   |
|                                               |
| Parameters (optional)                         |
|   HPF            =  80 Hz              [×]     |
|   Air            =  +2.5 dB            [×]     |
|   + add parameter                             |
+-----------------------------------------------+
```

## Track identity

- A preset page **is** a track: the track name is the page title, editable inline (and via the shell's context-menu Rename — same field).
- One preset page = one track (FR-8). A project may hold many preset pages, e.g. one per track (FR-9) — this follows from the page list + repository, no special handling here.

## Device chain

- Devices render as nodes in a left→right chain, in **signal order**.
- **Add:** `[+]` at the end of the chain creates a device, selects it, and focuses its name field (type the name straight away — minimal friction).
- **Reorder:** drag chain nodes to change signal order; the new order persists.
- **Select:** click a node to open its detail panel below; the selected node is marked (underline/accent).
- **Delete:** via the node / detail `⋯`, with confirm; remaining devices close ranks, order preserved.

## Device detail

Each device has:
- **Name** — required, editable inline.
- **Settings** — an *optional* free-text field for prose ("HPF 80Hz, +3 @ 5k"). The quick, low-structure capture path.
- **Parameters** — an *optional* list of key=value rows; both key and value are free text (units live in the value, e.g. `80 Hz`). Add via `+ add parameter`; remove via the row's `[×]`. Use when structured recall is worth the extra typing.

Free-text Settings and structured Parameters coexist: jot prose fast, or break out exact values when it matters (the hybrid resolved in spec OQ-1).

## Empty states

- **No devices:** track name + `No devices yet.  [+ Add first device]`.
- **Device with no detail:** just the name; Settings shows a placeholder, Parameters shows only `+ add parameter`. Empty optional fields are valid.

## Inline editing & autosave (FR-10)

Everything edits inline — no modals. Name, Settings, and parameter rows autosave (debounced) like the other pages. Reorder and add/remove persist immediately.

## Data shape

- Page record: `{ trackName, devices: { id, name, settings?, params?: { key, value }[] }[] }`.
- Devices and param rows carry **stable ids**; chain order is an explicit field so reorder is a pure data change and never depends on array position for identity.

## Mobile

The horizontal chain scrolls horizontally; the detail panel stacks below full-width. (The chain-overview-plus-detail split is tight on mobile — acceptable since structured preset authoring is desktop-first per the spec's mobile scope; mobile primarily reads these.)

## Brand

`font-display` for the track title; `font-mono` uppercase `tracking-label` for the **Settings** / **Parameters** headings and chain node labels; `fg-tertiary` for placeholders and the `=` separators. Tokens per the saboteur-styles source of truth (via `packages/ui`).

## Open notes for implementation

- Chain node visual (pill vs. box, arrow glyph) and selected-state treatment to finalize in Task 8.
- Param-row alignment (key column width, value alignment) to tune during the build.
- Whether device reorder reuses the dnd approach from Task 5 (page reorder) — likely yes; record in Task 9.
