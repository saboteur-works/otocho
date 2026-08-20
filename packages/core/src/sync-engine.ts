import type { StoragePort, StoredRecord } from "@otocho/storage";

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
 * Conflict handling (same page changed on both sides) and the Build log
 * move-feed append-union merge are out of scope here — `pullCollection`
 * assumes non-conflicting updates and applies newer-wins by `updatedAt`.
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
      }
    }
  }

  /**
   * Writes remote records that are missing from, or newer than, their local
   * counterpart, directly into local (newer-wins, no conflict detection —
   * see class doc).
   */
  async pullCollection(collection: string): Promise<void> {
    const [localRecords, remoteRecords] = await Promise.all([
      this.local.list<SyncableRecord>(collection),
      this.remote.list<SyncableRecord>(collection),
    ]);
    const localById = new Map(localRecords.map((r) => [r.id, r]));

    for (const record of remoteRecords) {
      const local = localById.get(record.id);
      if (!local || isNewer(record, local)) {
        await this.local.put(collection, record);
      }
    }
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
    } catch {
      this.failedPushCollections.add(collection);
      this.scheduleRetry();
    }
  }

  /** Pull counterpart to {@link pushWithRetry}. */
  private async pullWithRetry(collection: string): Promise<void> {
    try {
      await this.pullCollection(collection);
      this.failedPullCollections.delete(collection);
      this.onRetrySucceeded();
    } catch {
      this.failedPullCollections.add(collection);
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
