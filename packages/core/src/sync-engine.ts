import type { StoragePort, StoredRecord } from "@otocho/storage";

/** Debounce window between the last local write and a coalesced push (D-5). */
const DEFAULT_DEBOUNCE_MS = 3000;
/** Interval between periodic background pulls while connected (D-5). */
const DEFAULT_PULL_INTERVAL_MS = 30000;

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

  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private pullTimer: ReturnType<typeof setInterval> | undefined;
  private pendingCollections = new Set<string>();
  private running = false;

  constructor(deps: SyncEngineDeps) {
    this.local = deps.local;
    this.remote = deps.remote;
    this.now = deps.now ?? (() => new Date().toISOString());
    this.debounceMs = deps.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.pullIntervalMs = deps.pullIntervalMs ?? DEFAULT_PULL_INTERVAL_MS;
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
      void Promise.all(collections.map((c) => this.pushCollection(c)));
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
      void Promise.all(collections.map((c) => this.pullCollection(c)));
    }, this.pullIntervalMs);
  }

  /** Cancels the debounce timer and the periodic pull interval. */
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
    this.pendingCollections.clear();
  }
}

/** True when `candidate` is strictly newer than `existing` by `updatedAt`. */
function isNewer(candidate: SyncableRecord, existing: SyncableRecord): boolean {
  if (candidate.updatedAt === undefined) return true;
  if (existing.updatedAt === undefined) return true;
  return candidate.updatedAt > existing.updatedAt;
}
