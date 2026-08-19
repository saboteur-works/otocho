# Feature Breakdown: Otocho MVP

**Parent spec:** `docs/spec.md` (Otocho MVP, FR-1..FR-20)
**Status:** Draft (Features 1–2 delivered; Features 3–6 not yet started)

**Note on tree layout:** This document and its sibling task lists live under
`specs/` even though the rest of this repo's spec ladder (the parent product
spec and the two shipped feature specs referenced below) lives under `docs/`.
That split is intentional for this run only: the `saboteur-ship` pipeline's
plan gate only exempts writes under `specs/*`, so this run's new planning
artifacts were placed there to clear the gate. The parent spec and the
already-shipped Projects/Pages feature specs were not moved and are not
being edited — they remain at `docs/spec.md`,
`docs/features/projects/spec.md`, and `docs/features/pages/spec.md`.

## Overview

This breakdown slices the Otocho MVP spec into independently shippable vertical
features. Two features — Projects and Pages — have already shipped and are
recorded here as delivered so the breakdown reflects reality rather than
re-proposing finished work. The remaining MVP surface (search, Dropbox BYOS
sync, onboarding's example project, and the desktop/mobile clients) is broken
into four further features.

### Feature 1: Projects

**Value:** A producer can create, list, reopen, rename, and safely delete
projects, giving them one durable home per track before any pages exist.
**Vertical slice:** data (project record + soft-delete/trash state), logic
(`packages/core/project.ts` + `ProjectRepository`), interface (project list,
create/rename/delete UI, `HashRouter` routing).
**Requirements covered:** FR-1, FR-14, FR-17
**User stories:** US-1
**Depends on:** none
**Branch suggestion:** feat/projects
**Notes:** Delivered 2026-05-25. Full spec at `docs/features/projects/spec.md`,
tasks at `docs/features/projects/tasks.md` (6/6 done). FR-14 (persistence
independent of any DAW file) and FR-17 (manual entry only, no DAW
read/parse/import) are standing product constraints rather than discrete
deliverables; both are already satisfied by this feature's local-first,
manual-entry design and are assigned here as the foundational feature rather
than to a later one, since nothing downstream changes that story.

### Feature 2: Pages

**Value:** A producer can add purpose-built Notes, Build log, and Presets
pages to a project and capture content in the shape suited to each, fast
enough to do mid-session.
**Vertical slice:** data (`Page` discriminated union, one record per page via
`StoragePort`), logic (`packages/core/page.ts` + `PageRepository`, sort/reorder
transforms), interface (page list with add/rename/reorder/delete, three page
editors: Notes autosave, Build log sketch + append-only move feed, Presets
device chain + key-value params).
**Requirements covered:** FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10
**User stories:** US-2, US-3, US-4, US-5, US-9
**Depends on:** 1
**Branch suggestion:** feat/pages
**Notes:** Delivered 2026-05-29. Full spec at `docs/features/pages/spec.md`,
tasks at `docs/features/pages/tasks.md` (9/9 done), with four locked design
docs under `docs/features/pages/design/`. This feature already establishes the
file-per-page storage shape that FR-12 (sync conflict scoping) depends on.

### Feature 3: Search

**Value:** A producer can search across all their projects and pages and jump
straight to a past setting, move, or note instead of hunting page by page.
**Vertical slice:** data (a search index or query layer over existing project
and page records), logic (query/matching across Notes text, Build log
entries, and preset field names/values), interface (search entry point,
results list, open-on-select).
**Requirements covered:** FR-15, FR-16
**User stories:** US-8
**Depends on:** 2
**Branch suggestion:** feat/search
**Notes:** Reads existing Projects/Pages data only; adds no new persisted
entity beyond whatever index it builds. Does not depend on Dropbox sync —
search operates over whatever data is present locally, synced or not. Search
is the current pipeline run's feature and indexes flat full-text with
match-role labels — see Decisions #1 and #2. Build note: `PageRepository`
currently exposes only `list(projectId)`
(`packages/core/page-repository.ts:55-58`) and has no cross-project "all
pages" method, whereas `ProjectRepository.list()` already returns all
projects (`packages/core/project-repository.ts:48-49`). Search will need a
`PageRepository.listAll()` following that same pattern — a small addition at
the existing seam, requiring no `StoragePort` change, but an explicit piece
of work rather than a free one; the task breakdown for this feature should
include it.

### Feature 4: Dropbox BYOS sync & conflict surfacing

**Value:** A producer's projects and pages stay available and up to date
across their desktop, web, and mobile clients without Otocho running any
first-party backend, and they never silently lose an edit when two clients
touch the same page.
**Vertical slice:** data (a Dropbox-backed `StoragePort` adapter alongside the
existing local one, plus migration of local data into it on connect), logic
(push/pull sync, append-union merge of the Build log move feed, same-page
conflict detection), interface (connect/disconnect Dropbox flow, "not synced"
warning state, in-app conflict-resolution surface presenting both preserved
versions).
**Requirements covered:** FR-11, FR-12, FR-19, FR-20
**User stories:** US-6, US-7, US-11
**Depends on:** 2
**Branch suggestion:** feat/dropbox-sync
**Notes:** Builds on the file-per-page storage shape Pages already
established (FR-12's scoping requirement is structurally satisfied; this
feature adds the sync engine and conflict UI on top of it). Local-first
operation (FR-19, FR-20) is already true today because there is no sync yet;
this feature must preserve that guarantee — never regress to requiring
Dropbox — while adding the connect/migrate/disconnect/failure-handling
lifecycle around it.

### Feature 5: Onboarding example project

**Value:** A first-time producer understands what Otocho is for and how to
use it within seconds of opening the app, via a prefilled, explorable,
searchable example project, and has a clear path to start their own.
**Vertical slice:** data (a seeded example project + pages of all three
types, illustrating the durable-memory hook), logic (first-launch detection,
seed-on-first-run), interface (example project presentation + a prominent
"create your first project" action).
**Requirements covered:** FR-18
**User stories:** US-10
**Depends on:** 2, 3
**Branch suggestion:** feat/onboarding-example
**Notes:** Depends on Pages (2) for the three page types the example must
demonstrate, and on Search (3) because FR-18 requires the example project be
searchable, not just browsable. Search ships before this feature (Decision
#1), so this dependency is satisfied by build order rather than needing a
stub — see Decision #4.

### Feature 6: Desktop & mobile clients

**Value:** A producer can use Otocho on desktop and mobile, not just the web,
with mobile supporting full read/search plus light capture (Notes, Build log
moves, quick project/note creation) even though structured preset-chain
authoring stays desktop-only.
**Vertical slice:** data/logic (platform `StoragePort` adapters — Node fs for
desktop, Capacitor Filesystem for mobile — replacing today's README-only
stubs at `apps/desktop` and `apps/mobile`), interface (Electron shell around
the existing `apps/app` react-dom codebase; Capacitor shell with the reduced
mobile authoring surface per FR-13).
**Requirements covered:** FR-13
**User stories:** US-6, US-8
**Depends on:** 2, 3
**Branch suggestion:** feat/desktop-mobile-clients
**Notes:** Depends on Search (3) because FR-13 requires the mobile client to
support "viewing and searching all content." Ships the same `apps/app`
codebase inside thin native shells per the project's single-codebase
architecture (`CLAUDE.md`); no new domain logic beyond the storage adapters.
This feature does not hard-depend on Dropbox sync (4) — each platform is
independently usable against local storage — but the cross-device value
proposition (US-6, US-7) is materially weaker until sync ships too; whether
this feature must ship together with sync for real value is deferred to
Feature 6's own pipeline run (Decision #5) rather than decided here.

## Coverage check

- Requirements covered:
  - FR-1 → Feature 1
  - FR-2 → Feature 2
  - FR-3 → Feature 2
  - FR-4 → Feature 2
  - FR-5 → Feature 2
  - FR-6 → Feature 2
  - FR-7 → Feature 2
  - FR-8 → Feature 2
  - FR-9 → Feature 2
  - FR-10 → Feature 2
  - FR-11 → Feature 4
  - FR-12 → Feature 4
  - FR-13 → Feature 6
  - FR-14 → Feature 1
  - FR-15 → Feature 3
  - FR-16 → Feature 3
  - FR-17 → Feature 1
  - FR-18 → Feature 5
  - FR-19 → Feature 4
  - FR-20 → Feature 4
- Unassigned requirements: none

## Summary

- Total features: 6
- Suggested build order: 1 → 2 (both delivered), then 3 (Search ships first
  per Decision #1; Feature 4 has no hard dependency on it and can follow),
  then 5 (needs 2 and 3), then 6 (needs 2 and 3; benefits from 4 shipping
  alongside or before it for full cross-device value, per Decision #5).
- Independently shippable: 1, 2, 3, 4
- Risks: Feature 4 (Dropbox sync) is the highest-risk slice — it introduces
  the only new persistence adapter with real conflict semantics (append-union
  merge, in-app conflict surfacing, migrate-on-connect) and touches every
  other feature's data indirectly by changing how it's stored. Feature 6
  (desktop/mobile) carries integration risk rather than design risk: it's
  mostly platform-adapter and packaging work around an already-built
  codebase, but its dependency on Search (3) and loose coupling to Sync (4)
  mean its true "done" bar (full cross-device value) lands later than its
  formal dependency graph implies. Feature 5 (onboarding example) is low risk
  in isolation but is sequence-sensitive: if Search (3) slips, the example
  project's "searchable" requirement (FR-18) either needs an interim stub or
  the feature needs to be resequenced after Search actually ships.

## Decisions

All five questions originally tracked below have been resolved by triage.

1. **Search before or after Dropbox sync?** Resolved: **Search first.**
   Settled by user direction; Search is the current pipeline run's feature.
   (Supersedes the prior open question on build order between Features 3 and
   4; see the updated Suggested build order in the Summary above.)

2. **How deep should Search (Feature 3) index preset data?** Resolved:
   **Flat full-text indexing with match-role labels.** Index every preset
   string (page title/track name, device names, device free-text settings,
   and param keys and values) into one searchable surface per page, but tag
   each indexed string with its role so search results can display which
   field matched (track / device name / settings / param key / param value).
   No field-scoped query syntax at MVP — defer that to v1 if usage shows the
   need. Rationale: satisfies FR-16's "field names and values" literally;
   the role tags are near-free because `params` is already a structured
   `{key, value}` array (`packages/core/src/page.ts:51-55`), so tagging
   happens at index-build time with no data-model change; and result
   labeling is required regardless, since an untagged hit gives the user no
   way to tell a device named "Reverb" from a settings note mentioning
   reverb.

3. **Should Feature 6 (desktop & mobile clients) be split into two
   features?** Resolved: **No, keep as one.** Both platforms share the same
   `StoragePort` adapter pattern, and no priority order between them is
   established anywhere in the repo. Can be split later during Feature 6's
   own pipeline run, when it gets a real spec and the priority is known.

4. **If Feature 5 (onboarding example project) needs to ship before Search
   (Feature 3) is ready, should FR-18's "searchable" requirement use a
   temporary filter?** Resolved: **Feature 5 waits for Search.** No
   temporary/throwaway filter. Largely moot now that Search ships first
   (Decision #1).

5. **Does Feature 6 (desktop & mobile) need to ship together with Feature 4
   (Dropbox sync) for real value?** Resolved: **Deferred to Feature 6's own
   pipeline run** as a release-sequencing decision. Explicitly not decided
   in the abstract here; recorded as deferred-with-owner rather than left
   open.

## Open Questions

None.
