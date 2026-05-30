# Build log page — design

**Feature:** Pages · **Phase:** 2 (implementation) · **Status:** LOCKED — matches shipped implementation (Task 9, FR-11)
**Spec:** `docs/features/pages/spec.md` — FR-6, FR-7, FR-10
**Impl:** `apps/app/src/pages/BuildLogPage.tsx`

## Purpose

The Build log records *how a track came together* — both the arrangement/idea sketch and the running sequence of moves that made it work. The move feed must be filled **mid-flow**, so single-action capture must be measurably faster than a plain text file.

## Design — stacked: sketch on top, feed below

One page, two sections. The sketch sits on top; the append-only move feed sits below with the quick-add pinned at the bottom inside a bordered container. Moves read top-to-bottom, oldest → newest.

```
+-------------------------------------------+
| Build log: Lead synth                     |
+-------------------------------------------+
| SKETCH                         (Saving…)  |
| [ plain-text textarea, bg-otocho-canvas ] |
+-------------------------------------------+
| MOVES                                     |
| ┌─────────────────────────────────────┐   |
| │  ─── Jan 1 ───                      │   |
| │  14:02   sidechain to kick    [⋯]   │   |
| │  14:09   +OTT, 20% mix        [⋯]   │   |
| │─────────────────────────────────────│   |
| │  > add a move…              [+]     │   |
| └─────────────────────────────────────┘   |
+-------------------------------------------+
```

## Sketch section

Behaves like the [Notes canvas](notes.md): `<textarea>` on `bg-otocho-canvas`, `rows={5}`, `resize-none`, 400ms debounced autosave, `Saving… → Saved` indicator next to the **SKETCH** label. Placeholder: `"Arrangement ideas, references, anything…"`.

Title editing is via the shell's ⋯ context-menu Rename (same as Notes — the editor owns content, the shell owns identity).

## Move feed

### Quick-add (the friction-critical interaction)

A `<textarea>` (`rows={1}`, `bg-otocho-canvas`) is always pinned at the bottom of the feed container, with a `[+]` (`Plus` icon) button beside it.

- **Enter** (without Shift): calls `appendMove(page, text)` from `@otocho/core`, saves, clears the input, and `focus()`s it again for rapid successive entry.
- **Shift+Enter**: inserts a newline within the move text (normal textarea behaviour).
- **`[+]` button**: same effect as Enter; disabled when input is empty.
- Whitespace-only input is rejected (no append, button disabled).

`appendMove` is a pure function from core that returns a new page with the move appended — timestamped at call time via `newId()` + `new Date().toISOString()`, with a stable UUID.

### Timestamps and day dividers

Timestamps are auto-captured at append via `new Date().toISOString()`. Display uses `Intl.DateTimeFormat`:
- **Time** per move: `hour: "2-digit", minute: "2-digit", hour12: false` → `14:02`
- **Day divider**: `month: "short", day: "numeric"` → `Jan 1`

Day dividers use locale default ordering. Moves within the same calendar day share one divider; a new date starts a new group. Divider style: centered date text flanked by `div` horizontal rules (`bg-brand-rule h-px`), sticky at the top of the scroll container.

### Move order

Chronological, oldest at top, newest at bottom. **Moves are never reorderable** (FR-7).

### Move actions — ⋯ menu (Edit / Delete)

Each move row has a `⋯` (`⋯` character in `font-mono text-xs`) button that is `opacity-0` and becomes visible on `group-hover` / `focus`. Clicking opens a `DropdownMenu`:

- **Edit**: switches the move row to an inline edit form — `<textarea rows={2}>` pre-filled with the move text, a **Save** button, a **Cancel** button. Escape also cancels. On save, the move's `text` is updated by id (order unchanged). This is an *explicit, user-initiated* rewrite — consistent with the FR-7 "silently rewritten" interpretation documented in the spec.
- **Delete**: opens an `AlertDialog` confirm. On confirm, the move is removed by id. Cancel leaves the feed unchanged.

### Data shape

Moves are stored as `{ id: string, at: string, text: string }[]` on the page record — an append list. Edit and delete target moves by stable `id`, never by array position. This shape is union-merge-friendly for future sync (separate feature).

## Inline editing (FR-10)

All capture happens inline: the sketch and quick-add are always present; move edit is in-row. No modals for capture (AlertDialog is confirmation-only, not capture).

## Brand

`font-mono text-xs uppercase tracking-label text-fg-tertiary` for **SKETCH** / **MOVES** headings, day dividers, and move timestamps. `font-sans text-sm text-fg-primary` for move body text and textarea content. Canvas areas: `bg-otocho-canvas`. Feed container: `border border-brand-rule rounded-md`. Tokens from `packages/ui` via the saboteur-styles source of truth.

## Deferred

Move virtualization for very long logs — deferred; not implemented.
