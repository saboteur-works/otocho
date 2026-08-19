# Implementation Tasks: Search

**Spec:** `specs/features/search.md`
**Granularity:** story points (1/2/3/5/8)

## Scaffold context (already in place)

Pages and Projects are both complete and establish every pattern Search reuses:

- `packages/core/src/project-repository.ts` — `ProjectRepository.list()` returns active (non-deleted) projects sorted by `byRecency`; this is the input Search needs for the FR-8 ordering rule (project recency) and the D-6 active-only scope.
- `packages/core/src/page-repository.ts` — `PageRepository` currently exposes only `list(projectId)` (project-scoped). It has no cross-project read yet — FR-9's `listAll()` does not exist and is this feature's first task.
- `packages/core/src/page.ts` — the `Page` discriminated union and its exact indexable fields per type: Notes `body`; Build log `sketch` + each `moves[].text`; Presets `title` (track name) + each `devices[].name`, `devices[].settings`, `devices[].params[].key`, `devices[].params[].value`. This field list is closed (see spec FR-3/FR-4) — do not add or infer fields beyond it.
- `packages/core/src/index.ts` — barrel export (`export * from "./project"` etc.); a new `search.ts` module follows the same `export *` pattern.
- `apps/app/src/App.tsx` — the shared `HashRouter` shell with a narrow header rendered on every route (`NarrowContent`/`WideContent` both sit below it). This header is the natural mount point for a search entry point reachable "from anywhere" (FR-1).
- `apps/app/src/projects/ProjectView.tsx` — the opened-project screen. Page selection within a project is **in-pane React state** (`selectedPageId`, initialized to the first page and reset when pages change), not a route param. There is currently no way to open `/projects/:id` already pointed at a specific page — this is the gap FR-6 exposes and Task 8 closes.
- `apps/app/src/pages/repository.ts` / `apps/app/src/projects/repository.ts` — the singleton-repo-per-feature-folder pattern (`export const pagesRepo = new PageRepository({ storage: new WebStorageAdapter() })`), reused for Search's own hook rather than duplicated.
- `packages/ui/src/index.ts` — `Button`, `Input`, `AlertDialog` (Radix alert-dialog, confirm-style), `DropdownMenu` exist. There is **no general-purpose modal/overlay primitive** yet — `AlertDialog` is confirm-only. Search needs a dismissible overlay (Radix `Dialog` via `shadcn add dialog`), which is new primitive work in `packages/ui` with a Storybook story, per the project's "new UI primitive" convention.
- Task 4 (`Dialog` primitive) has no dependencies and can run concurrently with Tasks 1-3.
- Test infra: Vitest, `node` environment by default, jsdom opt-in via a `// @vitest-environment jsdom` directive; 132 tests pass across 15 files today. Every task below must keep that suite green.

**Cross-cutting decisions (settle once, in the task noted; not separate tasks):**
- **Result navigation into a specific page (Task 8):** the app has no existing route/param carrying a target page id into `ProjectView`. Add a way to express "open project X with page Y already selected" (e.g. an optional `?page=` search param read by `ProjectView`, or a nested `/projects/:id/pages/:pageId?` route) and use it from the search result's navigate call. This is the least obvious piece of work in the feature — decide it deliberately, don't bolt it on.
- **New `Dialog` primitive (Task 4):** scaffolded via `shadcn add dialog` into `packages/ui`; rewrite the emitted `@/…` imports to relative paths, same as every prior `shadcn add`. This is the first general overlay primitive in the package; `AlertDialog` is confirm-only and is not a substitute.
- **No new persisted entity, no `StoragePort` change.** Search is a read-only query layer over `ProjectRepository`/`PageRepository` output (FR-11); nothing here touches `packages/storage`.

### Task 1: `PageRepository.listAll()`

**What:** Add a cross-project read to `PageRepository` returning every page across every project, mirroring `ProjectRepository.list()`.
**Files:** `packages/core/src/page-repository.ts`, `packages/core/src/page-repository.test.ts`.
**Done when:** `PageRepository.listAll()` returns every persisted page regardless of `projectId`, implemented via the existing `StoragePort.list()` call (no port interface change), with a passing test covering pages across multiple projects. [FR-9]
**Depends on:** none
**Estimate:** 1
**Notes:** Follow the existing `list(projectId)` implementation (`storage.list<Page>(COLLECTION)`) minus the project filter; keep the same file, same sort (`byOrder` is project-scoped and not meaningful across projects, so ordering here is unspecified — callers apply their own order).
**Done:** [ ]

### Task 2: Search index construction (pure)

**What:** A pure `packages/core/src/search.ts` module that builds an indexed, role-tagged list of searchable entries from projects and pages, with no I/O.
**Files:** `packages/core/src/search.ts` (new), `packages/core/src/search.test.ts` (new), `packages/core/src/index.ts` (export).
**Done when:** `buildSearchIndex(projects: Project[], pages: Page[]): SearchIndexEntry[]` returns one entry per indexable field — Notes `body`; Build log `sketch` and each `moves[].text`; Presets `title`, each `devices[].name`, `devices[].settings`, each `devices[].params[].key` and `.value` — each entry carrying its role tag (`body`, `sketch`, `move`, `track-name`, `device-name`, `device-settings`, `param-key`, `param-value`), the owning page id/title, and the owning project id/name; `Project.name` itself is never indexed as a field (only carried as context on each entry); empty-string fields produce no entry; the function takes plain arrays and returns a plain array with no `StoragePort`/async involved; unit tests cover all eight roles and confirm project name is not itself matchable. [FR-3, FR-4, FR-10, FR-11]
**Depends on:** none
**Estimate:** 3
**Notes:** This is the fixed, closed field inventory from `page.ts` — do not add fields beyond FR-3's enumeration. Keep entries flat (one role/value per entry) so query matching (Task 3) doesn't need to know per-type shape.
**Done:** [ ]

### Task 3: Search query matching (pure)

**What:** A pure query function over the index built in Task 2: case-insensitive substring matching, snippet extraction, and the FR-8 deterministic ordering.
**Files:** `packages/core/src/search.ts`, `packages/core/src/search.test.ts`.
**Done when:** `searchIndex(entries: SearchIndexEntry[], query: string): SearchResult[]` matches case-insensitively on substring (not exact whole-field equality); an empty/whitespace query returns an empty array (no I/O, no default "recent" set — see D-3); each `SearchResult` carries enough to render FR-5 (matched snippet, page title, role, project name) plus the target `projectId`/`pageId` for navigation; results are ordered by project recency (the order projects appear in the input array — callers pass `ProjectRepository.list()`'s already-recency-sorted output) then by page order within a project, never grouped by project/page/role and never randomized; unit tests cover: multi-field matches on one page, matches across multiple projects, case-insensitivity, substring-not-exact-match, and the ordering rule. [FR-5, FR-7, FR-8, FR-10, FR-11]
**Depends on:** 2
**Estimate:** 3
**Notes:** Snippet extraction can be a simple bounded-context substring around the match (e.g. N characters either side) — the spec doesn't mandate an algorithm, only that a recognizable snippet is present. No pagination/truncation logic belongs here (D-5) — return the full result list.
**Done:** [ ]

### Task 4: `Dialog` primitive in `packages/ui`

**What:** A general-purpose dismissible `Dialog` primitive in `packages/ui`, the first non-`AlertDialog` Radix overlay in the package.
**Files:** `packages/ui/src/components/ui/dialog.tsx` (new, via `shadcn add dialog`), `packages/ui/src/components/ui/dialog.stories.tsx` (new), `packages/ui/src/index.ts` (export).
**Done when:** a general-purpose dismissible `Dialog` primitive is exported from `@otocho/ui` and its Storybook story renders; it opens, closes, and dismisses on both Escape and overlay click.
**Depends on:** none
**Estimate:** 2
**Notes:** Same trap as every prior `shadcn add` — rewrite the emitted `@/…` imports to relative paths, and theme with brand tokens rather than hardcoded colors. This is the first general overlay primitive in the package; `AlertDialog` is confirm-only and is not a substitute. Depends on nothing, so it can run concurrently with Tasks 1–3.
**Done:** [ ]

### Task 5: `useSearch` hook + repository wiring

**What:** An app-layer `useSearch` hook that queries live data through Tasks 1–3.
**Files:** `apps/app/src/search/repository.ts` (new), `apps/app/src/search/useSearch.ts` (new), plus a colocated hook test.
**Done when:** the hook holds query-string state and returns correct `SearchResult`s for a query, reading live data via `projectsRepo.list()` + `pagesRepo.listAll()` and passing it through `buildSearchIndex`/`searchIndex`; an empty/whitespace query returns no results and performs no work; the hook accepts optional injected repositories so tests can back it with `MemoryStorage` (`apps/app/src/testing/memory-storage.ts`), matching the `usePages`/`useProjects` pattern; tested headlessly against seeded data with no DOM/component rendering involved. [FR-1, FR-2]
**Depends on:** 1, 3
**Estimate:** 2
**Notes:** No debounce is FR-mandated, but `listAll()` runs on every keystroke otherwise, so a short debounce is a reasonable implementer's call.
**Done:** [ ]

### Task 6: `SearchOverlay` + header trigger

**What:** A search overlay reachable from the shared app header, wired to the Task 5 hook and mounted with the Task 4 `Dialog` primitive.
**Files:** `apps/app/src/search/SearchOverlay.tsx` (new), `apps/app/src/App.tsx` (header trigger + mount the overlay), plus a colocated component test.
**Done when:** a search entry point is present in the shared header and identical on every route (`/`, `/projects/:id`, `/trash`), satisfying "from anywhere" (FR-1); opening it shows only the static line `Type to search your projects and pages.` before any query is typed, with no recent-items or suggested-content fetch or render (FR-1, D-3); typing drives the `useSearch` hook and re-renders (result row rendering itself remains Task 7); the overlay is dismissible via Escape and overlay click without navigating; jsdom component tests cover the pre-query state and that typing drives the hook. [FR-1, FR-2]
**Depends on:** 4, 5
**Estimate:** 2
**Done:** [ ]

### Task 7: Search results list rendering

**What:** The results list inside the search overlay: one row per match with project name, page title, match role, and snippet, plus the no-match state.
**Files:** `apps/app/src/search/SearchResults.tsx` (new), `apps/app/src/search/SearchResults.test.tsx` (new).
**Done when:** Results render as a single flat list (no grouping by project/page/role) in the order `searchIndex` returns them (D-4); every row shows project name, page title, match role label, and the matched snippet (FR-4, FR-5); when a query produces no matches, the surface shows `No matches for "<query>".` in place of results (FR-5, D-2); the full result set always renders with no pagination, truncation, or cap (FR-8, D-5); component tests cover a multi-result render, the no-match state, and that role labels are human-readable. [FR-4, FR-5, FR-8]
**Depends on:** 6
**Estimate:** 3
**Notes:** Role label copy (e.g. `param-key` → "Param key") is a display concern only — the underlying role tag from Task 2 stays as specified in FR-4.
**Done:** [ ]

### Task 8: Navigate to result

**What:** Selecting a result closes the overlay and opens the matching page directly in its normal editor, including when that page belongs to a project not currently open.
**Files:** `apps/app/src/App.tsx` (route param/query-string support for a target page), `apps/app/src/projects/ProjectView.tsx` (read the target page id on mount and select it instead of defaulting to the first page), `apps/app/src/search/SearchResults.tsx` (navigate on select), `apps/app/src/projects/ProjectView.test.tsx` (extend).
**Done when:** Selecting a search result navigates to `/projects/:id` with the matching page pre-selected — the editor shown is the same one reached by manually opening that project and clicking that page in `PageList` — and works whether or not that project was already open in the current session; the overlay closes on selection; a test exercises navigating from a result to a specific non-first page and confirms the correct editor renders. [FR-6]
**Depends on:** 7
**Estimate:** 3
**Notes:** This is the trickiest task in the feature (see Scaffold context) — page selection today is local `useState` in `ProjectView`, not addressable from outside it. Whatever mechanism is chosen (query param or nested route), keep it additive: manual navigation to `/projects/:id` with no page hint must keep defaulting to the first page, unchanged.
**Done:** [ ]

## Summary

- Total tasks: 8
- Total estimated effort: 19 story points
- Critical path: Tasks 2 → 3 → 5 → 6 → 7 → 8 (Task 1 and Task 4 are both independent and can run concurrently with the early core work; Task 1 must land before Task 5, Task 4 before Task 6)
- Risks:
  - **Task 8 navigation mechanism:** the biggest unknown in the feature. `ProjectView`'s page selection is in-pane state with no external hook today; retrofitting a route/param without breaking the existing "opens to first page" default needs care and its own test.
  - **Task 4 new `Dialog` primitive:** first non-`AlertDialog` Radix dialog in `packages/ui`; watch for the `shadcn add` relative-import rewrite and brand-token theming (no hardcoded colors), same trap as every prior `shadcn add`.
  - **Task 2/3 field-inventory drift:** the indexable field list is closed by the spec (FR-3/FR-4); if `packages/core/src/page.ts` gains a field later without a spec update, the index silently misses it — worth a comment in `search.ts` pointing back to FR-3 so the two don't drift unnoticed.
  - **Performance at scale (accepted, not mitigated):** per D-5, `useSearch` (Task 5) rebuilds the full index from `listAll()`/`list()` on every query with no caching or pagination; the spec treats this as fine at MVP scale and a revisit-when-observed decision, not a defect to engineer around now.
