# Implementation Tasks: Projects

**Spec:** `docs/features/projects/spec.md`
**Granularity:** story points (1/2/3/5/8)

## Scaffold context (already in place)

The pnpm monorepo is scaffolded and building. Relevant to this feature:

- `packages/core/src/project.ts` — `Project` entity + helpers (`createProject`, `newProjectId`, `isDeleted`, `byRecency`). Covers the shape behind FR-2/5/10.
- `packages/storage/src/port.ts` — `StoragePort` (file-per-record seam); `web-adapter.ts` — scaffold-grade **localStorage** adapter (to be upgraded to OPFS/IndexedDB).
- `packages/ui` — shadcn + Tailwind v4 + Storybook, themed via saboteur tokens; only `Button` exists so far.
- `apps/app/src/App.tsx` — a throwaway smoke-test shell that lists/creates projects; **replaced** by the real Projects UI in Tasks 2–6.

**Cross-cutting needs (apply across tasks, not separate tasks):**
- **Routing:** the app has none yet. Task 3 introduces it (react-router or a simple view-state switch) so opening a project is navigable. Decide once, in Task 3.
- **shadcn `add` import rewrite:** components added via `shadcn add` (Input, AlertDialog below) emit `@/…` imports; rewrite to relative paths (the `ui` package is consumed as source — see scaffold notes).
- **No test runner configured.** "Done when" conditions can be met manually, but if you want automated coverage, add vitest first (outside these FRs).

### Task 1: Project repository + durable local persistence ✅

**Status:** Done — 2026-05-25. `ProjectRepository` in `packages/core/src/project-repository.ts`; `WebStorageAdapter` upgraded to IndexedDB (`@otocho/storage/web` subpath; seam stays the default DOM-free export). 13 passing tests; all packages typecheck; app builds. See `follow-up-work.md` for deferred items (OPFS, transaction-completion).
**What:** A `ProjectRepository` exposing create/list/get/rename/soft-delete/restore/purge over an injected `StoragePort`, plus a durable web persistence adapter.
**Files:** `packages/core/src/project-repository.ts` (new; consumes `StoragePort` type from `@otocho/storage`), `packages/core/package.json` (add `@otocho/storage` dep), `packages/storage/src/web-adapter.ts` (upgrade localStorage → OPFS/IndexedDB), `packages/core/src/index.ts` (export repo).
**Done when:** Through the repository, a Project can be created, saved, and reloaded across an app restart with ID/name/timestamps intact; ID is independent of name. [FR-2, FR-5, FR-9, FR-10]
**Depends on:** none (entity + port already scaffolded)
**Estimate:** 3
**Notes:** Entity and port already exist, so this is the CRUD logic + persistence durability. Keep the repo platform-agnostic (depends only on the `StoragePort` interface) so desktop/mobile adapters drop in later. Persistence stays DAW-file-independent.

### Task 2: Create project ✅

**Status:** Done — 2026-05-25. `CreateProject` component + `useProjects` hook in `apps/app/src/projects/`; `Input` added to `@otocho/ui`. React component-test infra (jsdom + Testing Library) set up. 17 passing tests; typecheck + build clean. "Opens it on success" is a minimal local-state selection pending Task 3 routing — see `follow-up-work.md`.
**What:** An inline create action requiring a name that produces a new persisted project and opens it.
**Files:** `apps/app/src/projects/CreateProject.tsx` (new), `apps/app/src/projects/useProjects.ts` (new; React hook over the repository, shared by Tasks 2–6), `packages/ui/src/components/ui/input.tsx` (`shadcn add input`).
**Done when:** Entering a name and confirming creates a persisted project in ≤2 interactions and navigates into it; empty/whitespace name is rejected; a second project with the same name succeeds as a distinct entity. [FR-1, FR-2, FR-3, FR-5]
**Depends on:** 1
**Estimate:** 2
**Notes:** Inline entry, no modal (FR-9). `createProject` already trims and rejects empty names.

### Task 3: Project list + open, ordered by recency ✅

**Status:** Done — 2026-05-25. `ProjectList` + `ProjectView` + `ProjectsHome` in `apps/app/src/projects/`; `App.tsx` is now a `HashRouter` shell (routes `/` and `/projects/:id`). `react-router-dom` v6 added; shared repo singleton extracted (`repository.ts`). Opening a project advances `lastOpenedAt` (on view mount) so it sorts to the top on return. Resolves the Task 2 open-state placeholder. 22 passing tests; typecheck + build clean.
**What:** A list of all active (non-deleted) projects, each openable, sorted by most recently opened; opening updates last-opened. Introduces app routing.
**Files:** `apps/app/src/projects/ProjectList.tsx` (new), `apps/app/src/projects/ProjectView.tsx` (new; opened-project screen — minimal, since pages are a separate feature), `apps/app/src/App.tsx` (replace smoke-test shell with router + routes), `apps/app/package.json` (router dep if chosen).
**Done when:** All active projects appear sorted by recency; opening one navigates to its view and moves it to the top on return; order persists across restart. [FR-4]
**Depends on:** 1, 2
**Estimate:** 3
**Notes:** `byRecency` comparator already exists. Opening must update `lastOpenedAt` via the repository. Verify duplicate-named projects render as distinct rows.

### Task 4: Rename project ✅

**Status:** Done — 2026-05-25. Inline editable title in `ProjectView` (Rename → Input + Save/Cancel, Enter submits, Escape cancels); uses the repository's existing tested `rename`. Name updates immediately, id unchanged, `updatedAt` advances. 23 passing tests; typecheck + build clean.
**What:** Inline rename of an existing project that takes effect immediately without changing its ID.
**Files:** `apps/app/src/projects/ProjectList.tsx` and/or `ProjectView.tsx` (rename affordance), `packages/core/src/project-repository.ts` (`rename` method).
**Done when:** Renaming updates the displayed name and persisted record immediately, ID is unchanged, and `updatedAt` advances. [FR-6]
**Depends on:** 1, 3
**Estimate:** 1

### Task 5: Soft-delete with confirmation ✅

**Status:** Done — 2026-05-25. `AlertDialog` added to `@otocho/ui` (Radix-based, brand-styled, no animation deps); `ProjectView` has a Delete affordance gated by a confirm dialog. Confirm → `repo.softDelete` (sets `deletedAt`) → navigate home, where the project no longer appears; Cancel leaves it untouched. 25 passing tests; typecheck + build clean.
**What:** A delete action that prompts for confirmation, then marks the project deleted (recoverable) and removes it from the default list.
**Files:** `packages/ui/src/components/ui/alert-dialog.tsx` (`shadcn add alert-dialog`), `apps/app/src/projects/` (delete action + confirm), `packages/core/src/project-repository.ts` (`softDelete` sets `deletedAt`).
**Done when:** Deleting requires explicit confirmation; on confirm the project leaves the default list but its record is retained with `deletedAt` set; canceling leaves it unchanged. [FR-7, FR-8]
**Depends on:** 1, 3
**Estimate:** 2

### Task 6: Trash — restore and permanent removal ✅

**Status:** Done — 2026-05-25. `TrashView` + `useTrash` in `apps/app/src/projects/`; `/trash` route + a Trash link on the home screen. Restore returns a project to the active list (data intact); permanent removal is gated behind its own confirm dialog. 29 passing tests; typecheck + build clean. **All Projects tasks complete.**
**What:** A view of soft-deleted projects with restore-to-active and permanent-delete actions.
**Files:** `apps/app/src/projects/TrashView.tsx` (new), `apps/app/src/App.tsx` (trash route), `packages/core/src/project-repository.ts` (`restore` clears `deletedAt`; `purge` removes via `StoragePort.remove`).
**Done when:** A deleted project can be restored into the active list (re-entering recency order), or permanently removed so it no longer persists; restored projects reappear with data intact. [FR-8]
**Depends on:** 5
**Estimate:** 3
**Notes:** Permanent removal is the only irreversible path — gate it behind its own confirmation.

## Summary

- Total tasks: 6
- Total estimated effort: 14 story points
- Critical path: Tasks 1 → 2 → 3 → 5 → 6 (rename, Task 4, branches off Task 3 in parallel)
- Risks:
  - **Task 1 persistence durability:** the scaffold's localStorage adapter is a placeholder; the OPFS/IndexedDB upgrade is the real unknown and gates every later task. The repository API itself is low-risk now that the entity and port are defined.
  - **Task 3 routing decision:** the app has no router yet; the choice (react-router vs. view-state) ripples into Tasks 4–6 navigation.
  - **Sync interaction (downstream, out of scope):** soft-delete/restore (Tasks 5–6) must later merge cleanly across devices once Dropbox sync (FR-11–FR-12) lands — the file-per-record `StoragePort` seam is designed for this, but the delete/restore semantics will need revisiting then.
