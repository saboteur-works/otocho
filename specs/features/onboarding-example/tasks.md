# Implementation Tasks: Onboarding example project

**Spec:** `specs/features/onboarding-example.md`
**Granularity:** story points (1/2/3/5/8)

## Scaffold context (already in place)

Projects, Pages, and Search are all complete and establish every pattern this feature reuses; nothing here adds a new persisted entity type or touches `StoragePort`'s interface.

- `packages/storage/src/port.ts` — `StoragePort` is already a generic `{ list/get/put/remove }` store keyed by `{ id }` records in a named collection. D-1's `app-meta` collection needs no port change, exactly like Search's FR-9 (`packages/core/src/page-repository.ts`'s `listAll()`) added a capability at the repository seam rather than the port.
- `packages/core/src/project.ts` / `project-repository.ts` — `createProject(input, { id?, now? })` and `ProjectRepository.create/rename/softDelete/restore/purge`, all routed through `storage.put`/`storage.remove` on the `"projects"` collection. This is the exact shape `packages/core/src/onboarding-repository.ts` (Task 1) follows for the new `"app-meta"` collection.
- `packages/core/src/page.ts` — `createNotesPage`/`createBuildLogPage`/`createPresetPage` (all `{ id?, now? }`-injectable), plus the pure content transforms the seed content needs: `appendMove`, `createPresetDevice`/`addDevice`, `createPresetParam`/`addParam`. `PresetPage.title` is the track name (design: title === track, per D-2's "Lead synth" track).
- `packages/core/src/page-repository.ts` — `PageRepository.create(projectId, type, title?)` creates a page using the repo's own injected `generateId`/`now` and empty content; content is then set via `PageRepository.mutate(id, transform)`, the repo's single content-write path (serialized per page id). Seeding a Build log/Presets page therefore means `create` then `mutate` with `appendMove`/`addDevice`/`addParam`, not constructing a full `Page` object by hand.
- `packages/core/src/index.ts` — barrel export (`export * from "./project"` etc.); new onboarding modules follow the same `export *` pattern.
- `apps/app/src/projects/repository.ts` / `apps/app/src/pages/repository.ts` / `apps/app/src/search/repository.ts` — the singleton-repo-per-feature-folder pattern (`export const projectsRepo = new ProjectRepository({ storage: new WebStorageAdapter() })`). A new `apps/app/src/onboarding/repository.ts` follows the same pattern for the `OnboardingRepository`.
- `apps/app/src/projects/ProjectsHome.tsx` — renders `CreateProject` unconditionally above `ProjectList`, backed by `useProjects` (auto-fetches on mount via `useEffect`). FR-9's CTA is already this existing form (D-3) — no new UI. FR-10's ordering ("seed check completes before `ProjectsHome`'s initial project list read, but does not block the app shell") is satisfied by gating when `useProjects`'s effect is allowed to run, not by blocking `ProjectsHome`'s own render.
- `apps/app/src/search/useSearch.ts` — the one-hook-per-concern pattern (`useSearch` wraps its own repos, takes optional injected ones, drives its own effect) that D-6 names as the model for `useOnboardingSeed`.
- `apps/app/src/testing/memory-storage.ts` — `MemoryStorage`, the in-memory `StoragePort` every repository/hook test in this feature uses instead of IndexedDB.
- `apps/app/src/projects/ProjectList.tsx` — renders each project as a plain row with no per-row variant/badge affordance today; FR-11 requires this stays true for the example project (D-5).
- Test infra: Vitest, `node` environment by default, jsdom opt-in via `// @vitest-environment jsdom`. Every task below must keep the existing suite green.

**Cross-cutting decisions (settle once, in the task noted; not separate tasks):**
- **Marker is the seed-gate, not the project's existence (Task 1/3):** per D-1/D-4, `OnboardingRepository`'s `app-meta` record is the sole source of truth for "already seeded." `seedOnboardingExample` (Task 3) must check the marker, never `ProjectRepository`/`PageRepository` state, before deciding to seed.
- **No new `StoragePort` capability.** The `app-meta` collection is read/written through the existing generic `list/get/put/remove` (D-1); nothing here changes `packages/storage`.
- **Idempotency under racing mounts (Task 4) is a first-class concern, not a side effect of the marker check.** A plain "read marker, if absent create" has a race window between two concurrent callers both reading "absent" before either writes. Task 4 closes that window with a shared in-flight guard, and gets its own test proving at most one project/marker is ever written under concurrent invocation (FR-4).
- **Dev/QA reset (Task 9) ships no production code.** D-8 explicitly rejects any shipped code path (query param, `import.meta.env.DEV` hook); the task's deliverable is developer-facing tooling/documentation only, and per this run's write constraints that deliverable cannot be authored here — see the task's Notes.

### Task 1: Onboarding marker data + repository

**What:** A pure `OnboardingMarker` data shape and an `OnboardingRepository`, following the `project.ts`/`project-repository.ts` pattern, for the new `app-meta` collection (D-1, FR-2).
**Files:** `packages/core/src/onboarding.ts` (new), `packages/core/src/onboarding-repository.ts` (new), `packages/core/src/onboarding-repository.test.ts` (new), `packages/core/src/index.ts` (export).
**Done when:** `onboarding.ts` exports an `OnboardingMarker` type (`{ id: "onboarding-seed"; seededAt: string; exampleProjectId: string }`) and a `createOnboardingMarker(exampleProjectId, options?: { now?: () => string })` factory; `OnboardingRepository` (constructed with `{ storage: StoragePort, now?: () => string }`, mirroring `ProjectRepositoryDeps`) exposes `getMarker(): Promise<OnboardingMarker | null>` and `markSeeded(exampleProjectId: string): Promise<OnboardingMarker>`, both routed through `storage.get`/`storage.put` on the `"app-meta"` collection with no port interface change; tests cover `getMarker()` returning `null` on a fresh store, `markSeeded` persisting and returning the exact shape, and a second `getMarker()` round-tripping the same record. [FR-2]
**Depends on:** none
**Estimate:** 2
**Done:** [ ]

### Task 2: Example project seed content (pure)

**What:** A pure builder that assembles the example project's `Project` and three `Page`s in memory, using only existing core factories and transforms, with injectable ids/clock (FR-5).
**Files:** `packages/core/src/onboarding-seed-content.ts` (new), `packages/core/src/onboarding-seed-content.test.ts` (new), `packages/core/src/index.ts` (export).
**Done when:** `buildExampleProjectSeed(options?: { now?: () => string; generateId?: () => string })` returns `{ project: Project; notesPage: NotesPage; buildLogPage: BuildLogPage; presetsPage: PresetPage }` built via `createProject`, `createNotesPage`/`createBuildLogPage`/`createPresetPage`, `appendMove`, `createPresetDevice`+`addDevice`, and `createPresetParam`+`addParam` — never by hand-constructing a `Page`/`Project` object; the Notes `body`, Build log `sketch`, at least one Build log `moves[].text`, and at least one Presets `devices[].name` + one `params[].key`/`.value` are all non-empty (FR-6); content reads as durable-memory framing per D-2 (e.g. the Notes body references the DAW project file being lost and this record surviving); calling the builder twice with the same injected `now`/`generateId` produces byte-identical output, proving determinism; unit tests assert every FR-6 field is non-empty and that two calls with fixed injected options match. [FR-1, FR-5, FR-6]
**Depends on:** none
**Estimate:** 3
**Notes:** Exact copy is a directional default (D-2/D-7) — implementers may adjust wording as long as the non-empty-field and durable-memory-framing assertions hold; don't gate the task on exact string review.
**Done:** [ ]

### Task 3: `seedOnboardingExample` orchestration

**What:** A core function that composes Tasks 1 and 2 into the actual seeding operation: check the marker, and if absent, persist the example project and its three pages through the real repositories and write the marker.
**Files:** `packages/core/src/onboarding-seed.ts` (new), `packages/core/src/onboarding-seed.test.ts` (new), `packages/core/src/index.ts` (export).
**Done when:** `seedOnboardingExample(deps: { projects: ProjectRepository; pages: PageRepository; onboarding: OnboardingRepository })` first calls `onboarding.getMarker()`; if a marker exists, it returns without creating anything (FR-3); if absent, it creates the project via `projects.create`, creates each of the three pages via `pages.create` then fills content via `pages.mutate` using Task 2's seed content, then calls `onboarding.markSeeded(project.id)` — all writes go through `ProjectRepository`/`PageRepository`/`OnboardingRepository`, never `StoragePort` directly (FR-5); a test against `MemoryStorage`-backed repositories asserts a single call produces exactly one project, three pages (one per type) each satisfying Task 2's FR-6 content checks, and one marker whose `exampleProjectId` matches the created project; a second sequential call after the first completes creates no additional project, pages, or marker (FR-3). [FR-1, FR-3, FR-5]
**Depends on:** 1, 2
**Estimate:** 3
**Done:** [ ]

### Task 4: Idempotency under racing invocation

**What:** A guard around `seedOnboardingExample` so that multiple callers invoking it concurrently — before either has written the marker — still result in at most one project and one marker for the install (FR-4).
**Files:** `packages/core/src/onboarding-seed.ts`, `packages/core/src/onboarding-seed.test.ts`.
**Done when:** concurrent invocation is closed at the source: `seedOnboardingExample` (or a thin wrapper it exports, e.g. `ensureOnboardingSeeded`) caches its in-flight promise per `deps` instance so that two calls fired without awaiting the first (e.g. `Promise.all([ensureOnboardingSeeded(deps), ensureOnboardingSeeded(deps)])`) share one execution; a dedicated test fires two-plus concurrent calls against the same `MemoryStorage`-backed repositories before any write has landed and asserts exactly one project, three pages, and one marker exist afterward — this test is separate from Task 3's sequential-call test, not a variation appended to it. [FR-4]
**Depends on:** 3
**Estimate:** 2
**Notes:** This closes the race for a single JS process (e.g. two mounts of the Task 5 hook, or React double-invoke in Strict Mode) via an in-memory guard; true cross-tab/multi-process races are not addressed here — the spec's "two mounts racing on first load" example is the in-process case this guard covers.
**Done:** [ ]

### Task 5: `useOnboardingSeed` hook + repository wiring

**What:** An app-layer hook that calls the Task 4 guarded seed function once against the app's live repositories, following the `useSearch`/`useProjects` one-hook-per-concern pattern (D-6).
**Files:** `apps/app/src/onboarding/repository.ts` (new — singleton `OnboardingRepository` wired to `WebStorageAdapter`, reusing `projectsRepo`/`pagesRepo` from `apps/app/src/projects/repository.ts` and `apps/app/src/pages/repository.ts`), `apps/app/src/onboarding/useOnboardingSeed.ts` (new), `apps/app/src/onboarding/useOnboardingSeed.test.ts` (new).
**Done when:** `useOnboardingSeed(repos?)` accepts optional injected `{ projects, pages, onboarding }` repositories (defaulting to the app's singletons, matching the `usePages`/`useProjects`/`useSearch` injection pattern) and returns `{ ready: boolean }`, `false` until the underlying `ensureOnboardingSeeded` call resolves, `true` after; the hook itself performs no direct `StoragePort` access; a headless test backs the hook with `MemoryStorage`, mounts it (or invokes it via `renderHook`) twice concurrently, and asserts `ready` eventually becomes `true` for both while only one project/marker was created (reusing Task 4's guard, not re-implementing it). [FR-4, D-6]
**Depends on:** 4
**Estimate:** 2
**Done:** [ ]

### Task 6: Wire the seed check into `ProjectsHome`

**What:** `ProjectsHome` calls `useOnboardingSeed` and defers `useProjects`'s first read until seeding has settled, without blocking the app shell or the `CreateProject` CTA from rendering.
**Files:** `apps/app/src/projects/ProjectsHome.tsx`, `apps/app/src/projects/ProjectsHome.test.tsx` (new or extended).
**Done when:** `ProjectsHome` renders its heading and the `CreateProject` form immediately on every render, regardless of seed state (FR-9); `ProjectList`/`useProjects`'s initial `repo.list()` read does not fire until `useOnboardingSeed`'s `ready` flips `true` (FR-10) — e.g. by not mounting the `useProjects`-backed list subtree until `ready`; the app shell (header, routing, `App.tsx`) is unaffected and still renders immediately, since the gating is local to `ProjectsHome`'s list read, not a global effect (FR-10, explicitly not in `App.tsx` per D-6); a component test backed by `MemoryStorage` confirms `CreateProject` is present before the seed resolves, and that the seeded example project subsequently appears in the rendered list once it does. [FR-1, FR-9, FR-10]
**Depends on:** 5
**Estimate:** 3
**Done:** [ ]

### Task 7: Deletion/soft-delete/purge never resurrects the seed, and the example is ordinary data

**What:** An integration test proving FR-3's "never resurrects" guarantee and FR-8's "identical to a user-created project" guarantee, using only the existing `ProjectRepository`/`PageRepository` operations — no new product code.
**Files:** `packages/core/src/onboarding-seed.test.ts` (extended) or a new `packages/core/src/onboarding-integration.test.ts`.
**Done when:** a test seeds the example project via `seedOnboardingExample`, then exercises `ProjectRepository.rename`, `PageRepository` add/reorder/delete of a page, `ProjectRepository.softDelete`, `restore`, and `purge` on the example project exactly as it would on a user-created project, asserting each succeeds with the same behavior/return shape; after `purge`, calling `seedOnboardingExample` again creates no new project (the marker from Task 3 still exists), proving deletion (including full purge) never resurrects the seed. [FR-3, FR-8]
**Depends on:** 3
**Estimate:** 2
**Done:** [ ]

### Task 8: Example project renders with no visual distinction

**What:** A test confirming `ProjectList` renders the example project as a plain row, matching FR-11/D-5.
**Files:** `apps/app/src/projects/ProjectList.test.tsx` (extended).
**Done when:** a test renders `ProjectList` with a project shaped like the seeded example (same fields as any `Project`, no extra "isExample" flag consumed by the component) alongside an ordinary user-created project, and asserts both rows render with identical markup/classes — no badge, label, or variant distinguishing either. [FR-11]
**Depends on:** 6
**Estimate:** 1
**Done:** [ ]

### Task 9: Seeded content is reachable via Search

**What:** A test proving the example project's pages surface in Search results with no Search code changes, per FR-7.
**Files:** `packages/core/src/search.test.ts` (extended) or `apps/app/src/search/useSearch.test.ts` (extended).
**Done when:** a test builds the example project/pages via Task 2's `buildExampleProjectSeed` (or seeds them via Task 3 into a `MemoryStorage`-backed repo set and reads them back through `PageRepository.listAll()`/`ProjectRepository.list()`), runs the result through the existing `buildSearchIndex`/`searchIndex` (or `useSearch`), and asserts a query matching the Notes body text, a Build log move, and a Presets device name each return a result pointing at the example project — with the assertion made entirely against Search's existing public functions/hook, no new Search module code. [FR-7]
**Depends on:** 3
**Estimate:** 1
**Done:** [ ]

### Task 10: Dev/QA onboarding-seed reset

**What:** A documented manual step and/or a small `pnpm` script that deletes the `app-meta` `"onboarding-seed"` marker record, so a developer can re-exercise first-launch behavior in a real browser, per D-8.
**Files:** developer-facing only — e.g. a `pnpm` script (`package.json` + a small Node script) that clears the `onboarding-seed` record from the web adapter's storage, and/or a documented manual step (browser devtools: clear the `app-meta` IndexedDB object store). Exact location TBD by the implementer; it must live outside the production bundle (not under `apps/app/src` in a way that ships to users).
**Done when:** a developer can restore first-launch behavior (re-trigger seeding) via either a documented manual step or a `pnpm` script, without any code path added to the shipped app — no query param, no `import.meta.env.DEV`-gated in-app hook, no visible UI (per D-8's rejected alternatives and the spec's Non-goals); confirmed by inspection that the production build contains no reference to the reset mechanism.
**Depends on:** 1
**Estimate:** 1
**Notes:** This task's deliverable is developer tooling/documentation, which will likely need to live outside `specs/` (e.g. `scripts/`, a `package.json` script entry, or a `CONTRIBUTING.md`/dev-docs section) — flagging for the pipeline lead, since this task list was authored under a write constraint limited to `specs/*` and could not create that file here.
**Done:** [ ]

## Summary

- Total tasks: 10
- Total estimated effort: 20 story points
- Critical path: Tasks 1 → 3 → 4 → 5 → 6 → 8 (Task 2 is independent of Task 1 and can run concurrently; Task 7, Task 9, and Task 10 branch off Task 3/Task 1 and can run in parallel with each other and with Tasks 4-6 once Task 3 lands)
- Risks:
  - **Task 4 concurrency guard:** the trickiest correctness property in the feature — an in-flight-promise cache is simple to state but easy to get subtly wrong (e.g. caching per-call-site instead of per-install, or not sharing the cache between the hook's own re-renders); its dedicated test in Task 4 is load-bearing, not optional.
  - **Task 6 gating mechanism:** deferring `useProjects`'s first read without blocking `ProjectsHome`'s own render or the app shell requires care similar to Search's Task 8 navigation problem — get the sequencing wrong and either the CTA disappears until seeding finishes (violates FR-9) or the list read races the seed write (reintroduces FR-3/FR-4 risk).
  - **Task 10 has no home in this run:** its deliverable is developer tooling/documentation that likely belongs outside `specs/`; this task list only specifies it, it does not implement it, per the write-path constraint this run operated under.
  - **Copy drift (accepted, not mitigated):** per D-2/D-7, Task 2's exact seed wording is a directional default with no copy-review gate — implementers may adjust it freely as long as FR-6's non-empty-field and durable-memory-framing checks hold.
