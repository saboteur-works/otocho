# Page-list / Project shell — design

**Feature:** Pages · **Phase:** 2 (implementation) · **Status:** LOCKED — matches shipped implementation (Task 9, FR-11)
**Spec:** `docs/features/pages/spec.md` — FR-2, FR-3, FR-4, FR-10
**Impl:** `apps/app/src/pages/PageList.tsx`, `apps/app/src/projects/ProjectView.tsx`, `apps/app/src/App.tsx`

## Purpose

The shell is the frame every page editor lives inside. It hangs off the opened-project screen (`ProjectView.tsx`) and provides: a list of the project's pages, a way to add a page, a way to open one, and per-page rename / delete / reorder.

## Layout — left sidebar + content pane

The app header (音帳 / Otocho) is shared and narrow (`max-w-2xl`). The project view sits inside a wider `max-w-5xl` `WideContent` wrapper in `App.tsx`. Below the project title row, a persistent `w-52` left rail (`<aside>`) lists pages; the selected page fills the right content pane.

```
+--------------------------------------------------+
| ← All projects                                   |
| My Track                       [Rename] [Delete] |
+------------------+-------------------------------+
| PAGES        [+] |                               |
|                  |                               |
| ⋮⋮ ▤ Notes       |     [ open page fills         |
| ⋮⋮ ▤ Build log   |       this pane ]             |
| ⋮⋮ ▤ Presets     |                               |
|                  |                               |
+------------------+-------------------------------+
   ⋮⋮ = grip icon (always visible)
   ▤  = per-type icon
```

**Mobile:** the drawer collapse was not implemented in MVP — the layout renders as-is on all screen sizes. Deferred.

## Page row

Each row renders: **grip icon** · **per-type icon** · **page name** · **⋯ button** (on hover/focus).

### Per-type icons (as shipped)

| Type | Icon (lucide-react) |
|---|---|
| notes | `FileText` |
| build-log | `ClipboardList` |
| presets | `SlidersHorizontal` |

All icons are `h-3.5 w-3.5` in `text-fg-tertiary`.

### Row actions (deviation from Phase-1 design)

**Phase-1 designed:** right-click (desktop) / long-press (mobile) opens a context menu.

**Shipped:** a `⋯` (`MoreHorizontal`) button that is `opacity-0` by default and becomes visible on `group-hover` and `focus`/`focus-visible`. Clicking opens a `DropdownMenu` with **Rename** and **Delete**. This satisfies the spec's accessibility requirement directly (focusable affordance) without needing a separate right-click handler.

### Rename

Selecting **Rename** from the ⋯ menu switches the row to an `<Input>` in a `<form>`. Enter submits; Escape or blur cancels. `onRename(id, title)` is called on submit.

### Delete

Selecting **Delete** from the ⋯ menu calls `onDelete(id)` immediately (no confirm prompt at this level — the parent is responsible for any confirmation). There is no page-level trash.

### Grip icon (deviation from Phase-1 design)

**Phase-1 designed:** no always-visible drag grips ("rows are deliberately clean").

**Shipped:** a small two-column dot-grid `GripIcon` (SVG, `h-3 w-3`) is always visible on the left of each row and carries the dnd `attributes` + `listeners`. The 6px `activationConstraint.distance` prevents accidental drags on click.

### Active page

Active page row: `border-l-2 border-fg-primary bg-surface-hover pl-1.5 text-fg-primary`. Inactive rows use `border-l-2 border-transparent`.

## Add a page

`[+]` is a `Button variant="ghost"` (`h-6 w-6`) that opens a `DropdownMenu`. Picking a type calls `onCreate(type)` — one interaction to open, one to pick = two total (FR-4).

```
PAGES        [+]
              ┌──────────────────┐
              │ ▤ Notes          │
              │ ▤ Build log      │
              │ ▤ Presets        │
              └──────────────────┘
```

## Empty state (deviation from Phase-1 design)

**Phase-1 designed:** `[+ Add a page]` button in the rail + echo in the content pane.

**Shipped:** rail shows `"No pages yet."` (small centered text, `text-fg-tertiary`). Content pane shows `"Add a page to get started."`. The `[+]` in the header is still the action path.

## States summary

| State | Treatment |
|---|---|
| Active page | `border-fg-primary bg-surface-hover` left-border + bg tint |
| Hover/focus row | `bg-surface-hover` via Tailwind group-hover |
| Dragging | `opacity-0.5`; dnd-kit handles lift/indicator |
| Empty project | "No pages yet." in rail; "Add a page to get started." in pane |
| ⋯ menu | `opacity-0` → visible on group-hover / focus |

## Reorder

`@dnd-kit/core` + `@dnd-kit/sortable` with `verticalListSortingStrategy`. `PointerSensor` with `activationConstraint: { distance: 6 }` — a 6px drag moves a row. `onDragEnd` resolves to `onReorder(pageId, newIndex)` via index lookup.

## Brand

`font-mono text-xs uppercase tracking-label text-fg-tertiary` for the **PAGES** heading. `text-sm` body text in `text-fg-secondary` (inactive) / `text-fg-primary` (active/hover). Tokens from `packages/ui` via the saboteur-styles source of truth.
