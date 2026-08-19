# Feature Spec: Onboarding example project

**Parent spec:** `docs/spec.md` (Otocho MVP) — satisfies US-10, FR-18
**Status:** Draft
**Depends on:** Feature 2 (Pages) — delivered; Feature 3 (Search) — delivered

## Overview

A first-time producer who opens Otocho today sees an empty projects list
(`"No projects yet."`) and a bare create-project form — nothing demonstrates
what the three page types are for or why the notebook is worth filling in.
This feature seeds a single, prefilled, fully explorable example project on
first launch, with one page of each MVP type (Notes, Build log, Presets)
whose content dramatizes the product's core promise — durable project memory
that survives a lost or corrupted DAW file — so a producer understands the
value within seconds, without creating anything themselves first. The example
project is ordinary data: it is seeded through the same repositories as any
user project, is fully editable and deletable, and is reachable through the
already-shipped Search feature like any other project.

## Goals

- A first-time user sees a prefilled, three-page example project the moment
  they open Otocho, with no setup required.
- The example content makes the durable-memory hook concrete: a producer can
  see, in the example's own words, how Notes/Build log/Presets content
  outlives a lost or corrupted DAW file.
- The example project is fully explorable and searchable using existing
  Pages and Search functionality — no special-cased UI.
- A prominent, low-friction path to create the user's own first project is
  present alongside the example.
- The example seeds exactly once per install; deleting it (including via
  Trash) never brings it back.

## Non-goals

- A guided tour, tooltip walkthrough, or product-tour overlay — the example
  project itself is the onboarding mechanism, not a scripted UI tutorial.
- Per-page-type sample galleries or multiple example projects — exactly one
  example project, one page of each type, at MVP.
- Re-seeding or repairing the example project if the user edits or deletes
  only some of its pages (partial edits are treated as ordinary user edits
  to their own data, not onboarding state to protect).
- A visible "reset onboarding" / re-seed action in the product UI.
- Any change to Search, Pages, or Projects behavior — this feature only adds
  seed data and a first-launch check on top of existing repositories.
- Changing the existing empty-Trash or empty-list copy for states unrelated
  to first launch.

## User stories

- US-1: As a producer, I want to see what Otocho is for the moment I open
  it, so that I understand the value without having to build anything
  first. [Parent US-10]

## Functional requirements

1. FR-1: On an install where no seed marker exists (see FR-2), the app MUST
   create exactly one example project containing exactly one Notes page, one
   Build log page, and one Presets page, before the user can interact with
   an empty `ProjectsHome`. [US-1] (Parent FR-18)
2. FR-2: First-launch state MUST be recorded as a persisted marker record,
   separate from `Project`/`Page` records, written through the existing
   `StoragePort` (collection `app-meta`, a single record `{ id:
   "onboarding-seed", seededAt: string, exampleProjectId: string }`) — see
   D-1. Presence of this record, not the presence or absence of the example
   project itself, is what "seeded" means. [US-1]
3. FR-3: On any launch where the seed marker already exists, the app MUST
   NOT create another example project, regardless of whether the previously
   seeded example project still exists, was edited, was soft-deleted to
   Trash, or was permanently purged from Trash. [US-1] (Parent FR-18)
4. FR-4: The seed check MUST be idempotent under concurrent/duplicate
   invocation (e.g. two mounts racing on first load): at most one example
   project and one marker record MUST ever be written for a given install.
   [US-1]
5. FR-5: The example project and its three pages MUST be created through
   `ProjectRepository.create` and `PageRepository.create`/`mutate` (never
   direct `StoragePort` writes), using each repository's injected
   `now`/`generateId` (or the core factories' `{ id?, now? }` options bag)
   so seeding is deterministic and covered by tests with fixed ids/clocks.
   [US-1]
6. FR-6: The example project's Notes page body, Build log sketch, at least
   one Build log move, and at least one Presets device (with a name and at
   least one param key/value) MUST all be non-empty, realistic content for a
   music producer, and MUST together dramatize the durable-memory hook —
   content whose framing makes clear this record outlived (or would outlive)
   the original DAW project file. Exact copy is a copy choice (see D-2), not
   load-bearing behavior. [US-1] (Parent FR-18)
7. FR-7: Because the example project and pages are created via the same
   repositories as any user content (FR-5), they MUST be indexed by
   `buildSearchIndex` and returned by `searchIndex` like any other active
   project's pages, with no Search-specific integration work required
   beyond seeding running before the user's first search. [US-1] (Parent
   FR-18's "searchable")
8. FR-8: The example project MUST NOT be read-only, locked, or otherwise
   restricted — it MUST support rename, page add/reorder/delete, and project
   soft-delete/restore/purge identically to a user-created project. [US-1]
9. FR-9: `ProjectsHome` MUST present a "create your first project" action
   (the existing inline `CreateProject` form) whenever the app is rendered,
   independent of whether the example project exists, has been edited, or
   has been deleted — so the action is not itself onboarding state that can
   be lost. [US-1] (Parent FR-18)
10. FR-10: The seed check MUST run once, before `ProjectsHome`'s initial
    project list is read, and MUST NOT block the app shell (header, routing)
    from rendering while it completes. [US-1] Confirmed at triage (resolving
    OQ-2 part A): this requirement already settles the block-vs-background
    question as written and needed no change — the seed check completes
    before `ProjectsHome`'s initial project list read, but does not block the
    app shell itself from rendering. See D-6.
11. FR-11: The example project MUST render as an ordinary row in
    `ProjectList`, with no badge, label, variant, or other visual distinction
    from a user-created project. [US-1] (Parent FR-18; see D-5)

## Decisions

- D-1 — Marker storage: a new `app-meta` collection via the existing
  `StoragePort`, holding a single record `{ id: "onboarding-seed", seededAt,
  exampleProjectId }`. Rationale: `StoragePort` is already a generic
  collection-keyed store (`list/get/put/remove` over `{ id }` records, per
  `packages/storage/src/port.ts`); Search's FR-9 set the precedent of adding
  a capability at the existing repository/port seam rather than changing the
  port interface, and a marker record follows that same pattern with no port
  change. The record's presence (not the example project's) is authoritative
  for "already seeded" so a later deletion of the example project can never
  be mistaken for "never seeded" (FR-3).
- D-2 — Seed content shape: one example project (working name "Midnight
  Drive — example"), with a Notes page noting the DAW project file was lost
  in a laptop swap and this notebook is the only surviving record of the
  session; a Build log page whose sketch describes the arrangement idea and
  whose move feed has 2-3 timestamped entries (e.g. "Sidechained the pad to
  the kick", "Swapped the lead synth patch for something brighter") that
  read as reconstructable steps; and a Presets page scoped to a "Lead synth"
  track with one device (e.g. "Serum") carrying free-text settings and 1-2
  key/value params (e.g. `cutoff` / `62%`). This is a copy/content default
  (FR-6), not load-bearing — implementers may adjust wording as long as the
  durable-memory framing and non-empty-field requirements hold.
- D-3 — CTA placement: no new "create your first project" UI element is
  introduced. `ProjectsHome` already renders the `CreateProject` inline form
  unconditionally above the project list (`apps/app/src/projects/
  ProjectsHome.tsx`); FR-9 keeps that as the CTA rather than adding a
  first-launch-only banner, so the action's presence doesn't depend on
  onboarding state that could get out of sync.
- D-4 — Deletion never resurrects: satisfied structurally by D-1/FR-2/FR-3 —
  the marker, not the project's existence, gates seeding, so soft-delete,
  restore, or permanent purge of the example project (via the existing
  Projects Trash flow) has no effect on whether seeding runs again.
- D-5 — No visual distinction (resolves OQ-1): the example project renders as
  an ordinary row in `ProjectList`, with no badge, label, or variant marking
  it as an example. Rationale: the Goals' "no special-cased UI" and FR-8's
  "identical to a user-created project" already require this; `ProjectList.tsx`
  has no per-row variant affordance today, and adding one would be new UI
  surface the Non-goals discourage. Formalized as FR-11.
- D-6 — Seed check placement (resolves OQ-2): a dedicated `useOnboardingSeed`
  hook, following the app's established one-hook-per-concern pattern
  (`useProjects`, `usePages`, `useTrash`, `useSearch`). It wraps its own
  repository/marker access, accepts an optional injected repo so tests can
  pass one backed by `MemoryStorage`, and is invoked from `ProjectsHome` (or
  a thin wrapper) ahead of/alongside `useProjects`'s first refresh.
  Explicitly NOT a global `App.tsx` effect, and NOT folded into `useProjects`
  (that would conflate the `app-meta` marker collection with the
  project-list concern). The hook name is the intended default, not a
  naming mandate — implementers may rename it as long as the placement
  pattern holds. The block-vs-background half of OQ-2 needed no change; see
  the triage note on FR-10.
- D-7 — No copy-review gate (resolves OQ-3): D-2's seed content stands as a
  directional default. Implementers may adjust wording provided the
  durable-memory framing and the FR-6 non-empty-field requirements hold; no
  separate producer-facing copy review is required before implementation.
- D-8 — Dev/QA seed reset (resolves OQ-4): a documented manual step and/or a
  small `pnpm` script that deletes the `app-meta` `onboarding-seed` marker
  record, so first-launch behavior can be re-exercised in a real browser.
  This must ship no code in the production bundle and must not add any
  user-facing UI. Rejected alternatives: (a) no reset affordance at all —
  too error-prone for exploratory QA; (c) a `?reset-onboarding` query param
  or an `import.meta.env.DEV`-gated in-app hook — both add a code path to
  the shipped product that would have to be proven dead in production
  builds, which the Non-goals' "no visible reset onboarding action" already
  discourages.

## Open questions

None — all resolved at triage.

## Out of scope (deferred)

- Scripted product-tour/tooltip walkthrough UI.
- Multiple example projects or per-page-type sample galleries.
- Auto-repair or re-seeding of a partially-edited example project.
- A user-facing "reset onboarding" action.
- Any onboarding content or flow tied to Dropbox sync (Feature 4) or
  desktop/mobile clients (Feature 6) — this feature is web/local-storage
  only, consistent with how Projects, Pages, and Search shipped.
