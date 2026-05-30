# Feature Spec: Pages

**Parent spec:** `docs/spec.md` (Otocho MVP) — satisfies US-2–US-5, US-9, FR-2–FR-10
**Status:** Draft
**Phases:** (1) Page visual/UI design — markdown + ASCII wireframes in `docs/features/pages/`, treated as guidance; (2) Implementation — locks the design docs and updates them to match what shipped, so no UI detail is lost.

## Overview

Pages are the purpose-built documents that fill an Otocho project — the proof of the product's core thesis that a fixed-shape page beats a blank canvas. This feature delivers the three MVP page types (Notes, Build log, Presets) and the page-management surface inside a project (add, rename, reorder, delete), so a producer can capture the right kind of context in the right shape, fast enough to do mid-session. It owns the pages and their contents, not the project container, sync, or search.

## Goals

- A producer can add any of the three MVP page types to a project and tell them apart by their distinct shape.
- A producer can capture a free-form thought (Notes), how a track came together (Build log), and a track-scoped preset chain (Presets), each in a page designed for it.
- A producer can manage a project's pages — add, rename, reorder, delete — without friction.
- Capturing a Build-log move or preset value is measurably faster and lighter than typing into a plain text file.
- Each page type's visuals/UI are documented in Phase 1 and locked to the implementation in Phase 2.

## Non-goals

- The project container lifecycle, sync/conflict handling, and global search (separate features; Pages assumes a project exists).
- Any page type beyond Notes, Build log, Presets (Sketch, to-do, reference are v1).
- Audio or MIDI playback of any kind.
- Templates per page type (v1) and page-to-page linking (v2).
- Mobile structured authoring of preset chains (defined by the sync/mobile feature; stays desktop).

## User stories

- As a producer, I want to add purpose-built pages (Notes, Build log, Presets) to a project so each kind of information has the right shape.
- As a producer, I want free-form Notes so I can jot any thought quickly.
- As a producer, I want to record arrangement ideas and a sequence of moves in a Build log so I can remember and repeat how I made a track.
- As a producer, I want to capture named plugin/parameter settings on a track-scoped preset page so I can recall and reuse a chain.
- As a producer, I want capture to be near-frictionless so I'll actually fill pages mid-session.

## Functional requirements

1. A project MUST be able to contain multiple pages of mixed types. [FR-2]
2. The system MUST provide exactly three page types: Notes, Build log, and Presets. [FR-3]
3. Users MUST be able to add, rename, reorder, and delete pages within a project; reordering MUST be by drag-and-drop in the page list. [FR-4]
4. Creating a page MUST take no more than two interactions (choose type → page created). [FR-10]
5. Notes pages MUST support free-form text entry. [FR-5]
6. Build log pages MUST present, on one page, (a) an editable free-form sketch area for arrangement/ideas and (b) an append-only, timestamped move feed with a persistent inline quick-add input. [FR-6]
7. The move feed MUST support single-action quick-append, and appended moves MUST NOT be reordered or silently rewritten. [FR-9]
8. Preset pages MUST be scoped to a single named track and MUST hold an ordered chain of devices; each device MUST have a name, MUST have an optional free-text settings field, and MAY hold structured key-value parameter rows. [FR-7]
9. A project MUST support multiple preset pages (e.g., one per track). [FR-8]
10. Content editing MUST be possible inline, without opening a modal or leaving the page. [FR-9]
11. Phase 1 MUST produce a markdown + ASCII-wireframe design document per page type; Phase 2 MUST update those documents to match the shipped implementation.

## Open questions

None identified. (Phase-1 design fidelity resolved: markdown + ASCII wireframes in-repo. Page reorder resolved: drag-and-drop.)

## Out of scope (deferred)

- Sketch, to-do, and reference pages; per-page-type templates (v1).
- Cross-project preset library and rich page/project linking (v2).
- Device/parameter presets shared across pages, and importing preset values from DAW files (post-MVP).
- Page archiving, duplication, and bulk operations.
