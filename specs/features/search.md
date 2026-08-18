# Feature Spec: Search

**Parent spec:** `docs/spec.md` (Otocho MVP) — satisfies US-8, FR-15, FR-16
**Status:** Draft
**Depends on:** Feature 2 (Pages) — delivered

## Overview

A producer's context accumulates across many projects and pages, and re-finding a specific setting, move, or note by browsing page-by-page doesn't scale. This feature adds search across all of a user's projects and pages, so a producer can type a fragment of what they remember and jump straight to the matching page. Search reads existing Projects and Pages data only; it introduces no new persisted entity and does not depend on Dropbox sync — it operates over whatever data is present locally, synced or not.

## Goals

- A producer can search across all projects and pages from anywhere in the app.
- A search result shows enough context to recognize the hit before opening it, including which field matched.
- Selecting a result navigates directly into the matching page.
- Search covers every content field established by Pages: Notes body, Build log sketch and move text, and Presets track name, device names, device settings, and param keys/values.
- Search works entirely against local storage as it exists today, independent of sync.

## Non-goals

- Fuzzy matching, typo tolerance, or stemming — MVP search is substring/exact-term matching only.
- Ranking sophistication (relevance scoring, weighting by recency or field) — MVP orders results by a simple, deterministic rule (see FR-8).
- Field-scoped query syntax (e.g. `param:decay`) — deferred to v1; MVP is flat full-text with match-role labels only.
- Searching trashed/soft-deleted projects or their pages — search operates only over active (non-deleted) projects, matching how the project list itself already excludes them.
- Cross-device or server-side search — this feature is a local, in-app query layer; it has no relationship to Dropbox sync (Feature 4).
- Saved searches, search history, or search-result export.
- Matching on project name — a project's `name` is never an indexed field; it appears on a result only as context for the matching page (see D-1).
- Recent items or suggested content shown before a query is typed — the pre-query state is a static prompt only, with no list-rendering or data-fetch path (see D-3).
- Pagination, truncation, or a result-count cap — the full result list is always rendered at MVP (see D-4).

## User stories

- US-1: As a producer, I want to search across all projects and pages so that I can retrieve a past setting or idea fast. [Parent US-8]

## Functional requirements

1. FR-1: Users MUST be able to open a search entry point from anywhere in the app and enter a text query. Before a query is typed, the entry point MUST show only the static prompt `Type to search your projects and pages.` — no recent-items list, suggested content, or other data-fetch/render path (see D-3). [US-1] (Parent FR-15)
2. FR-2: Search MUST query across all active (non-deleted) projects and all of their pages, not a single project at a time. [US-1] (Parent FR-15)
3. FR-3: Search MUST match only against page content: Notes `body`; Build log `sketch` and each move's `text`; Presets `title` (track name), each device's `name` and `settings`, and each param's `key` and `value`. `Project.name` MUST NOT be indexed or matched — it is never a match target, only display context on a result (see D-1). [US-1] (Parent FR-16)
4. FR-4: Each matched field MUST be indexed with a role tag identifying which field it came from (`body`, `sketch`, `move`, `track-name`, `device-name`, `device-settings`, `param-key`, `param-value`), and a result MUST display that role alongside the match. [US-1] (Parent FR-16)
5. FR-5: A result MUST show enough surrounding context — the matched snippet, the page title, the match role, and the owning project name — for a user to recognize it without opening it. The project name is context only; it is never itself the field that produced the match (see D-1). When a query produces no matches, the search surface MUST show the line `No matches for "<query>".` in place of results (see D-2). [US-1]
6. FR-6: Selecting a result MUST navigate directly to the matching page, opened in its normal editor. [US-1] (Parent FR-15)
7. FR-7: Search MUST be case-insensitive substring matching; it MUST NOT require exact whole-field equality. [US-1] (Parent FR-16)
8. FR-8: When a query matches multiple results, results MUST be presented as a single flat list — not grouped by project, page, or match role — ordered by a stable, deterministic rule (implementation may use e.g. project recency then page order) rather than an unranked, randomized, or sectioned order. Every row in that flat list MUST show project name, page title, match role, and snippet per FR-5 (see D-4). Result rendering MUST NOT paginate, truncate, or cap the list at MVP (see D-5). [US-1]
9. FR-9: `PageRepository` MUST expose a `listAll()` method returning every page across every project, following the existing pattern of `ProjectRepository.list()`; this MUST be implemented via the existing `StoragePort` without any port interface change. [US-1] (Parent FR-15)
10. FR-10: Search index construction and query matching MUST be implemented as pure functions in `packages/core`, taking projects and pages as plain input and returning matches, with no direct I/O. [US-1]
11. FR-11: Search MUST NOT write to or otherwise mutate any project or page record; it is read-only over the existing persisted shape. [US-1]

## Decisions

- D-1 (resolves OQ-1) — Project names are not matchable. Search is scoped strictly to page content; the owning project name appears on a result only as context, never as the thing that produced the match. Rationale: FR-3 enumerates every match field and omits `Project.name`; FR-5 treats project name as context, distinct from the FR-3/FR-4 match fields; parent FR-15's "across all projects and pages" describes coverage scope, not a match target.
- D-2 (resolves OQ-2) — Empty and no-match states follow the app's shipped terse, muted idiom: one short line, `text-fg-tertiary`, no illustrations or icons — consistent with `"No projects yet."` (`apps/app/src/projects/ProjectList.tsx:11`), `"Trash is empty."` (`apps/app/src/projects/TrashView.tsx:39`), and `"No pages yet." / "Add a page to get started."` (`docs/features/pages/design/page-list.md`). Copy: pre-query state shows `Type to search your projects and pages.`; no-match state shows `No matches for "<query>".`. This copy is the spec'd default; treat it as a copy choice rather than load-bearing behavior.
- D-3 (resolves OQ-2b) — Nothing is shown before a query is typed: no recent-items list, no suggested content, no onboarding hook — just the pre-query prompt line from D-2. Rationale: matches the app's existing empty-state idiom; avoids a second data-fetch and list-rendering path that no FR requires; and explicitly does not couple Search to the unbuilt FR-18 onboarding example project (Feature 5), which already depends on Search in the other direction.
- D-4 (resolves OQ-3) — Results render as a single flat list ordered by the FR-8 rule (project recency, then page order), not grouped by project, page, or match role. Each row shows project name, page title, match role, and snippet per FR-5. Rationale: FR-8 is phrased as a sort rather than a grouping scheme; the app has no grouped-list component, and both `ProjectList.tsx` and `TrashView.tsx` render flat lists with no section headers.
- D-5 (resolves OQ-4) — No pagination, truncation, or result cap at MVP; the full result list is always rendered. Rationale: matching is a pure in-memory pass over data already loaded via `ProjectRepository.list()` and the new `PageRepository.listAll()`, so there is no IO cost to bound; realistic heavy usage lands in the low thousands of indexed fields and a hit still requires a substring match on the specific query; and nothing else shipped (`ProjectList`, `PageList`, `TrashView`) paginates, so capping search alone would introduce a new UI pattern with no product pressure behind it. This is a revisit-when-observed decision — reconsider it if real usage produces pathological result volumes.
- D-6 (resolves OQ-5) — Trashed/soft-deleted projects stay unsearchable; the existing non-goal stands, with no separate "search trash" mode at MVP. Rationale: `ProjectRepository.list()` already filters `isDeleted`, and `docs/features/projects/spec.md` defines Trash as its own separate recoverable view that is deliberately never folded into the main list; search reusing the active-only read is consistent with that. Nothing in `docs/spec.md` asks for searchable trash.

## Open questions

None identified.

## Out of scope (deferred)

- Field-scoped query syntax (`param:decay`) — v1.
- Fuzzy/typo-tolerant matching and relevance ranking — v1 or later, pending real usage data.
- Search across trashed projects — no committed milestone.
- Cross-device/server-assisted search — depends on Dropbox sync (Feature 4) landing first, and is not currently planned even then.
- Saved searches and search history.
