# Feature Spec: Dropbox BYOS sync & conflict surfacing

**Parent spec:** `docs/spec.md` (Otocho MVP) — satisfies US-6, US-7, US-11, FR-11, FR-12, FR-19, FR-20
**Status:** Draft
**Depends on:** Feature 2 (Pages) — delivered

## Overview

A producer's projects and pages today live only in whatever browser or
machine they were created on. This feature lets a producer connect their own
Dropbox account so the same notebook stays available and up to date across
desktop, web, and mobile clients, with Otocho running no first-party backend
(BYOS). The app remains fully usable local-first before, during, and after
this connection, and when two clients edit the same page while
disconnected from each other, the system never silently drops either edit —
it preserves both and surfaces the conflict for the user to reconcile.

## Goals

- A producer's projects and pages sync across every client signed into the
  same Dropbox account, with no Otocho-hosted server involved.
- The app is fully usable storing data locally before Dropbox is ever
  connected, and stays usable if sync later becomes unavailable.
- Connecting Dropbox migrates existing local data in, with nothing left
  behind or silently dropped.
- A same-page concurrent edit is never silently lost — both versions are
  preserved and surfaced in-app for the user to reconcile.
- Sync failure, disconnection, or an out-of-space Dropbox account degrades to
  local-only operation with a visible warning, not a blocked or broken app.

## Non-goals

- Real-time collaborative/multiplayer editing of the same page.
- Any BYOS provider other than Dropbox at MVP (Google Drive, iCloud, OneDrive
  are post-MVP).
- A CRDT or field-level automatic merge for the Build log sketch text —
  MVP conflict handling is preserve-both plus append-union for the move feed
  only.
- Running any first-party sync or storage backend.
- Sharing or exporting synced data to other users or accounts.
- An encryption layer beyond what Dropbox itself provides.

## User stories

- US-1: As a producer, I want to sync my notebook across desktop, web, and
  mobile so that my context is available wherever I work. [Parent US-6]
- US-2: As a producer, I want to have my records persist independently of
  the DAW file so that I don't lose them when a project is lost or
  corrupted. [Parent US-7]
- US-3: As a producer, I want to start using Otocho immediately and connect
  my own cloud storage when I'm ready, so that there's no signup wall and my
  data stays mine. [Parent US-11]

## Functional requirements

1. FR-1: Users MUST be able to use the app fully with local-only storage
   before ever connecting a cloud account. [US-3] (Parent FR-19)
2. FR-2: Users MUST be able to initiate a Dropbox connection via OAuth PKCE
   from within the app at any point after first launch. [US-3] (Parent
   FR-11)
3. FR-3: The OAuth PKCE redirect mechanism MUST be injected per platform
   rather than hardcoded to a loopback-localhost redirect, so web, desktop,
   and mobile builds can each supply their own redirect handling (e.g. a
   hosted redirect URI, or a registered custom scheme/universal link) behind
   one shared connect-flow seam. [US-3] (Parent FR-11; design guardrail from
   `docs/spec.md` OQ-3)
4. FR-4: On successful connection, the app MUST migrate all existing local
   projects and pages into the connected Dropbox storage without requiring
   the user to re-enter or recreate any content. [US-2][US-3] (Parent FR-19)
5. FR-5: Migration MUST NOT delete or discard local data unless the migrated
   copy is confirmed written to Dropbox. [US-2] (Parent FR-19, FR-20)
6. FR-6: Once connected, each page MUST be stored as its own file/record in
   Dropbox (one file per page), so a sync conflict on one page never affects
   another page's data. [US-1][US-2] (Parent FR-12)
7. FR-7: A connected client MUST push local changes to Dropbox and pull
   remote changes from Dropbox, keeping projects and pages up to date across
   every client connected to the same Dropbox account. [US-1] (Parent FR-11)
8. FR-8: The Build log move feed MUST sync via append-union merge: when two
   clients each append moves independently, both sets of entries MUST be
   present after sync, with no move dropped and no duplicate created for the
   same move. [US-1][US-2] (Parent FR-12)
9. FR-9: When two clients edit the same page concurrently (outside the move
   feed) and both changes reach Dropbox, the system MUST detect the conflict
   rather than silently applying last-write-wins. [US-1][US-2] (Parent
   FR-12)
10. FR-10: On a detected same-page conflict, the system MUST preserve both
    conflicting versions and MUST NOT silently discard either edit.
    [US-1][US-2] (Parent FR-12)
11. FR-11: The app MUST present an in-app surface that shows both preserved
    versions of a conflicted page and lets the user reconcile them.
    [US-1][US-2] (Parent FR-12)
12. FR-12: If Dropbox is disconnected, authentication fails, or the account
    is out of space, the app MUST continue to function against local data
    with no loss of the ability to read or write projects and pages.
    [US-2][US-3] (Parent FR-20)
13. FR-13: While sync is unavailable per FR-12, the app MUST display a
    visible warning that changes are not being synced/backed up. [US-3]
    (Parent FR-20)
14. FR-14: While sync is unavailable per FR-12, the app MUST NOT lose or
    silently drop any locally made change, and MUST retry syncing once
    connectivity, authentication, or available space is restored, where
    retry is possible. [US-2][US-3] (Parent FR-20)
15. FR-15: Users MUST be able to disconnect Dropbox from within the app,
    after which the app MUST continue operating on local data per
    FR-12/FR-13. [US-3] (Parent FR-20)
16. FR-16: `Page` MUST support soft-delete via a `deletedAt` tombstone,
    mirroring `Project`'s existing soft-delete pattern
    (`packages/core/src/project.ts`), replacing today's hard delete
    (`PageRepository.delete()` → `storage.remove()`,
    `packages/core/src/page-repository.ts`). A page edited on one client
    while deleted on another MUST be detected as a conflict under FR-9/FR-10
    and routed through the same preserve-both resolution surface as FR-11,
    rather than silently applying delete-wins or edit-wins. [US-1][US-2]
    (see D-2; Parent FR-12)

## Decisions

- D-1 (resolves OQ-1) — The in-app conflict-resolution surface (FR-11) is a
  side-by-side diff with a pick-one-version-per-page action: both full
  preserved versions of a conflicted page are shown, each with its own "keep
  this one" action. Rationale: simplest to build and matches FR-11's
  "preserve both, let the user reconcile" literally. Rejected alternatives:
  per-field/per-section merge (too complex, edges toward the spec's
  no-automatic-field-level-merge non-goal); pick-one-and-stash-elsewhere
  (weaker reconciliation UX than showing both versions inline). Impact:
  FR-11.
- D-2 (resolves OQ-2) — A page edited on one client while deleted on another
  is a real conflict, not resolved by either delete-wins or edit-wins (both
  would violate FR-10's "MUST NOT silently discard either edit"). This
  requires a data-model change: `Page` moves from hard-delete to soft-delete
  via a `deletedAt` tombstone, mirroring `Project`'s existing pattern in
  `packages/core/src/project.ts`, replacing `PageRepository.delete()`'s
  current `storage.remove()` call in `packages/core/src/page-repository.ts`.
  With the tombstone in place, a delete-vs-edit conflict is representable
  and routed through the same preserve-both surface as D-1/FR-11. Recorded
  as new FR-16 above, since it is a requirement addition, not just a UX
  choice. Impact: FR-6 (storage-shape context), FR-9, FR-10, FR-11, FR-16
  (new).
- D-3 (resolves OQ-3) — Migration (FR-4) partial failure gets no
  special-cased path: a partial migration is an ordinary partial sync state,
  resumed by the same per-page sync/retry mechanism used post-migration (see
  D-5), and covered by the existing FR-13 "not synced" warning. No distinct
  migration-progress UI or rollback logic. Rationale: migrated pages are
  already individual Dropbox files per FR-6, so a partial migration is
  structurally identical to a partial sync — introducing a second failure
  path would duplicate FR-13/FR-14 machinery for no behavioral gain. Impact:
  FR-4, FR-5, FR-13.
- D-4 (resolves OQ-4) — Confirmed: local storage is the continuous source of
  truth before, during, and after Dropbox connection; there is no separate
  pre-connection snapshot to revert to. On disconnect (FR-15), the current
  local dataset — which is the last-synced state, since local was always the
  live copy — is simply what continues to be used. This confirms the
  existing architectural reading rather than adding a new requirement.
  Impact: FR-15, FR-12.
- D-5 (resolves OQ-5, OQ-6) — Sync cadence: debounced push a few seconds
  after the last local edit, consistent with the existing serialized-write
  pattern in `PageRepository.mutate`, plus periodic background pull while
  connected. Retry policy: automatic exponential backoff on sync failure,
  plus a user-visible manual "retry sync now" action surfaced alongside the
  FR-13 warning banner. Impact: FR-7, FR-14.
- D-6 (resolves OQ-7) — A two-tier warning: a generic "not synced" banner is
  always shown per FR-13's existing minimum, with an expandable "why" detail
  that names the specific cause (disconnected / auth failure / out of space)
  when available from the Dropbox API's error response. Not fully
  differentiated at the top level, but not fully opaque either. Impact:
  FR-13.

## Open questions

None.

## Out of scope (deferred)

- CRDT or other automatic field-level merge for the Build log sketch text —
  a post-MVP upgrade per `docs/spec.md`'s constraints, if conflicts prove
  painful.
- Additional BYOS providers beyond Dropbox (Google Drive, iCloud, OneDrive).
- Real-time collaborative/multiplayer editing.
- AI-assisted or automatic conflict resolution.
- A first-party managed storage option (would contradict the no-backend
  constraint; a deliberate later pivot only, per `docs/spec.md` OQ-3).
- An offline-change queue UI beyond the FR-13 warning state.
