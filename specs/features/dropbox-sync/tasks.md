# Implementation Tasks: Dropbox BYOS sync & conflict surfacing

**Spec:** `specs/features/dropbox-sync.md`
**Granularity:** story points (1/2/3/5/8)

## Scaffold context (already in place)

Nothing Dropbox-specific exists yet. This feature is new work built on top of
the existing local-storage seam, which every task below reuses rather than
bypasses:

- `packages/storage/src/port.ts` — `StoragePort` (`list/get/put/remove` over
  `{ id }` records in a named collection). The only implementation today is
  `packages/storage/src/web-adapter.ts` (`WebStorageAdapter`, IndexedDB). Per
  D-4, **local storage stays the continuous source of truth** before, during,
  and after Dropbox connection — this feature does not replace
  `WebStorageAdapter` with a Dropbox adapter; it adds a second `StoragePort`
  implementation (`DropboxStorageAdapter`, Task 6) that a new sync engine
  (Task 7) reads from and writes to *alongside* the existing local adapter.
  This is the direct implication of D-4 plus the architecture note that
  `packages/storage` gains "a Dropbox-backed adapter" — not a swapped one.
- `packages/core/src/page.ts` / `page-repository.ts` — the `Page`
  discriminated union and `PageRepository`, both used unmodified as the
  read/write path the sync engine drives from. `PageRepository.delete()`
  currently calls `storage.remove()` (hard delete) — Task 1 changes this
  first, since FR-9/FR-10/FR-11 conflict handling and FR-16 both depend on a
  `deletedAt` tombstone existing before delete-vs-edit conflicts are
  representable at all.
- `packages/core/src/project.ts` — `Project.deletedAt: string | null` plus
  `isDeleted()`/`byRecency()` is the exact soft-delete shape Task 1 mirrors
  onto `Page`.
- `packages/core/src/onboarding-repository.ts` / `onboarding-seed.ts` — the
  established pattern for a one-off, app-wide marker record on the
  `"app-meta"` collection (small `{ id, ... }` type + factory in `core`, a
  thin repository over the existing generic `StoragePort`, no port interface
  change) and for orchestration built on top of repositories rather than
  touching `StoragePort` directly (`onboarding-seed.ts`'s
  `seedOnboardingExample`/`ensureOnboardingSeeded`). Dropbox connection state
  (Task 4) and the sync engine (Task 7) both follow this shape: entity +
  repository in `core`, orchestration layered on top, no new `StoragePort`
  method.
- `apps/app/src/projects/repository.ts`, `apps/app/src/pages/repository.ts`,
  `apps/app/src/search/repository.ts`, `apps/app/src/onboarding/repository.ts`
  — the singleton-repo-per-feature-folder pattern
  (`export const xRepo = new XRepository({ storage: new WebStorageAdapter() })`).
  A new `apps/app/src/dropbox/` feature folder follows the same shape for
  connection state and sync wiring.
- `apps/app/src/testing/memory-storage.ts` — `MemoryStorage`, the in-memory
  `StoragePort` every repository/hook test in the codebase uses instead of a
  real backend. Every new repository/sync test below is written against it
  (for the local side) plus a fake `StoragePort`-shaped Dropbox double (for
  the remote side) — no test in this feature list talks to the real Dropbox
  API.
- Test infra: Vitest, `node` environment by default, jsdom opt-in via
  `// @vitest-environment jsdom`. Every task below must keep the existing
  suite green.

**Cross-cutting decisions (settle once, in the task noted; not separate
tasks):**

- **Local is always primary (D-4).** No task in this list makes the app read
  or write through `DropboxStorageAdapter` directly from UI code. All
  application code keeps talking to the existing `ProjectRepository`/
  `PageRepository` instances backed by `WebStorageAdapter`; the sync engine
  (Task 7) is the only thing that also talks to `DropboxStorageAdapter`, in
  the background. This is what makes FR-1/FR-12 ("fully usable on local data
  regardless of Dropbox state") true by construction rather than by a
  separate fallback path.
- **Migration has no bespoke path (D-3).** Task 9 (migration) is explicitly
  "run the ordinary sync push once, on connect" — do not build a distinct
  migration-progress UI, rollback logic, or partial-failure surface. A
  stalled migration is just an ordinary "not fully synced" state covered by
  Task 8's warning banner.
- **Conflict data model (D-1/D-2).** A conflict is represented by preserving
  both versions of a page (Task 11), never by an automatic merge, with one
  exception: the Build log move feed (FR-8, Task 14), which merges by
  append-union instead of ever conflicting. Task 13 (delete-vs-edit) reuses
  Task 11/12's preserve-both machinery rather than inventing a separate
  delete-conflict shape.
- **OAuth redirect is a seam, not a hardcoded localhost callback (FR-3).**
  Task 2 defines the interface; Task 3 supplies the web implementation.
  Desktop/mobile implementations of the same seam are out of scope for this
  task list (no desktop/mobile shell code exists yet per `apps/desktop` and
  `apps/mobile` both being stubs) but the seam must not assume a browser
  redirect is the only possible mechanism.

### Task 1: `Page` soft-delete via `deletedAt` tombstone

**What:** Replace `PageRepository`'s hard delete with a `Project`-style
`deletedAt` tombstone, so a page can later be represented as "deleted" for
conflict purposes (FR-16).
**Files:** `packages/core/src/page.ts`, `packages/core/src/page-repository.ts`,
`packages/core/src/page.test.ts`, `packages/core/src/page-repository.test.ts`,
`apps/app/src/pages/usePages.ts`, `apps/app/src/pages/usePages.test.ts` (or
equivalent).
**Done when:** `Page`'s shared base gains `deletedAt: string | null` (mirroring
`Project.deletedAt`), set to `null` by every `create*Page` factory; an
`isDeleted(page)` helper is added to `page.ts` mirroring `project.ts`'s;
`PageRepository` gains `softDelete(id): Promise<Page>` that sets
`deletedAt`/`updatedAt` via the existing `mutate`/serialized-write path rather
than `storage.remove`; `PageRepository.list()`/`listAll()` filter out
soft-deleted pages by default, matching `ProjectRepository.list()`'s
`isDeleted` filter; `PageRepository.delete()` (hard delete via
`storage.remove`) is removed, and `usePages.ts`'s `deletePage` now calls
`softDelete`; tests cover: `softDelete` sets the tombstone without removing
the underlying record, `list()`/`listAll()` exclude soft-deleted pages, and
the existing hard-delete test is updated to assert soft-delete behavior
instead.
**Depends on:** none
**Estimate:** 3
**Notes:** This task does not add page restore/trash UI — the spec's only
requirement is that the tombstone exists so FR-9/FR-10/FR-11 can represent a
delete-vs-edit conflict (Task 13). Restore/permanent-purge UI for pages is out
of scope here (the spec only extends this to conflict handling, not a page
Trash view).
**Done:** [ ]

### Task 2: `DropboxAuthPort` seam + PKCE helpers

**What:** The platform-injected OAuth PKCE seam (FR-3) plus the
platform-agnostic PKCE mechanics (code verifier/challenge generation, token
exchange request shape) that every platform implementation shares.
**Files:** `packages/storage/src/dropbox-auth-port.ts` (new),
`packages/storage/src/dropbox-pkce.ts` (new), corresponding `.test.ts` files,
`packages/storage/src/index.ts` (export).
**Done when:** a `DropboxAuthPort` interface is defined with an
`authorize(): Promise<DropboxTokens>` method (`DropboxTokens` = access token,
refresh token, expiry) that platform implementations satisfy by supplying
their own redirect handling (hosted redirect URI for web, registered
scheme/universal link for desktop/mobile) — the interface itself contains no
assumption of a browser or a loopback-localhost redirect; pure PKCE helpers
(`generateCodeVerifier()`, `deriveCodeChallenge(verifier)`) are implemented
and unit-tested against the PKCE spec's expected transform (S256); no network
call is made from this task — it defines the seam and shared math only.
**Depends on:** none
**Estimate:** 3
**Done:** [ ]

### Task 3: Web platform OAuth redirect + connect flow

**What:** The web build's `DropboxAuthPort` implementation: opens Dropbox's
OAuth authorize URL, captures the redirect callback, and exchanges the code
for tokens (FR-2, FR-3).
**Files:** `apps/app/src/dropbox/web-dropbox-auth.ts` (new), corresponding
test.
**Done when:** a `WebDropboxAuth implements DropboxAuthPort` drives the full
PKCE authorize round trip for the web build specifically (constructing the
authorize URL with the Task 2 challenge, handling the redirect back into the
app, exchanging the code for tokens via Dropbox's token endpoint); the
redirect target is a value supplied to `WebDropboxAuth`, not hardcoded inline,
so it can differ between local dev and a deployed build; tests cover PKCE
parameter construction and the token-exchange request shape against a mocked
`fetch`, not a live Dropbox call.
**Depends on:** 2
**Estimate:** 3
**Done:** [ ]

### Task 4: Dropbox connection state entity + repository

**What:** A pure `DropboxConnection` marker type and repository persisting
connection state (tokens, connected account id) on the existing `"app-meta"`
collection, following the onboarding-marker pattern.
**Files:** `packages/core/src/dropbox-connection.ts` (new),
`packages/core/src/dropbox-connection-repository.ts` (new), corresponding
`.test.ts`, `packages/core/src/index.ts` (export).
**Done when:** `dropbox-connection.ts` exports a `DropboxConnection` type
(`{ id: "dropbox-connection"; connectedAt: string; accountId: string; tokens: DropboxTokens }`)
and a `createDropboxConnection` factory; `DropboxConnectionRepository`
(constructed with `{ storage: StoragePort, now? }`, mirroring
`OnboardingRepository`) exposes `get(): Promise<DropboxConnection | null>`,
`save(connection): Promise<DropboxConnection>`, and `clear(): Promise<void>`,
all routed through the existing generic `storage.get`/`put`/`remove` on
`"app-meta"` with no port interface change; tests cover a fresh store
returning `null`, `save` round-tripping the exact shape, and `clear` removing
it.
**Depends on:** 2
**Estimate:** 2
**Notes:** Token storage here is plain-text in the local `StoragePort`
record, consistent with "no encryption layer beyond what Dropbox itself
provides" (spec Non-goals) — do not add bespoke encryption in this task.
**Done:** [ ]

### Task 5: Connect / disconnect UI

**What:** An in-app entry point to initiate connection (FR-2) and to
disconnect (FR-15), wired to Tasks 3 and 4.
**Files:** `apps/app/src/dropbox/repository.ts` (new — singleton
`DropboxConnectionRepository` wired to `WebStorageAdapter`),
`apps/app/src/dropbox/useDropboxConnection.ts` (new),
`apps/app/src/dropbox/ConnectDropbox.tsx` (new), `apps/app/src/App.tsx`
(header/settings entry point), corresponding tests.
**Done when:** a control reachable from the app shell lets a user start the
Task 3 connect flow at any point after first launch, and — once connected —
disconnect, which calls `DropboxConnectionRepository.clear()`; the app is
fully readable/writable against local data both before any connection is
made and immediately after disconnecting, verified by a test that mounts the
app shell with no `DropboxConnection` record present and confirms ordinary
project/page CRUD via the existing `useProjects`/`usePages` hooks works
unaffected (FR-1, FR-15); disconnecting does not delete or alter any local
project/page data (D-4).
**Depends on:** 3, 4
**Estimate:** 3
**Done:** [ ]

### Task 6: `DropboxStorageAdapter` — file-per-record CRUD

**What:** A second `StoragePort` implementation backed by the Dropbox API,
storing one file per record under a collection-scoped path (FR-6).
**Files:** `packages/storage/src/dropbox-adapter.ts` (new), corresponding
test, `packages/storage/src/index.ts` (export).
**Done when:** `DropboxStorageAdapter implements StoragePort`, constructed
with an access-token supplier (from Task 4's stored tokens); `put(collection,
record)` writes `/otocho/<collection>/<id>.json` via Dropbox's upload
endpoint; `get`/`list`/`remove` read/list/delete the same path shape via
Dropbox's download/list-folder/delete endpoints; `list(collection)` lists only
that collection's folder, never scanning the whole app folder; a page (or
project) written by `put` and read back by `get` round-trips to the same
value; tests mock the Dropbox HTTP surface (no live network call) and cover
put/get/list/remove plus a not-found `get` returning `null`, matching
`WebStorageAdapter`'s existing contract.
**Depends on:** 4
**Estimate:** 5
**Notes:** This adapter is deliberately *not* wired into any app-level
repository singleton — per the cross-cutting note, only the Task 7 sync
engine talks to it. Auth/refresh-token handling on expiry can reuse Task 2's
token-exchange shape but a full refresh-token rotation flow is an
implementation detail left to whoever picks this up; the done condition here
is CRUD correctness, not token lifecycle.
**Done:** [ ]

### Task 7: Sync engine — debounced push + periodic pull

**What:** The orchestration layer that keeps a connected client's local and
Dropbox-stored projects/pages in step: push soon after a local edit, pull on
an interval while connected (FR-7, D-5).
**Files:** `packages/core/src/sync-engine.ts` (new), corresponding test,
`packages/core/src/index.ts` (export).
**Done when:** a `SyncEngine` (constructed with `{ local: StoragePort, remote:
StoragePort, now? }`) exposes `pushCollection(collection): Promise<void>`
(diffs local records against remote by id and writes/updates the ones that
differ) and `pullCollection(collection): Promise<void>` (writes remote
records that are new or newer into local, per record `updatedAt`), plus a
`start()`/`stop()` pair that debounces a push a few seconds after the last
local write (consistent with `PageRepository.mutate`'s serialized-write
pattern) and runs `pullCollection` on a fixed interval while running; tests
exercise push/pull against two `MemoryStorage` instances standing in for
local/remote, covering: a local-only record appears remotely after push, a
remote-only record appears locally after pull, and debounce coalesces
multiple rapid local writes into one push. Conflict handling (Task 11) and
the move-feed merge (Task 14) are explicitly out of scope for this task —
`pullCollection` here assumes non-conflicting updates only.
**Depends on:** 6
**Estimate:** 5
**Done:** [ ]

### Task 8: Retry policy — exponential backoff + manual retry

**What:** Sync failure handling: automatic exponential backoff, plus a
user-triggerable "retry now" action (FR-14, D-5).
**Files:** `packages/core/src/sync-engine.ts` (extend),
`packages/core/src/sync-retry.test.ts` (new or extended in
`sync-engine.test.ts`).
**Done when:** a push or pull failure inside `SyncEngine` schedules a retry
with exponentially increasing delay (capped, not unbounded) instead of
failing silently or retrying immediately in a tight loop; `SyncEngine` exposes
a `retryNow(): Promise<void>` that bypasses the current backoff delay and
retries immediately, for the manual "retry sync now" UI action; a failed sync
never drops the change it was attempting to sync — the same local record is
still present and still eligible for the next retry attempt; tests cover
backoff delay increasing across consecutive simulated failures, a capped
maximum delay, and `retryNow` succeeding once the underlying failure
condition (mocked) clears.
**Depends on:** 7
**Estimate:** 3
**Done:** [ ]

### Task 9: Local-only degradation + two-tier warning banner

**What:** Surfacing FR-12's "local-only, no functional loss" guarantee and
FR-13's visible warning, with the D-6 two-tier detail expansion.
**Files:** `apps/app/src/dropbox/useSyncStatus.ts` (new),
`apps/app/src/dropbox/SyncStatusBanner.tsx` (new), `apps/app/src/App.tsx`
(mount point), corresponding tests; `packages/core/src/sync-engine.ts`
(expose a status/last-error surface for Task 8's failures to report through).
**Done when:** while sync is unavailable — disconnected, auth failure, or a
Dropbox "insufficient space" error surfaced from Task 6's adapter — a banner
reading a generic "not synced" message is always visible, matching FR-13's
minimum; an expandable "why" affordance on the banner shows the specific
cause (disconnected / auth failure / out of space) when `SyncEngine`'s status
surface carries one, and shows nothing more specific when it doesn't (D-6);
while this banner is showing, ordinary project/page CRUD through
`useProjects`/`usePages` continues to work unaffected (FR-12), verified by a
test that forces a sync failure and confirms local reads/writes still
succeed.
**Depends on:** 7, 8
**Estimate:** 3
**Done:** [ ]

### Task 10: Migration on connect

**What:** On a successful first connection, push all existing local
projects/pages into Dropbox using the ordinary sync path — no bespoke
migration UI or rollback (FR-4, FR-5, D-3).
**Files:** `apps/app/src/dropbox/useDropboxConnection.ts` (extend — on
successful connect, start `SyncEngine` and trigger an initial
`pushCollection` for `"projects"` and `"pages"`), corresponding test.
**Done when:** immediately after a successful connect, every pre-existing
local project and page is pushed to Dropbox via `SyncEngine.pushCollection`
(Task 7) — no separate migration function, no distinct progress UI; if the
initial push is interrupted partway, the unsent records simply remain
"not yet synced" and are picked up by Task 7's ordinary retry/interval
mechanism, covered by Task 9's warning banner, exactly as any other partial
sync state (D-3); local data is never deleted as part of this flow, at any
point (FR-5) — verified by a test that fails a simulated mid-migration push
and confirms all local records are still present afterward.
**Depends on:** 5, 7
**Estimate:** 2
**Done:** [ ]

### Task 11: Conflict detection for concurrent same-page edits

**What:** Detect, during `pullCollection`, when a page has been edited on
both the local client and remotely since the last sync (FR-9), rather than
silently taking whichever side `pullCollection` currently prefers.
**Files:** `packages/core/src/sync-engine.ts` (extend — pull comparison logic
for the `"pages"` collection), `packages/core/src/sync-conflict.ts` (new —
pure conflict-detection function), corresponding tests.
**Done when:** a pure `detectConflict(local: Page, remote: Page, lastSyncedAt:
string): boolean` returns `true` when both the local and remote copies of a
page have `updatedAt` timestamps later than the last successfully synced
state for that page id, and `false` when only one side changed (an ordinary,
non-conflicting update); `SyncEngine.pullCollection` for `"pages"` calls this
per page and stops applying the remote copy directly to local when it
returns `true` (handing off to Task 12 instead of overwriting); the Build log
move feed (Task 14) is excluded from this path — this detector applies to
Notes/Presets pages and to a Build log's `sketch` field, not to `moves[]`
appends; tests cover: no conflict when only local changed, no conflict when
only remote changed, conflict when both changed since last sync.
**Depends on:** 7
**Estimate:** 5
**Notes:** This requires `SyncEngine` to track a per-record "last synced"
timestamp/checkpoint (not just compare `updatedAt` directly) so a page that
was pulled and then locally edited again isn't mistaken for a conflict —
worth introducing a small internal sync-checkpoint map as part of this task
rather than inferring it from `updatedAt` alone.
**Done:** [ ]

### Task 12: Preserve both versions on conflict

**What:** When Task 11 detects a conflict, keep both the local and remote
versions of the page rather than discarding either (FR-10).
**Files:** `packages/core/src/sync-engine.ts` (extend), `packages/core/src/
page-conflict-repository.ts` (new — persists pending conflicts, following the
`app-meta`-style small-repository pattern), corresponding tests,
`packages/core/src/index.ts` (export).
**Done when:** on a detected conflict, `SyncEngine` does not overwrite the
local page with the remote one (or vice versa); instead it records a pending
conflict via a new `PageConflictRepository` (`{ id: pageId; local: Page;
remote: Page; detectedAt: string }` on a `"page-conflicts"` collection,
mirroring the existing repository pattern) and leaves the local page as-is
until the conflict is resolved (Task 15); a test asserts that after a
detected conflict, both the original local record and the remote record's
content are still recoverable (one from `PageRepository.get`, one from the
conflict record) and neither has been silently dropped.
**Depends on:** 11
**Estimate:** 3
**Done:** [ ]

### Task 13: Delete-vs-edit conflict via the `deletedAt` tombstone

**What:** Extend Task 11/12's conflict handling so a page edited on one
client while soft-deleted (Task 1) on another is treated as a conflict, not
resolved by delete-wins or edit-wins (FR-16, D-2).
**Files:** `packages/core/src/sync-conflict.ts` (extend `detectConflict` to
treat a `deletedAt` change on one side plus a content change on the other as
a conflict), `packages/core/src/sync-engine.ts`, corresponding tests.
**Done when:** `detectConflict` returns `true` when one side's `deletedAt`
moved from `null` to non-null since the last sync while the other side's
content (non-`deletedAt` fields) also changed since the last sync; this case
routes into the same `PageConflictRepository` path as Task 12 — no separate
delete-conflict data shape; a plain delete-with-no-concurrent-edit on the
other side still applies normally (the tombstone syncs across without
conflict); tests cover: delete-only syncs cleanly (no conflict), delete on
one side plus an edit on the other produces a conflict record with both the
tombstoned and the edited version preserved.
**Depends on:** 1, 11, 12
**Estimate:** 2
**Done:** [ ]

### Task 14: Build log move feed append-union merge

**What:** Sync the Build log's `moves[]` feed via append-union rather than
routing it through Task 11's conflict detection — both clients' independently
appended moves must all be present after sync, with no drop and no duplicate
(FR-8).
**Files:** `packages/core/src/sync-engine.ts` (extend — a distinct merge path
for `"build-log"` pages' `moves[]`), corresponding tests.
**Done when:** when `pullCollection` encounters a Build log page whose local
and remote copies each have moves the other lacks (matched by move `id`), the
merged result contains the union of both sides' `moves[]`, deduplicated by
`id`, with no move lost from either side; a `sketch`-field-only difference on
the same page still goes through Task 11's ordinary conflict path (this merge
is scoped to `moves[]` only, not the whole Build log page); tests cover:
disjoint move sets from two clients both present after merge, the same move
id appearing on both sides producing exactly one entry (no duplicate), and a
concurrent `sketch` edit on the same page still triggering a Task 11
conflict.
**Depends on:** 7
**Estimate:** 3
**Done:** [ ]

### Task 15: Conflict resolution UI

**What:** The in-app surface for reconciling a preserved conflict: side-by-
side display of both versions with a pick-one-version action per page (FR-11,
D-1).
**Files:** `apps/app/src/dropbox/useConflicts.ts` (new),
`apps/app/src/dropbox/ConflictResolution.tsx` (new), `apps/app/src/App.tsx`
(entry point/route for reviewing pending conflicts), corresponding tests.
**Done when:** a surface reachable from the app lists every pending record
from `PageConflictRepository` (Task 12), each rendered with its local version
and its remote version shown in full, side by side; each version has its own
"keep this one" action; choosing a version writes it as the page's content
via `PageRepository.mutate`, removes the pending conflict record, and — for a
delete-vs-edit conflict (Task 13) — "keep this one" on the tombstoned side
soft-deletes the page while "keep this one" on the edited side clears the
tombstone and keeps the edited content; a test seeds one ordinary
edit-vs-edit conflict and one delete-vs-edit conflict, resolves each via the
UI, and asserts the resulting page state matches the chosen version and the
conflict record is gone.
**Depends on:** 12, 13
**Estimate:** 5
**Done:** [ ]

## Summary

- Total tasks: 15
- Total estimated effort: 50 story points
- Critical path: Tasks 2 → 4 → 6 → 7 → 11 → 12 → 13 → 15 (Task 1 lands early,
  independent of the OAuth/sync chain, but must complete before Task 13; Task
  3 and Task 5 branch off Task 2/4 for the connect/disconnect UI and feed into
  Task 10; Tasks 8, 9, 10, and 14 all branch off Task 7 and can proceed in
  parallel with the Task 11 → 15 conflict chain once Task 7 lands)
- Risks:
  - **Task 11's conflict-detection checkpoint (flagged in its own Notes):**
    the trickiest correctness property in the feature — distinguishing "only
    one side changed since last sync" from "both changed" requires a real
    per-record sync checkpoint, not a naive `updatedAt` comparison; getting
    this wrong either misses real conflicts (silent data loss, violating
    FR-10) or flags every ordinary pull as a conflict (unusable UX).
  - **Task 6's Dropbox API surface:** built and tested entirely against a
    mocked HTTP layer in this task list; real-world Dropbox API behavior
    (rate limits, large-file chunked upload, token refresh timing) is
    unverified until integration testing against a live Dropbox account,
    which is outside this task list's scope.
  - **Task 2/3 OAuth seam covers web only:** the `DropboxAuthPort` interface
    (Task 2) is designed to be platform-injectable per FR-3, but only the web
    implementation (Task 3) is built here — `apps/desktop` and `apps/mobile`
    are still stubs, so their redirect implementations are unstarted work
    outside this list's scope.
  - **Task 14 vs Task 11 boundary:** the move-feed append-union merge and the
    ordinary same-page conflict path both touch Build log pages but must stay
    cleanly separated (moves merge automatically, sketch/notes conflict) —
    an implementer conflating the two could either silently auto-merge a real
    conflict or needlessly flag a non-conflicting move append.
