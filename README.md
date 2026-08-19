# Otocho

**音帳, "sound-notebook"** — a DAW-agnostic notebook and idea sketchpad for audio projects.

Otocho is a notebook organized around **projects**, where each project holds purpose-built **pages** — Notes, a Build log, track-scoped Presets — rather than blank documents. It gives DAW users a structured home *outside* the DAW for the context they otherwise lose: the settings that made a sound work, the sequence of moves that made a track come together, and the loose notes around a project. Because content lives outside the DAW and syncs across machines, it doubles as durable project memory that survives even when a DAW file is lost, corrupted, or stranded on another computer.

The MVP is deliberately **DAW-agnostic and manual-entry**: it never reads or parses DAW files, so it works with any DAW (Ableton, Logic, Pro Tools, Reaper, FL…). It is **local-first with BYOS sync** (bring-your-own-storage, Dropbox at MVP) and runs **no first-party backend**.

The product thesis and full MVP scope live in [`docs/concept.md`](docs/concept.md) and [`docs/spec.md`](docs/spec.md); per-feature specs, designs, and task lists live under [`docs/features/`](docs/features/). Functional requirements are referenced throughout the code as `FR-N`, pointing at `docs/spec.md`.

> **Status:** MVP in progress. The web app runs; the Notes, Build log, and Presets page editors are built, search across all projects and pages is live, and first launch seeds a prefilled, searchable example project. The Electron and Capacitor shells are stubs.

## Getting started

Requires **Node ≥ 20** and **pnpm 9**.

```bash
pnpm install
pnpm dev          # run the web app (Vite) — @otocho/app
```

## Commands

Run from the repo root:

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run the web app (Vite) — `@otocho/app` |
| `pnpm build` | Production build of the web app |
| `pnpm typecheck` | `tsc --noEmit` across every package (`pnpm -r`) |
| `pnpm test` | Run all tests once (Vitest) |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm storybook` | Storybook for the design system (`@otocho/ui`, port 6006) |
| `pnpm reset-onboarding` | Dev/QA helper: prints steps to clear the onboarding-seed marker so first-launch seeding re-runs (see `docs/dev-onboarding-reset.md`); ships no code to the production bundle |

Run a single test file or pattern: `pnpm test <path-or-name>` (e.g. `pnpm test page-repository`), or `pnpm test -t "<test name>"`.

Tests are colocated as `*.test.ts(x)` next to source. The default environment is `node`; component tests that need a DOM opt in per-file with a `// @vitest-environment jsdom` directive.

## Architecture

The whole product is **one `react-dom` codebase** (`@otocho/app`) wrapped by thin native shells — Electron (`apps/desktop`) and Capacitor (`apps/mobile`). This is deliberate: not React Native. Layers depend strictly downward — `app → ui`, `app → core → storage`.

### Workspace layout

```
apps/
  app/        @otocho/app      — the React UI (Vite, HashRouter)
  desktop/    Electron shell   — stub
  mobile/     Capacitor shell  — stub
packages/
  ui/         @otocho/ui       — design system (shadcn/ui, Tailwind v4, brand tokens)
  core/       @otocho/core     — platform-agnostic domain (data + repositories)
  storage/    @otocho/storage  — the persistence seam (StoragePort + adapters)
```

- **`packages/storage`** — the persistence seam. Defines `StoragePort` (`list/get/put/remove` over collections of `{ id }` records) and one adapter per platform. Only the web adapter (IndexedDB-backed) exists today. The model is **one record per page**, so future sync conflicts stay page-scoped (FR-12).
- **`packages/core`** — the platform-agnostic domain. Pure data + functions (factories, invariants, sort comparators, pure transforms — no I/O) plus repositories (`*-repository.ts`) that do all reads/writes through the injected `StoragePort`. `Page` is a discriminated union over `type` (`notes | build-log | presets`). Projects use **soft-delete** (Trash → permanent removal).
- **`packages/ui`** — the design system: shadcn/ui components on Tailwind v4, themed with saboteur-styles brand tokens.
- **`apps/app`** — the React UI, organized by feature folder (`projects/`, `pages/`, `search/`, `onboarding/`), each with components, a hook wrapping a repository, and a `repository.ts` exporting a singleton repo wired to `WebStorageAdapter`. Search is a header-mounted overlay reachable from any route, matching across all projects and pages. On first launch, `onboarding/` seeds a prefilled example project (one page of each type) before the project list first renders.

For deeper guidance on where to add things and the invariants to preserve, see [`CLAUDE.md`](CLAUDE.md).

---

Otocho is a [SAB/works](https://saboteur.works) product.
