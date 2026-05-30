# Implementation Tasks: Pages

**Spec:** `docs/features/pages/spec.md`
**Granularity:** story points (1/2/3/5/8)
**Phases:** Phase 1 (Task 1) is page visual/UI design docs — *guidance* for the build. Phase 2 (Tasks 2–9) implements the pages and ends by *locking* those docs to what shipped (Task 9, FR-11).

## Scaffold context (already in place)

The Projects feature is complete and establishes every pattern Pages reuses:

- `packages/core/src/project.ts` + `project-repository.ts` — the entity + repository pattern to mirror for pages (factory helpers, `StoragePort`-injected CRUD, platform-agnostic).
- `packages/storage/src/port.ts` — `StoragePort` (one-record-per-document seam, designed for the file-per-page model); `web-adapter.ts` is on IndexedDB (`@otocho/storage/web`).
- `apps/app/src/projects/` — the per-feature UI folder pattern: a `repository.ts` singleton, a `use*.ts` hook over the repo, components, and colocated `*.test.tsx`.
- `apps/app/src/projects/ProjectView.tsx:163` — the opened-project screen ends with a `"Pages arrive in a later feature."` placeholder. **This is the mount point** the page list replaces (Task 4).
- `packages/ui` — shadcn + Tailwind v4 + Storybook, themed with saboteur tokens (the brand source of truth is the saboteur-styles repo). `Button`, `Input`, `AlertDialog` exist; `Textarea`, `DropdownMenu`, etc. are added via `shadcn add` as needed.
- **Test infra is configured:** vitest + jsdom + Testing Library. "Done when" conditions are met with colocated `*.test.ts(x)`; all packages must typecheck and the app must build.

**Cross-cutting decisions (settle once, in the task noted; not separate tasks):**
- **Page open/navigation (Task 4):** decide nested routing (`/projects/:id/pages/:pageId`) vs. an in-pane master/detail within `ProjectView`. The choice ripples into every editor task (6–8).
- **shadcn `add` import rewrite:** components scaffolded via `shadcn add` emit `@/…` imports; rewrite to relative paths (the `ui` package is consumed as source).
- **Sync is out of scope.** The append-only move feed (FR-6/7) and file-per-page model are *shaped* for later union-merge sync (FR-11/12, a separate feature) but no merge/conflict logic is built here.

### Task 1: Phase 1 — page visual/UI design docs ✅

**Status:** Done — 2026-05-29. Four guidance docs in `docs/features/pages/design/`: `page-list.md` (left sidebar + content pane; [+] dropdown to add; clean rows with context-menu rename/delete; drag reorder), `notes.md` (bare plain-text canvas, autosave), `build-log.md` (stacked sketch + append-only move feed; Enter-to-append quick-add; explicit edit/delete, order locked), `presets.md` (signal-chain + detail; track-as-title; optional free-text settings + key-value params). Each labelled GUIDANCE pending lock in Task 9. Key decisions recorded inline; FR-7 "silently rewritten" interpreted to permit explicit user edits.
**What:** Per-page-type design documents (markdown + ASCII wireframes) plus a page-list/management layout, capturing structure, fields, and interactions for Notes, Build log, and Presets.
**Files:** `docs/features/pages/design/notes.md`, `docs/features/pages/design/build-log.md`, `docs/features/pages/design/presets.md`, `docs/features/pages/design/page-list.md` (all new).
**Done when:** Each of the three page types and the page-list/add-page surface has a committed markdown doc with an ASCII wireframe and written interaction notes; each doc is labelled as Phase-1 *guidance* (to be locked in Task 9). [FR-11]
**Depends on:** none
**Estimate:** 3
**Notes:** Guidance, not contract — editors (Tasks 6–8) may deviate, and Task 9 reconciles. Wireframes follow the resolved Build-log layout (sketch area above an append-only move feed with an inline quick-add row). Honor saboteur brand tokens already in `packages/ui`.

### Task 2: Page domain model ✅

**Status:** Done — 2026-05-29. `packages/core/src/page.ts`: `Page` discriminated union (Notes/Build log/Presets) over a shared base (id, projectId, type, title, order, timestamps); `createNotesPage`/`createBuildLogPage`/`createPresetPage` + a `createPage(type,…)` dispatcher; `PAGE_TYPES`; `byOrder` comparator; `appendMove` (pure, timestamped, id'd, append-only per FR-7). Preset track name lives in the shared `title` (single source of truth — design's separate `trackName` reconciled away; record in Task 9). 12 new tests; 41 total pass; typecheck + build clean.
**What:** A `Page` discriminated union (Notes / Build log / Presets) with shared fields and per-type content, plus factory helpers and an ordering comparator.
**Files:** `packages/core/src/page.ts` (new), `packages/core/src/index.ts` (export).
**Done when:** `createNotesPage`/`createBuildLogPage`/`createPresetPage` produce records with `id`, `projectId`, `type`, `title`, `order`, `createdAt`/`updatedAt`, and type-specific content — Notes `{ body }`; Build log `{ sketch, moves: { id, at, text }[] }`; Presets `{ trackName, devices: { id, name, settings?, params?: {key,value}[] }[] }` — with passing unit tests. [FR-1, FR-2, FR-5, FR-6, FR-8]
**Depends on:** none
**Estimate:** 3
**Notes:** Mirror `project.ts` (Web Crypto `randomUUID`, ISO timestamps, no platform libs). Each page carries an `order` field so reorder (Task 5) is a pure data change. Model `moves` as an append list to keep it merge-friendly later.

### Task 3: Page repository (project-scoped, file-per-page) ✅

**Status:** Done — 2026-05-29. `packages/core/src/page-repository.ts`: `PageRepository` with `create` (appends at end, auto-order), `get`, `list(projectId)` (filtered + sorted by `byOrder`), `rename` (trims, rejects empty), `reorder` (splice-and-reindex, clamps out-of-bounds), `delete` (permanent, guard throws for missing). 16 new tests; 57 total pass; typecheck clean.
**What:** A `PageRepository` over the injected `StoragePort` providing project-scoped create / get / list-ordered / rename / reorder / delete.
**Files:** `packages/core/src/page-repository.ts` (new), `packages/core/src/index.ts` (export).
**Done when:** Through the repository a page can be created under a project, reloaded across restart with content intact, listed for a single project in `order`, renamed, reordered (new order persists), and deleted; each page persists as its own record. [FR-1, FR-2, FR-3]
**Depends on:** 2
**Estimate:** 3
**Notes:** Store every page as one record in a `pages` collection keyed by page id, each carrying `projectId`; `list(projectId)` filters and sorts by `order`. One-record-per-page keeps future sync conflicts page-scoped (the `StoragePort` seam is built for this).

### Task 4: Page list + management (add / open / rename / delete) ✅

**Status:** Done — 2026-05-29. `apps/app/src/pages/`: `repository.ts` singleton, `usePages.ts` hook (create/rename/deletePage/refresh), `PageList.tsx` (sidebar rail with [+] DropdownMenu type chooser, per-row ⋯ action menu on hover/focus, inline rename, active-page accent). `DropdownMenu` added to `@otocho/ui`. `ProjectView` updated to two-column layout (sidebar + content pane, `selectedPageId` state, per-type placeholder). `App.tsx` restructured: shared narrow header, NarrowContent wrapper for home/trash, WideContent for project view. Navigation model: in-pane state (not nested routes). 70 tests pass; typecheck + build clean.
**What:** Within an opened project, a list of its pages with add-page (type chooser → created), open, rename, and delete; replaces the `ProjectView` placeholder.
**Files:** `apps/app/src/pages/repository.ts` (new singleton), `apps/app/src/pages/usePages.ts` (new hook), `apps/app/src/pages/PageList.tsx` (new), `apps/app/src/projects/ProjectView.tsx` (replace the `"Pages arrive in a later feature."` placeholder + add page route/pane), `apps/app/src/App.tsx` (page route if nested-routing chosen), possibly `packages/ui` (`shadcn add dropdown-menu` for the type chooser).
**Done when:** A project shows its pages ordered; adding a page takes ≤2 interactions (choose type → page created) and opens it; pages can be renamed inline and deleted; all changes persist across restart. [FR-2, FR-3, FR-4, FR-10]
**Depends on:** 1, 3
**Estimate:** 5
**Notes:** Settle the page open/navigation decision here (see cross-cutting). Delete is a plain remove — the spec defines no page-level trash (unlike projects); a confirm prompt is advisable but not required. Inline entry, no modal authoring (FR-10).

### Task 5: Drag-and-drop page reorder ✅

**Status:** Done — 2026-05-29. `@dnd-kit/core` + `@dnd-kit/sortable` installed in `apps/app`. `PageList` wrapped in `DndContext`/`SortableContext`; each row is a `useSortable` item with a grip-icon drag handle (6px activation threshold to protect click-to-open). `usePages` gains `reorder(id, newIndex)`. `ProjectView` wires `onReorder`. 71 tests pass; typecheck + build clean.
**What:** Reordering pages in the list by drag-and-drop, persisted via the repository.
**Files:** `apps/app/src/pages/PageList.tsx`, `apps/app/package.json` (add a dnd library, e.g. `@dnd-kit/core` + `@dnd-kit/sortable`).
**Done when:** A page can be dragged to a new position in the list, the new order persists across restart, and the list renders in that order on reload. [FR-3]
**Depends on:** 3, 4
**Estimate:** 2
**Notes:** Reorder writes the `order` field via the repository (Task 3). Mobile structured reorder is out of scope (sync/mobile feature); a desktop/web drag interaction satisfies the FR.

### Task 6: Notes page editor

**What:** The Notes page — inline free-form text editing that autosaves to the page record.
**Files:** `apps/app/src/pages/NotesPage.tsx` (new), `packages/ui` (`shadcn add textarea`).
**Done when:** Opening a Notes page shows its body in an editable area; edits persist inline (no modal) and survive restart. [FR-5, FR-10]
**Depends on:** 4
**Estimate:** 2

### Task 7: Build log page

**What:** The Build log page — an editable sketch area plus an append-only, timestamped move feed with a persistent inline quick-add input.
**Files:** `apps/app/src/pages/BuildLogPage.tsx` (new).
**Done when:** The page shows an editable sketch area and a move feed; the quick-add input appends a timestamped move in a single action; appended moves are not reorderable or rewritten; sketch edits and moves persist across restart. [FR-6, FR-7, FR-10]
**Depends on:** 4
**Estimate:** 5
**Notes:** This is the capture-friction proof — quick-append must be one action and lighter than a text file. Moves are append-only (Task 2's append list); union-merge across devices is a later sync concern, not built here.

### Task 8: Presets page

**What:** The Presets page — a single named track holding an ordered chain of devices, each with a name, optional free-text settings, and optional structured key-value parameter rows.
**Files:** `apps/app/src/pages/PresetPage.tsx` (new).
**Done when:** A preset page captures a track name and an ordered device chain; each device has a name, an optional free-text settings field, and optionally addable key-value param rows; the project supports multiple preset pages; all content persists and edits are inline. [FR-8, FR-9, FR-10]
**Depends on:** 4
**Estimate:** 5
**Notes:** Multiple preset pages per project already follow from the page list (Task 4) + repository (Task 3); verify the one-track-per-page scoping holds. Device reordering within the chain reuses the dnd approach from Task 5 if desired (not required by the FR).

### Task 9: Phase 2 — lock design docs to shipped UI

**What:** Update the Phase-1 design docs to match the implemented page UIs, removing the "guidance" label and recording the as-built details.
**Files:** `docs/features/pages/design/notes.md`, `build-log.md`, `presets.md`, `page-list.md`.
**Done when:** Each design doc reflects the shipped editor (layout, fields, interactions), is marked locked rather than guidance, and notes any deviation from the Phase-1 draft. [FR-11]
**Depends on:** 5, 6, 7, 8
**Estimate:** 2
**Notes:** Closes the two-phase loop so no UI detail is lost between design and implementation.

## Summary

- Total tasks: 9
- Total estimated effort: 30 story points
- Critical path: Tasks 2 → 3 → 4 → 8 → 9 (Task 1 design feeds Task 4 in parallel; Build log Task 7 is equal-weight to Presets Task 8 off Task 4; Notes 6 and reorder 5 branch off in parallel)
- Risks:
  - **Task 4 navigation decision:** how a page opens (nested route vs. in-pane) ripples into all three editors (6–8); decide before starting them.
  - **Task 7 capture friction:** the Build log is the feature's central bet — if quick-append isn't genuinely faster/lighter than a text file, the page goes unused. Treat the one-action append as a hard acceptance bar, not a nice-to-have.
  - **Phase-1/Phase-2 drift (Tasks 1 ↔ 9):** design docs are guidance and editors may deviate; Task 9 must actually reconcile them or the "no UI detail lost" goal (FR-11) silently fails.
  - **Sync interaction (downstream, out of scope):** the append-only move feed and file-per-page model are shaped for later union-merge sync (FR-11/12, separate feature); merge semantics will be revisited then.
