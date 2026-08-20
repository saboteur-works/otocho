import { useCallback, useEffect, useState } from "react";
import {
  DropboxConnectionRepository,
  SyncEngine,
  type SyncEngineDeps,
  type SyncStatus,
  type SyncStatusCause,
} from "@otocho/core";
import { DropboxStorageAdapter, type StoragePort } from "@otocho/storage";
import { WebStorageAdapter } from "@otocho/storage/web";
import { dropboxConnectionRepo } from "./repository";

/** Collections this hook's own background `SyncEngine` polls while
 * connected, matching `useDropboxConnection`'s migration set (FR-7). */
const SYNCED_COLLECTIONS = ["projects", "pages"];

/** How often the hook re-reads `SyncEngine.getStatus()` (Task 9). Cheap and
 * synchronous, so a short interval is fine. */
const DEFAULT_POLL_INTERVAL_MS = 2000;

/** The app's shared, IndexedDB-backed local storage port, used as the
 * default engine's local side (tests inject `MemoryStorage`). */
const defaultLocalStorage = new WebStorageAdapter();

/** `SyncStatusCause` plus the one cause `SyncEngine` can't know about itself
 * (Task 9, D-6) — no `DropboxConnection` marker present at all. */
export type SyncStatusVisibleCause = SyncStatusCause | "disconnected";

export interface SyncStatusView {
  /** True once the FR-13 "not synced" warning should be shown — while
   * disconnected, or while the background `SyncEngine` reports itself
   * unsynced. False before the initial connection-marker read resolves, so
   * the banner doesn't flash on first mount. */
  visible: boolean;
  /** The specific cause, when known (D-6's expandable "why" tier).
   * Undefined when `visible` is true but no more specific cause is known. */
  cause?: SyncStatusVisibleCause;
  /** Manually retries a stalled sync, bypassing backoff (FR-14, D-5). A
   * no-op while disconnected (there is no engine to retry) or already
   * synced. */
  retryNow: () => Promise<void>;
}

export interface UseSyncStatusOptions {
  repo?: DropboxConnectionRepository;
  /** Injectable so tests can observe/drive a specific `SyncEngine` directly,
   * instead of the hook constructing its own against a real Dropbox
   * account. When supplied, the hook polls this engine's status as-is and
   * does not start or stop it — the caller owns its lifecycle. */
  engine?: SyncEngine | null;
  /** The local `StoragePort` the hook's own background engine reads from,
   * when no `engine` is injected. Defaults to the app's shared
   * `WebStorageAdapter`; tests inject `MemoryStorage`. */
  localStorage?: StoragePort;
  /** Injectable so tests can stub `SyncEngine` construction for the hook's
   * own background engine. */
  createSyncEngine?: (deps: SyncEngineDeps) => SyncEngine;
  pollIntervalMs?: number;
}

/**
 * Surfaces FR-12/FR-13's "local-only, always show a warning while
 * unsynced" state, with D-6's two-tier detail: `visible` is the always-shown
 * generic tier, `cause` is the expandable "why" tier, present only when a
 * specific cause is known (disconnected / auth failure / out of space).
 *
 * While no `engine` is injected and a `DropboxConnection` marker is present,
 * this hook runs its own background `SyncEngine` (`start()`'d against a real
 * `DropboxStorageAdapter`) purely to have a status to poll — it does not
 * drive local→remote push (that stays `notifyLocalChange`-triggered
 * elsewhere); it only pulls, on `SyncEngine`'s own periodic interval, which
 * is enough to detect an auth failure or an out-of-space account over time.
 * Local reads/writes through `useProjects`/`usePages` never depend on this
 * hook or its engine (FR-12) — it is read-only against sync state.
 */
export function useSyncStatus(options: UseSyncStatusOptions = {}): SyncStatusView {
  const {
    repo = dropboxConnectionRepo,
    engine: injectedEngine = null,
    localStorage = defaultLocalStorage,
    createSyncEngine = (deps: SyncEngineDeps) => new SyncEngine(deps),
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  } = options;

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [engine, setEngine] = useState<SyncEngine | null>(injectedEngine);
  const [engineStatus, setEngineStatus] = useState<SyncStatus>({ synced: true });

  useEffect(() => {
    let cancelled = false;
    let createdEngine: SyncEngine | null = null;

    void repo.get().then((existing) => {
      if (cancelled) return;
      setConnected(existing !== null);
      setLoading(false);

      if (injectedEngine) {
        setEngine(injectedEngine);
        return;
      }
      if (existing) {
        const remote = new DropboxStorageAdapter({
          getAccessToken: () => existing.tokens.accessToken,
        });
        createdEngine = createSyncEngine({ local: localStorage, remote });
        createdEngine.start(SYNCED_COLLECTIONS);
        setEngine(createdEngine);
      } else {
        setEngine(null);
      }
    });

    return () => {
      cancelled = true;
      createdEngine?.stop();
    };
  }, [repo, injectedEngine, localStorage, createSyncEngine]);

  useEffect(() => {
    if (!engine) {
      setEngineStatus({ synced: true });
      return;
    }
    const poll = () => setEngineStatus(engine.getStatus());
    poll();
    const id = setInterval(poll, pollIntervalMs);
    return () => clearInterval(id);
  }, [engine, pollIntervalMs]);

  const retryNow = useCallback(async () => {
    if (!engine) return;
    await engine.retryNow();
    setEngineStatus(engine.getStatus());
  }, [engine]);

  if (loading) {
    return { visible: false, retryNow };
  }
  if (!connected) {
    return { visible: true, cause: "disconnected", retryNow };
  }
  if (!engineStatus.synced) {
    return { visible: true, cause: engineStatus.cause, retryNow };
  }
  return { visible: false, retryNow };
}
