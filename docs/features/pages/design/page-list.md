# Page-list / Project shell — design

**Feature:** Pages · **Phase:** 1 (design) · **Status:** GUIDANCE (locked to implementation in Task 9, FR-11)
**Spec:** `docs/features/pages/spec.md` — FR-2, FR-3, FR-4, FR-10
**Tasks:** primarily Task 4 (page list + management) and Task 5 (drag reorder)

> This document is Phase-1 guidance. The editors may deviate during the build; Task 9 reconciles this doc with what shipped.

## Purpose

The shell is the frame every page editor lives inside. It hangs off the opened-project screen (`apps/app/src/projects/ProjectView.tsx`, replacing the `"Pages arrive in a later feature."` placeholder) and provides: a list of the project's pages, a way to add a page, a way to open one, and per-page rename / delete / reorder.

## Layout — left sidebar + content pane

The existing project header (`← All projects`, project name, Rename / Delete) stays on top. Below it, a persistent left rail lists pages; the open page fills the rest.

```
+--------------------------------------------------+
| ← All projects                                   |
| My Track                       [Rename] [Delete] |
+------------------+-------------------------------+
| PAGES        [+] |                               |
|                  |                               |
| ▎▤ Notes         |     [ open page fills         |
|  ▤ Build log     |       this pane ]             |
|  ▤ Presets       |                               |
|                  |                               |
+------------------+-------------------------------+
   ▎ = active-row accent (left bar + subtle bg tint)
   ▤ = per-type icon (distinct glyph/color per type)
```

**Mobile:** the rail collapses to a slide-in drawer, opened from a control next to the project name. Selecting a page closes the drawer and shows the editor full-width.

## Page row

Rows are deliberately clean: **per-type icon + page name** only — no always-visible action buttons or drag grips.

- **Open:** click / tap the row. The active page gets a left accent bar and a subtle background tint.
- **Reorder:** drag the row to a new position. A small drag threshold distinguishes a drag from a click, so a tap still opens the page. New order persists (writes the page `order` field via the repository).
- **Rename / Delete:** right-click (desktop) or long-press (mobile) opens a context menu with **Rename** and **Delete**.
  - **Rename** is inline (the row label becomes editable; Enter saves, Escape cancels) — consistent with project rename.
  - **Delete** asks for confirmation, then removes the page. There is no page-level trash (unlike projects).

### Accessibility (guidance requirement — do not drop at implementation)

Right-click / long-press is not keyboard-reachable, so:
- Each focused row MUST also expose Rename / Delete through a focusable menu affordance and/or a documented keyboard shortcut.
- Reorder MUST have a keyboard path (e.g. move-up / move-down from the row menu) in addition to drag.

This keeps FR-3 (rename/reorder/delete) reachable without a pointer.

## Add a page

The `[+]` next to the **PAGES** heading opens a dropdown of the three page types. Picking one creates that page and opens it — exactly two interactions (FR-4).

```
PAGES        [+]┐
              ┌──────────────┐
              │ ▤ Notes      │
              │ ▤ Build log  │
              │ ▤ Presets    │
              └──────────────┘
```

As new page types arrive (v1+), they extend this menu — the reason a dropdown was chosen over an always-visible button row.

## Empty state

A project with no pages shows a short prompt and a primary add action in the rail; the content pane echoes the empty state.

```
+------------------+-------------------------------+
| PAGES        [+] |                               |
|                  |   This project has no pages   |
|   No pages yet.  |   yet.                        |
|   [+ Add a page] |                               |
|                  |                               |
+------------------+-------------------------------+
```

`[+ Add a page]` opens the same type dropdown as `[+]`.

## States summary

| State | Treatment |
|---|---|
| Active page | left accent bar + subtle bg tint on its row |
| Hover/focus row | subtle highlight; row is the open target |
| Dragging | row lifts; drop indicator between rows |
| Empty project | prompt + `[+ Add a page]` in rail, echoed in pane |
| Delete | confirm prompt before removal (no trash) |

## Brand

Follow the saboteur tokens already in `packages/ui` (the saboteur-styles repo is the source of truth): `font-display` for the project name, `font-mono` uppercase `tracking-label` for the **PAGES** heading and section labels, `fg-primary/secondary/tertiary` for text hierarchy.

## Open notes for implementation

- Per-type icons/colors are TBD; pick a distinct, legible glyph per type and record the choices here in Task 9.
- Drag threshold value (px) to be tuned during Task 5.
