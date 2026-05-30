# Notes page — design

**Feature:** Pages · **Phase:** 1 (design) · **Status:** GUIDANCE (locked to implementation in Task 9, FR-11)
**Spec:** `docs/features/pages/spec.md` — FR-5, FR-10
**Task:** Task 6 (Notes page editor)

> This document is Phase-1 guidance. The editor may deviate during the build; Task 9 reconciles this doc with what shipped.

## Purpose

The Notes page is the catch-all: free-form text for any thought that doesn't fit a more structured page. Its whole job is to be the lowest-friction surface in Otocho — open it and type.

## Design — bare canvas

A single full-bleed plain-text area fills the content pane, under an inline-editable title. No toolbar, no blocks, no formatting.

```
+-----------------------------------------------+
| Notes                              ⋯   (saved) |
+-----------------------------------------------+
|                                               |
|  Type anything…                               |
|                                               |
|  (full-bleed plain-text area, fills the pane, |
|   grows/scrolls with content)                 |
|                                               |
+-----------------------------------------------+
   Edited 2m ago
```

## Behaviors

- **Plain text only.** No markdown rendering, no rich formatting. Newlines and whitespace are preserved verbatim. (A future page type, not Notes, can carry structure.)
- **Title.** The heading at the top is the page's canonical name and is editable inline — click to edit, Enter saves, Escape cancels. The shell's context-menu **Rename** edits the same field.
- **Autosave.** Edits save automatically, debounced (~a few hundred ms after typing stops). A quiet `Saving… → saved` indicator sits near the title; there is no save button. Navigating away never loses unsaved text.
- **Empty state.** A `Type anything…` placeholder shows when the body is empty. An empty Notes page is valid and persists as-is.
- **Last-edited.** A quiet `Edited <relative time>` line at the foot of the pane (optional; low emphasis).

## Inline editing (FR-10)

All editing happens directly in the text area — no modal, no separate edit mode. This is the simplest expression of the inline-capture requirement and the baseline the heavier pages (Build log, Presets) are measured against.

## Brand

`font-display` for the title; body text in the app's reading face; `font-mono` uppercase `tracking-label` and `fg-tertiary` for the save indicator and last-edited line. Tokens per the saboteur-styles source of truth (via `packages/ui`).

## Open notes for implementation

- Exact autosave debounce interval to be tuned in Task 6.
- Whether the last-edited line ships in MVP or is dropped for minimalism — decide during the build and record in Task 9.
