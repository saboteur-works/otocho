# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Otocho is

Otocho (音帳, "sound-notebook") is a DAW-agnostic notebook and idea sketchpad for audio projects: a notebook of **projects**, each holding purpose-built **pages** (Notes, Build log, track-scoped Presets) rather than blank documents. It's local-first with BYOS sync (Dropbox at MVP) and runs no first-party backend. The product thesis and the full MVP scope live in `docs/concept.md` and `docs/spec.md`; per-feature specs/designs/tasks live under `docs/features/<feature>/`. Functional requirements are referenced throughout the code as `FR-N` — those numbers point at `docs/spec.md`.

## Commands

pnpm workspace (pnpm 9, Node ≥20). Run from the repo root:

- `pnpm dev` — run the web app (Vite) — `@otocho/app`
- `pnpm build` — production build of the web app
- `pnpm typecheck` — `tsc --noEmit` across every package (`pnpm -r`)
- `pnpm test` — run all tests once (Vitest)
- `pnpm test:watch` — Vitest in watch mode
- `pnpm storybook` — Storybook for the design system (`@otocho/ui`, port 6006)

Run a single test file or pattern: `pnpm test <path-or-name>` (e.g. `pnpm test page-repository`), or `pnpm test -t "<test name>"`.

Tests are colocated as `*.test.ts(x)` next to source. The root `vitest.config.ts` defaults the environment to `node`; component tests that need a DOM opt in per-file with a `// @vitest-environment jsdom` directive at the top.

## Architecture

The whole product is **one `react-dom` codebase** (`@otocho/app`) wrapped by thin native shells — Electron (`apps/desktop`) and Capacitor (`apps/mobile`), both currently **stubs** (`README.md` only). This is deliberate (see the `project_stack` memory): not React Native. Layers depend strictly downward — `app → ui`, `app → core → storage`.

**`packages/storage` — the persistence seam.** Defines `StoragePort` (`list/get/put/remove` over collections of `{ id }` records) and one adapter per platform. Only the web adapter (`./web`, IndexedDB-backed) exists today; desktop (Node fs) and mobile (Capacitor Filesystem) are planned. The model is **one record per page**, so future sync conflicts stay page-scoped (FR-12) — every domain decision honors this seam.

**`packages/core` — platform-agnostic domain.** Two halves per entity:
- Pure data + functions (`project.ts`, `page.ts`): factories (`createProject`, `createPage`), invariants, sort comparators (`byOrder`, `byRecency`), and pure transforms (`appendMove`). No I/O. Creation functions take a `{ id?, now? }` options bag so tests can inject deterministic ids/clocks.
- Repositories (`*-repository.ts`): a class constructed with `{ storage: StoragePort, now?, generateId? }` that does all reads/writes through the injected port. This is the only place the rest of the app touches persistence, and it's what makes the same logic run on every platform and behind future sync.

`Page` is a **discriminated union over `type`** (`notes | build-log | presets`) sharing a `PageBase` (id, `projectId`, title, `order`, timestamps). Reorder rewrites the `order` sort key, never array position. Projects use **soft-delete** (`deletedAt` marker → Trash → permanent removal), not hard delete.

**`apps/app` — the React UI.** `HashRouter` (works under `file://` for the desktop/mobile shells). Organized by feature folder (`projects/`, `pages/`), each with React components, a custom hook (`useProjects`, `usePages`, `useTrash`) that wraps a repository and owns list state, and a `repository.ts` that exports a **singleton repo** wired to `WebStorageAdapter`. Hooks accept an optional repo argument so tests pass a repo backed by `MemoryStorage` (`apps/app/src/testing/memory-storage.ts`). Note: `apps/app/src/pages/` is the page-*type* feature (the Page editors); routed screens live in `apps/app/src/projects/`.

**`packages/ui` — the design system.** shadcn/ui components (Radix + `class-variance-authority`) on Tailwind v4, themed with **saboteur-styles** brand tokens (`otocho-theme.css`). Otocho is a SAB/works product; brand tokens are sourced from the saboteur-styles repo (see the `reference_saboteur_styles` memory) — don't hardcode brand colors. Add primitives here and re-export from `src/index.ts`; the app consumes `@otocho/ui` and `@otocho/ui/styles.css`. Because the package is consumed via a workspace symlink, `apps/app/src/index.css` uses `@source` to point Tailwind at the UI source so its classes get emitted.

### Where to add things
- New page type → extend the `Page` union and add a `create*`/transform in `core/src/page.ts`, then a `*Page.tsx` editor in `apps/app/src/pages/`.
- New persisted entity → data + repository in `core`, never touching IndexedDB directly; the repo talks only to `StoragePort`.
- New UI primitive → `packages/ui`, exported from its `index.ts`, with a Storybook story.
- Keep domain logic pure and in `core`; keep I/O behind `StoragePort`. Persisted shapes are sync-bound — preserve the file-per-page / append-merge model when changing them.
