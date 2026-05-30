# Build log page — design

**Feature:** Pages · **Phase:** 1 (design) · **Status:** GUIDANCE (locked to implementation in Task 9, FR-11)
**Spec:** `docs/features/pages/spec.md` — FR-6, FR-7, FR-10
**Task:** Task 7 (Build log page)

> This document is Phase-1 guidance. The editor may deviate during the build; Task 9 reconciles this doc with what shipped.

## Purpose

The Build log records *how a track came together* — both the arrangement/idea sketch and the running sequence of moves that made it work. It is the feature's central bet and its riskiest: the move feed must be filled **mid-flow**, when a producer least wants to stop and type, so single-action capture has to be measurably faster and lighter than a plain text file. If capture is tedious, this page dies.

## Design — stacked: sketch on top, feed below

One page, two sections. The sketch sits on top; the append-only move feed sits below with a persistent quick-add pinned at the bottom. Moves read top-to-bottom as the build story (oldest → newest).

```
+-------------------------------------------+
| Build log: Lead synth                  ⋯  |
+-------------------------------------------+
| SKETCH                            (saved) |
| [ free-text arrangement / idea area ]     |
+-------------------------------------------+
| MOVES                                     |
|  ── May 27 ──                             |
|  14:02   sidechain to kick           [⋯]  |
|  14:09   +OTT, 20% mix               [⋯]  |
|  ── May 29 ──                             |
|  09:11   swapped reverb → plate      [⋯]  |
|                                           |
|  > add a move…                       [+]  |
+-------------------------------------------+
```

## Sketch section

- Behaves exactly like the [Notes canvas](notes.md): a plain-text area, debounced autosave, no formatting, whitespace preserved.
- Holds the arrangement/idea — the slower, more reflective writing. Separate from the fast move feed so the two modes don't interfere.

## Move feed

- **Quick-add (the friction-critical interaction).** Type in the always-visible input, press **Enter** to append: the move is saved with an auto-captured timestamp, the input clears and **keeps focus** so several moves can be fired off in a row. `[+]` does the same as Enter. **Shift+Enter** inserts a newline for a multi-line move. This single-action append is the hard acceptance bar for the page (FR-7).
- **Timestamps.** Captured automatically at append. Moves are grouped under **day dividers** (`── May 27 ──`); each move shows its time.
- **Order.** Chronological, oldest at top, newest at bottom. Moves are **never reorderable** (FR-7).
- **Edit / Delete.** Each move's `⋯` menu offers **Edit** (inline, explicit rewrite) and **Delete** (with confirm). These are *explicit, user-initiated* changes — see the FR-7 note below.

### FR-7 note: "must not be silently rewritten"

FR-7 forbids moves being *reordered* or *silently rewritten*. The operative word is **silently**: the prohibition targets automatic/sync-driven changes happening behind the producer's back, not deliberate user action. An explicit Edit or Delete the producer chooses is not silent and is therefore allowed. Order, however, is locked unconditionally. Implementation must not let any automatic process (including future sync merge) rewrite or reorder a move.

## Data shape

- Moves are stored as an **append list** on the page record (`{ id, at, text }[]`), which stays merge-friendly for later union-merge sync (a separate feature).
- Edit and Delete target a move by its **stable id**, never by position — so concurrent appends never disturb the wrong entry.

## Inline editing (FR-10)

Both sketch edits and move capture happen inline on the page — no modal. Quick-add and the sketch are always present and editable.

## Brand

`font-display` for the page title; `font-mono` uppercase `tracking-label` for the **SKETCH** / **MOVES** headings, day dividers, and move timestamps; `fg-tertiary` for the save indicator and dividers. Tokens per the saboteur-styles source of truth (via `packages/ui`).

## Open notes for implementation

- Day-divider style and timestamp format (12h/24h, relative for "today") to be finalized in Task 7.
- Whether moves collapse/virtualize for very long logs — defer unless it bites.
