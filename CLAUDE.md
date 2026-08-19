# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Otocho is

Otocho (音帳, "sound-notebook") is a DAW-agnostic notebook and idea sketchpad for audio projects: a notebook of **projects**, each holding purpose-built **pages** (Notes, Build log, track-scoped Presets) rather than blank documents. It's local-first with BYOS sync (Dropbox at MVP) and runs no first-party backend. The product thesis and the full MVP scope live in `docs/concept.md` and `docs/spec.md`; per-feature specs/designs/tasks live under `docs/features/<feature>/` (Projects, Pages) or `specs/features/<feature>/` (Search onward, plus the feature breakdown at `specs/product/otocho.features.md`). The split is an artifact of the saboteur-ship plan gate, which only exempts `specs/*` from its pre-approval write block; `specs/` is the location for new spec work, and the two shipped features were left where they were rather than moved. Functional requirements are referenced throughout the code as `FR-N` — those numbers point at `docs/spec.md`.

## Commands

pnpm workspace (pnpm 9, Node ≥20). Run from the repo root:

- `pnpm dev` — run the web app (Vite) — `@otocho/app`
- `pnpm build` — production build of the web app
- `pnpm typecheck` — `tsc --noEmit` across every package (`pnpm -r`)
- `pnpm test` — run all tests once (Vitest)
- `pnpm test:watch` — Vitest in watch mode
- `pnpm storybook` — Storybook for the design system (`@otocho/ui`, port 6006)
- `pnpm reset-onboarding` — dev/QA helper that prints the steps to clear the onboarding-seed marker so first-launch seeding re-runs; see `docs/dev-onboarding-reset.md`. Ships no code to the production bundle.

Run a single test file or pattern: `pnpm test <path-or-name>` (e.g. `pnpm test page-repository`), or `pnpm test -t "<test name>"`.

Tests are colocated as `*.test.ts(x)` next to source. The root `vitest.config.ts` defaults the environment to `node`; component tests that need a DOM opt in per-file with a `// @vitest-environment jsdom` directive at the top.

## Architecture

The whole product is **one `react-dom` codebase** (`@otocho/app`) wrapped by thin native shells — Electron (`apps/desktop`) and Capacitor (`apps/mobile`), both currently **stubs** (`README.md` only). This is deliberate (see the `project_stack` memory): not React Native. Layers depend strictly downward — `app → ui`, `app → core → storage`.

**`packages/storage` — the persistence seam.** Defines `StoragePort` (`list/get/put/remove` over collections of `{ id }` records) and one adapter per platform. Only the web adapter (`./web`, IndexedDB-backed) exists today; desktop (Node fs) and mobile (Capacitor Filesystem) are planned. The model is **one record per page**, so future sync conflicts stay page-scoped (FR-12) — every domain decision honors this seam. Collections today: `projects`, `pages`, and `app-meta` (the onboarding-seed marker, keyed by a fixed record id — see below).

**`packages/core` — platform-agnostic domain.** Two halves per entity:
- Pure data + functions (`project.ts`, `page.ts`): factories (`createProject`, `createPage`), invariants, sort comparators (`byOrder`, `byRecency`), and pure transforms (`appendMove`). No I/O. Creation functions take a `{ id?, now? }` options bag so tests can inject deterministic ids/clocks.
- Repositories (`*-repository.ts`): a class constructed with `{ storage: StoragePort, now?, generateId? }` that does all reads/writes through the injected port. This is the only place the rest of the app touches persistence, and it's what makes the same logic run on every platform and behind future sync. `PageRepository.listAll()` reads pages across every project (no `projectId` scoping) for cross-project features like search.

Not every module is entity-scoped: `search.ts` is pure, no I/O — `buildSearchIndex` flattens projects/pages into a role-tagged index, `searchIndex` matches a query against it and extracts snippets. Callers own fetching and index freshness. Onboarding is split the same entity + orchestration way: `onboarding.ts` (the `OnboardingMarker` type + `createOnboardingMarker` factory, pure) and `onboarding-repository.ts` (`OnboardingRepository`, reading/writing that marker on the `app-meta` collection) follow the usual entity pattern; `onboarding-seed-content.ts` (pure `buildExampleProjectSeed`, built entirely from existing factories/transforms) and `onboarding-seed.ts` (`seedOnboardingExample`, marker-gated, plus `ensureOnboardingSeeded`, a per-repository-instance in-flight-promise guard against concurrent seeding) are orchestration on top, not a new entity.

`Page` is a **discriminated union over `type`** (`notes | build-log | presets`) sharing a `PageBase` (id, `projectId`, title, `order`, timestamps). Reorder rewrites the `order` sort key, never array position. Projects use **soft-delete** (`deletedAt` marker → Trash → permanent removal), not hard delete.

**`apps/app` — the React UI.** `HashRouter` (works under `file://` for the desktop/mobile shells). `/projects/:id` also accepts a `?page=<id>` query param that preselects a page on load — used by search-result navigation to deep-link past the default first-page selection; unrecognized/missing ids fall back to the first page as before. Organized by feature folder (`projects/`, `pages/`, `search/`, `onboarding/`), each with React components, a custom hook (`useProjects`, `usePages`, `useTrash`, `useSearch`, `useOnboardingSeed`) that wraps a repository and owns list state, and a `repository.ts` that exports a **singleton repo** wired to `WebStorageAdapter`. Hooks accept an optional repo argument so tests pass a repo backed by `MemoryStorage` (`apps/app/src/testing/memory-storage.ts`). Note: `apps/app/src/pages/` is the page-*type* feature (the Page editors); routed screens live in `apps/app/src/projects/`. `apps/app/src/search/` has no routed screen of its own — it's a header-mounted overlay (`SearchOverlay`) reachable from every route. `apps/app/src/onboarding/` has no UI of its own either — `useOnboardingSeed` runs the first-launch example-project seed check, and `ProjectsHome` (`apps/app/src/projects/ProjectsHome.tsx`) gates mounting its `useProjects`-backed list subtree on that hook's `ready` flag so the initial list read never races the seed write; the `CreateProject` CTA still renders unconditionally.

**`packages/ui` — the design system.** shadcn/ui components (Radix + `class-variance-authority`) on Tailwind v4, themed with **saboteur-styles** brand tokens (`otocho-theme.css`). Otocho is a SAB/works product; brand tokens are sourced from the saboteur-styles repo (see the `reference_saboteur_styles` memory) — don't hardcode brand colors. Add primitives here and re-export from `src/index.ts`; the app consumes `@otocho/ui` and `@otocho/ui/styles.css`. Because the package is consumed via a workspace symlink, `apps/app/src/index.css` uses `@source` to point Tailwind at the UI source so its classes get emitted. `Dialog` is the general-purpose overlay primitive (open/controllable, arbitrary content); `AlertDialog` stays reserved for destructive-action confirmations.

### Where to add things
- New page type → extend the `Page` union and add a `create*`/transform in `core/src/page.ts`, then a `*Page.tsx` editor in `apps/app/src/pages/`.
- New persisted entity → data + repository in `core`, never touching IndexedDB directly; the repo talks only to `StoragePort`.
- New UI primitive → `packages/ui`, exported from its `index.ts`, with a Storybook story.
- New indexable field on a page type → extend the fixed field inventory in `core/src/search.ts` (`buildSearchIndex`, `SearchIndexRole`) to match, and add a case in `apps/app/src/pages/` if the field needs its own editor first.
- A one-off, app-wide marker record (not an entity with its own list/UI) → follow the onboarding-seed pattern: a small `{ id, ...}` type + factory in `core`, a thin repository over the `app-meta` collection via the existing `StoragePort` (no port interface change needed), keyed by a fixed record id.
- Keep domain logic pure and in `core`; keep I/O behind `StoragePort`. Persisted shapes are sync-bound — preserve the file-per-page / append-merge model when changing them.
