# Notes page — design

**Feature:** Pages · **Phase:** 2 (implementation) · **Status:** LOCKED — matches shipped implementation (Task 9, FR-11)
**Spec:** `docs/features/pages/spec.md` — FR-5, FR-10
**Impl:** `apps/app/src/pages/NotesPage.tsx`

## Purpose

The Notes page is the catch-all: free-form text for any thought that doesn't fit a more structured page. Its whole job is to be the lowest-friction surface in Otocho — open it and type.

## Design — bare canvas

A full-height plain-text `<textarea>` on `bg-otocho-canvas`, with a title heading and save indicator above it. No toolbar, no blocks, no formatting.

```
+-----------------------------------------------+
| Notes                              (Saving…)   |
+-----------------------------------------------+
|                                               |
|  Type anything…                               |
|                                               |
|  (full-height plain-text textarea,            |
|   bg-otocho-canvas, fills the flex column)    |
|                                               |
+-----------------------------------------------+
```

## Behaviors

### Title (deviation from Phase-1 design)

**Phase-1 designed:** the heading at the top is editable inline — click to edit, Enter saves, Escape cancels.

**Shipped:** the `NotesPage` component renders the page title as a static `<h3>` (`font-display text-lg font-semibold`). Title editing is handled entirely by the shell's `⋯` context-menu **Rename** action in `PageList`. This is the correct split: the shell owns page identity; the editor owns page content.

### Autosave

Edits save automatically, debounced at **400ms** after typing stops. The save indicator (`font-mono text-xs uppercase tracking-label text-fg-tertiary`) cycles through:
- *(absent)* — idle, no pending changes
- `Saving…` — timer running
- `Saved` — persisted

No save button. Body state resets to the persisted value when a different page is selected (tracked by `pageIdRef`).

### Plain text

No markdown rendering, no rich formatting. Newlines and whitespace preserved verbatim. `<textarea>` is `resize-none` and `flex-1` to fill the column.

### Empty state

`placeholder="Type anything…"` on the textarea. An empty Notes page is valid and persists as-is.

### Last-edited line

**Phase-1 designed:** optional `Edited <relative time>` line at the foot.

**Not shipped.** Dropped for minimalism; deferred to a future iteration.

## Inline editing (FR-10)

All editing happens directly in the textarea — no modal, no separate edit mode.

## Brand

`font-display text-lg font-semibold text-fg-primary` for the title. Textarea body: `font-sans text-sm leading-relaxed text-fg-primary`. Save indicator: `font-mono text-xs uppercase tracking-label text-fg-tertiary`. Canvas background: `bg-otocho-canvas` (`#16150f`). Tokens from `packages/ui` via the saboteur-styles source of truth.
