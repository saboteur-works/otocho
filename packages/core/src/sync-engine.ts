import type { StoragePort, StoredRecord } from "@otocho/storage";
import { detectConflict } from "./sync-conflict";
import type { BuildLogPage, Move, Page } from "./page";

/** The collection name pulled/pushed through the pages-specific conflict
 * checkpoint/detection path (FR-9, Task 11). Other collections (e.g.
 * `projects`) keep the plain newer-wins comparison. */
const PAGES_COLLECTION = "pages";

/** Debounce window between the last local write and a coalesced push (D-5). */
const DEFAULT_DEBOUNCE_MS = 3000;
/** Interval between periodic background pulls while connected (D-5). */
const DEFAULT_PULL_INTERVAL_MS = 30000;
/** Starting delay for the first automatic retry after a sync failure (D-5, FR-14). */
const DEFAULT_RETRY_BASE_MS = 1000;
/** Ceiling on the exponential backoff delay, so retries never grow unbounded (D-5, FR-14). */
const DEFAULT_RETRY_MAX_MS = 60000;

/** A stored record that also carries an `updatedAt` timestamp, so push/pull
 * can compare freshness. Both `Project` and `Page` satisfy this shape. */
export interface SyncableRecord extends StoredRecord {
  updatedAt: string;
}

/**
 * A cause `SyncEngine` itself can distinguish from a failed push/pull error
 * (Task 9, FR-12/FR-13, D-6's expandable "why" detail): an auth failure, or a
 * Dropbox "out of space" error, both surfaced from the remote `StoragePort`
 * (e.g. `DropboxStorageAdapter`)'s thrown errors. `"disconnected"` is
 * deliberately not a member here — a disconnected client has no
 * `SyncEngine`/remote at all, so that cause is known one layer up, by
 * whether a `DropboxConnection` marker exists, not from this engine.
 */
export type SyncStatusCause = "auth-failure" | "out-of-space";

/** {@link SyncEngine.getStatus}'s return shape (Task 9, FR-13, D-6). */
export interface SyncStatus {
  /** True when no push/pull collection is currently in a failed/retrying
   * state. */
  synced: boolean;
  /** The most recently classified failure cause, when `synced` is false and
   * the failing error was recognizable (D-6). Undefined either while
   * `synced` is true, or when `synced` is false but the failure couldn't be
   * classified — the "why" detail simply has nothing more specific to show. */
  cause?: SyncStatusCause;
}

/**
 * Classifies a push/pull failure thrown by the remote `StoragePort` into a
 * {@link SyncStatusCause}, by pattern-matching the error message emitted by
 * `DropboxStorageAdapter` (Task 6) — Dropbox's `insufficient_space` error tag
 * for out-of-space, or an HTTP 401 / Dropbox's expired-or-invalid access
 * token errors for an auth failure. Returns `undefined` for any other error
 * (e.g. a plain network failure), so the status surface reports "unsynced,
 * no further detail" rather than guessing.
 */
function classifySyncError(error: unknown): SyncStatusCause | undefined {
  const message = error instanceof Error ? error.message : String(error);
  if (/insufficient_space/i.test(message)) return "out-of-space";
  if (/expired_access_token|invalid_access_token|\(401\)/i.test(message)) return "auth-failure";
  return undefined;
}

export interface SyncEngineDeps {
  local: StoragePort;
  remote: StoragePort;
  now?: () => string;
  /** Debounce window before a coalesced push fires, in ms. Defaults to a few seconds. */
  debounceMs?: number;
  /** Interval between periodic pulls while running, in ms. */
  pullIntervalMs?: number;
  /** Starting delay for the first automatic retry after a sync failure, in ms. */
  retryBaseMs?: number;
  /** Ceiling on the exponential backoff delay, in ms. */
  retryMaxMs?: number;
}

/**
 * Orchestrates keeping `local` and `remote` `StoragePort`s in step for a
 * connected Dropbox client (FR-7, D-5): a debounced push soon after a local
 * edit, plus a periodic background pull while running. Local is always
 * primary (D-4) — this is the only thing that talks to the remote port; UI
 * code never does.
 *
 * Conflict handling: for the `"pages"` collection, `pullCollection` detects
 * a same-page conflict (both local and remote edited since the last synced
 * checkpoint for that page — FR-9, Task 11) and leaves the page untouched
 * rather than overwriting local with remote; a later task (12) hands that
 * off to a preserve-both resolution path instead of the current no-op. A
 * Build log page's `moves[]` feed is carved out of that whole-page check
 * (FR-8, Task 14): if local and remote each appended moves the other
 * lacks, `pullCollection` merges the union of both `moves[]` — deduplicated
 * by move id — into local instead, ahead of the conflict check, so a
 * diverging move feed never gets treated as (or blocked by) a same-page
 * conflict. A Build log page whose `moves[]` don't diverge still goes
 * through the ordinary conflict/newer-wins path above for its other fields
 * (e.g. `sketch`). Other collections (e.g. `projects`) still apply
 * newer-wins by `updatedAt` with no conflict detection.
 */
export class SyncEngine {
  private readonly local: StoragePort;
  private readonly remote: StoragePort;
  private readonly now: () => string;
  private readonly debounceMs: number;
  private readonly pullIntervalMs: number;
  private readonly retryBaseMs: number;
  private readonly retryMaxMs: number;

  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private pullTimer: ReturnType<typeof setInterval> | undefined;
  private pendingCollections = new Set<string>();
  private running = false;

  /** Retry/backoff state (FR-14, D-5). Failed collections stay recorded here
   * — never removed from local storage — so the next retry attempt (whether
   * automatic or via {@link retryNow}) simply re-reads and re-pushes/pulls
   * the same, still-present local/remote state. */
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private retryAttempt = 0;
  private failedPushCollections = new Set<string>();
  private failedPullCollections = new Set<string>();

  /** The most recently classified push/pull failure cause (Task 9), or
   * `undefined` if nothing is currently failing, or the latest failure
   * wasn't classifiable. Backs {@link getStatus}. */
  private lastFailureCause: SyncStatusCause | undefined;

  /** Per-page "last synced" checkpoint (FR-9, Task 11), keyed by
   * `${collection}/${id}`. Recorded whenever a `"pages"` record
   * successfully syncs — pushed to remote, or pulled to local — with no
   * conflict detected, so a page that was synced and then edited again
   * locally (or remotely) is compared against its own last-synced state
   * rather than against a stale baseline or `updatedAt` alone. Undefined
   * for a page id means "no known synced baseline yet" — pre-checkpoint
   * pulls fall back to plain newer-wins, matching this engine's behavior
   * before Task 11. */
  private syncCheckpoints = new Map<string, string>();

  constructor(deps: SyncEngineDeps) {
    this.local = deps.local;
    this.remote = deps.remote;
    this.now = deps.now ?? (() => new Date().toISOString());
    this.debounceMs = deps.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.pullIntervalMs = deps.pullIntervalMs ?? DEFAULT_PULL_INTERVAL_MS;
    this.retryBaseMs = deps.retryBaseMs ?? DEFAULT_RETRY_BASE_MS;
    this.retryMaxMs = deps.retryMaxMs ?? DEFAULT_RETRY_MAX_MS;
  }

  /** True while `start()` has run and `stop()` hasn't cancelled it since. */
  get isRunning(): boolean {
    return this.running;
  }

  /** The engine's injectable clock, exposed so retry/backoff logic (a later
   * task) can schedule off the same clock tests inject here. */
  currentTime(): string {
    return this.now();
  }

  /**
   * Reports whether every push/pull collection is currently in sync, and if
   * not, the most specific known cause (Task 9, FR-12/FR-13, D-6). Callers
   * (e.g. a UI status hook) poll this rather than this engine pushing
   * updates itself — `SyncEngine` has no event/subscription surface.
   */
  getStatus(): SyncStatus {
    const synced = this.failedPushCollections.size === 0 && this.failedPullCollections.size === 0;
    return synced ? { synced: true } : { synced: false, cause: this.lastFailureCause };
  }

  /**
   * Writes local records that are missing from, or newer than, their remote
   * counterpart. Comparison is by `updatedAt` (a record without one is
   * always pushed, since it can't be compared).
   */
  async pushCollection(collection: string): Promise<void> {
    const [localRecords, remoteRecords] = await Promise.all([
      this.local.list<SyncableRecord>(collection),
      this.remote.list<SyncableRecord>(collection),
    ]);
    const remoteById = new Map(remoteRecords.map((r) => [r.id, r]));

    for (const record of localRecords) {
      const remote = remoteById.get(record.id);
      if (!remote || isNewer(record, remote)) {
        await this.remote.put(collection, record);
        if (collection === PAGES_COLLECTION) {
          this.recordSynced(collection, record.id, record.updatedAt);
        }
      }
    }
  }

  /**
   * Writes remote records that are missing from, or newer than, their local
   * counterpart, directly into local (newer-wins) — except for the
   * `"pages"` collection, which gets two page-specific detours ahead of
   * plain newer-wins:
   *
   * 1. Build log `moves[]` append-union (FR-8, Task 14): if the local and
   *    remote copies of the same Build log page each have moves the other
   *    lacks, the merged union of both `moves[]` (deduplicated by move id)
   *    is written to local and its checkpoint advances — before, and
   *    instead of, the conflict check below.
   * 2. Otherwise, a page with a known synced checkpoint is checked via
   *    `detectConflict` (FR-9, Task 11): if both local and remote changed
   *    since that checkpoint, the page is left untouched rather than
   *    overwritten, and its checkpoint does not advance. A page with no
   *    recorded checkpoint yet (never synced through this engine) falls
   *    back to plain newer-wins, matching pre-Task-11 behavior.
   */
  async pullCollection(collection: string): Promise<void> {
    const [localRecords, remoteRecords] = await Promise.all([
      this.local.list<SyncableRecord>(collection),
      this.remote.list<SyncableRecord>(collection),
    ]);
    const localById = new Map(localRecords.map((r) => [r.id, r]));

    for (const record of remoteRecords) {
      const local = localById.get(record.id);

      if (collection === PAGES_COLLECTION && local) {
        const merged = mergeBuildLogMoves(
          local as unknown as Page,
          record as unknown as Page,
          this.now,
        );
        if (merged) {
          // Build log moves[] append-union (FR-8, Task 14): both sides
          // appended distinct moves since the shared ancestor. This is a
          // narrower, moves-only merge that takes priority over the
          // whole-page conflict block below — a diverging `moves[]` is
          // never itself a reason to leave the page as a pending conflict.
          const mergedRecord = merged as unknown as SyncableRecord;
          await this.local.put(collection, mergedRecord);
          this.recordSynced(collection, record.id, mergedRecord.updatedAt);
          continue;
        }

        const checkpoint = this.syncCheckpoints.get(this.checkpointKey(collection, record.id));
        if (
          checkpoint !== undefined &&
          detectConflict(local as unknown as Page, record as unknown as Page, checkpoint)
        ) {
          // Same-page conflict (FR-9): both sides changed since the last
          // synced checkpoint. Stop here rather than overwriting local with
          // remote — Task 12 hands this to a preserve-both resolution path
          // instead of this no-op.
          continue;
        }
      }

      if (!local || isNewer(record, local)) {
        await this.local.put(collection, record);
        if (collection === PAGES_COLLECTION) {
          this.recordSynced(collection, record.id, record.updatedAt);
        }
      }
    }
  }

  /** Checkpoint map key for a given collection/record id pair. */
  private checkpointKey(collection: string, id: string): string {
    return `${collection}/${id}`;
  }

  /** Records that `id` in `collection` is now known synced as of
   * `updatedAt` — see the `syncCheckpoints` field doc. */
  private recordSynced(collection: string, id: string, updatedAt: string): void {
    this.syncCheckpoints.set(this.checkpointKey(collection, id), updatedAt);
  }

  /**
   * Signals that a local write just happened for `collection`. Coalesces
   * rapid successive calls into a single debounced `pushCollection` a few
   * seconds after the last one, matching `PageRepository.mutate`'s
   * serialized-write pattern (D-5). No-op while stopped.
   */
  notifyLocalChange(collection: string): void {
    if (!this.running) return;
    this.pendingCollections.add(collection);
    if (this.debounceTimer !== undefined) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      const collections = [...this.pendingCollections];
      this.pendingCollections.clear();
      void Promise.all(collections.map((c) => this.pushWithRetry(c)));
    }, this.debounceMs);
  }

  /**
   * Begins debounced push-on-change (via {@link notifyLocalChange}) and a
   * fixed-interval periodic pull loop. `pullIntervalMs`/`debounceMs` are
   * configurable via the constructor; production wiring is expected to pass
   * the collections it cares about into pull on its own schedule.
   */
  start(collections: string[] = []): void {
    if (this.running) return;
    this.running = true;
    this.pullTimer = setInterval(() => {
      void Promise.all(collections.map((c) => this.pullWithRetry(c)));
    }, this.pullIntervalMs);
  }

  /** Cancels the debounce timer, the periodic pull interval, and any pending
   * automatic retry. Collections that had failed remain tracked so a
   * subsequent `start()` plus local change/pull cycle naturally retries them
   * — no failure state or local data is discarded by stopping. */
  stop(): void {
    this.running = false;
    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    if (this.pullTimer !== undefined) {
      clearInterval(this.pullTimer);
      this.pullTimer = undefined;
    }
    if (this.retryTimer !== undefined) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
    this.pendingCollections.clear();
  }

  /**
   * Manually triggers an immediate retry of any sync operations that are
   * currently pending backoff, bypassing the remaining delay — the
   * user-visible "retry sync now" action (FR-14, D-5). No-op if nothing has
   * failed.
   */
  async retryNow(): Promise<void> {
    if (this.retryTimer !== undefined) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
    await this.runRetries();
  }

  /**
   * Runs `pushCollection` for `collection`, keeping the local record intact
   * and scheduling an automatic backoff retry on failure rather than losing
   * the change or retrying in a tight loop (FR-14, D-5).
   */
  private async pushWithRetry(collection: string): Promise<void> {
    try {
      await this.pushCollection(collection);
      this.failedPushCollections.delete(collection);
      this.onRetrySucceeded();
    } catch (error) {
      this.failedPushCollections.add(collection);
      this.lastFailureCause = classifySyncError(error);
      this.scheduleRetry();
    }
  }

  /** Pull counterpart to {@link pushWithRetry}. */
  private async pullWithRetry(collection: string): Promise<void> {
    try {
      await this.pullCollection(collection);
      this.failedPullCollections.delete(collection);
      this.onRetrySucceeded();
    } catch (error) {
      this.failedPullCollections.add(collection);
      this.lastFailureCause = classifySyncError(error);
      this.scheduleRetry();
    }
  }

  /** Re-attempts every currently-failed push/pull collection once, used by
   * both the automatic backoff timer and {@link retryNow}. */
  private async runRetries(): Promise<void> {
    const pushCollections = [...this.failedPushCollections];
    const pullCollections = [...this.failedPullCollections];
    await Promise.all([
      ...pushCollections.map((c) => this.pushWithRetry(c)),
      ...pullCollections.map((c) => this.pullWithRetry(c)),
    ]);
  }

  /** Resets backoff once nothing is failing anymore. */
  private onRetrySucceeded(): void {
    if (this.failedPushCollections.size > 0 || this.failedPullCollections.size > 0) return;
    this.retryAttempt = 0;
    this.lastFailureCause = undefined;
    if (this.retryTimer !== undefined) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
  }

  /** Schedules the next automatic retry at an exponentially increasing
   * delay, capped at `retryMaxMs` so failures never retry unboundedly far
   * apart, and never in a tight loop (FR-14, D-5). A retry that's already
   * scheduled is left alone rather than reset, so repeated failures across
   * multiple collections coalesce onto the same backoff clock. */
  private scheduleRetry(): void {
    if (this.retryTimer !== undefined) return;
    const delay = Math.min(this.retryBaseMs * 2 ** this.retryAttempt, this.retryMaxMs);
    this.retryAttempt += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.runRetries();
    }, delay);
  }
}

/** True when `candidate` is strictly newer than `existing` by `updatedAt`. */
function isNewer(candidate: SyncableRecord, existing: SyncableRecord): boolean {
  if (candidate.updatedAt === undefined) return true;
  if (existing.updatedAt === undefined) return true;
  return candidate.updatedAt > existing.updatedAt;
}

/**
 * Build log `moves[]` append-union merge (FR-8, Task 14). When `local` and
 * `remote` are both the same Build log page and EACH has at least one move
 * the other lacks (a true fork — both clients appended independently since
 * the last shared state), returns a merged page carrying the union of both
 * `moves[]` arrays, deduplicated by move `id` and ordered by each move's own
 * `at` timestamp. All other fields (notably `sketch`) are taken from
 * `local` unchanged — local stays primary (D-4) for anything outside the
 * move feed — and `updatedAt` is stamped fresh via `now` so the merge
 * itself counts as a new synced state.
 *
 * Returns `undefined` — deferring to the caller's ordinary newer-wins /
 * Task 11 conflict path — when the pages aren't both Build log pages, or
 * when `moves[]` doesn't truly diverge (identical arrays, or one side is a
 * superset of the other because only one client appended since the last
 * sync). In particular, a Build log page whose `moves[]` are unchanged but
 * whose `sketch` differs on both sides is deliberately left to that
 * ordinary path — this merge is scoped to `moves[]` only.
 */
function mergeBuildLogMoves(
  local: Page,
  remote: Page,
  now: () => string,
): BuildLogPage | undefined {
  if (local.type !== "build-log" || remote.type !== "build-log") return undefined;

  const localIds = new Set(local.moves.map((m) => m.id));
  const remoteIds = new Set(remote.moves.map((m) => m.id));
  const localHasExtra = local.moves.some((m) => !remoteIds.has(m.id));
  const remoteHasExtra = remote.moves.some((m) => !localIds.has(m.id));
  if (!localHasExtra || !remoteHasExtra) return undefined;

  const byId = new Map<string, Move>();
  for (const move of local.moves) byId.set(move.id, move);
  for (const move of remote.moves) {
    if (!byId.has(move.id)) byId.set(move.id, move);
  }
  const moves = [...byId.values()].sort((a, b) => a.at.localeCompare(b.at));

  return { ...local, moves, updatedAt: now() };
}
